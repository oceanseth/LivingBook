#!/usr/bin/env node
// LivingBook API server — multi-book verbatim answering + author uploads.
//
//   GET  /api/books                       list books
//   POST /api/books {title}               create a book (Masky SSO bearer = author)
//   POST /api/books/:slug/content         upload content {title, sourceType, text}
//   POST /api/books/:slug/ask {question}  verbatim passages + spoken frame
//   POST /api/ask {question}              legacy: bible-kjv ask
//   POST /api/render                      render answer via narrator (speak mode)
//   GET  /api/news                        cached top headlines
//
// The no-invention contract: answers quote stored units byte-identically;
// the only generated text is the connective frame, template-composed here.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { VectorAIClient } from '@actian/vectorai-client';
import { pipeline } from '@xenova/transformers';

const PORT = process.env.PORT ?? 8787;
const SERVICE_TOKEN = process.env.MASKY_SERVICE_TOKEN;
const NARRATOR_AVATAR_ID = process.env.MASKY_NARRATOR_AVATAR_ID;
const NARRATOR_OWNER = process.env.MASKY_NARRATOR_OWNER;
const MASKY = 'https://masky.ai/api';
const SCORE_THRESHOLD = 0.35;
const BOOKS_FILE = new URL('./local_data/books.json', import.meta.url).pathname;

const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const client = new VectorAIClient('localhost:6574', { restUrl: 'http://localhost:6573' });

const CONVOS_FILE = new URL('./local_data/convos.json', import.meta.url).pathname;
const convos = existsSync(CONVOS_FILE) ? JSON.parse(readFileSync(CONVOS_FILE, 'utf8')) : {};
const saveConvos = () => writeFileSync(CONVOS_FILE, JSON.stringify(convos, null, 1));

// VoiceCert demo gate: production liveness attestation isn't live yet, so this
// mints demo sessions the recording flow requires before any spoken ingestion.
const voicecertSessions = new Map();

const books = existsSync(BOOKS_FILE)
  ? JSON.parse(readFileSync(BOOKS_FILE, 'utf8'))
  : {
      'bible-kjv': {
        slug: 'bible-kjv',
        title: 'The Holy Bible (KJV)',
        author: 'Public Domain',
        ownerSub: null,
        units: 2769,
        nextId: 100000,
        createdAt: 0,
      },
    };
const saveBooks = () => writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 1));
saveBooks();

async function embedText(text) {
  const out = await embed(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

const userCache = new Map();
async function maskyUser(token) {
  if (!token) return null;
  if (userCache.has(token)) return userCache.get(token);
  const res = await fetch(`${MASKY}/oauth/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const info = await res.json();
  userCache.set(token, info);
  return info;
}

function chunkText(text, sourceRef) {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.;!?]+[.;!?]+["']?\s*/g) ?? [text];
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    buf += s;
    if (buf.length > 700) {
      chunks.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.map((t, i) => ({ text: t, ref: `${sourceRef} §${i + 1}` }));
}

function frameFor(book, p) {
  const clean = p.text.replace(/\s*\{[^}]*\}/g, '');
  let frame;
  if (p.source_type === 'podcast') frame = `I've answered this before, on ${p.source_title ?? p.ref}, and I said: `;
  else if (p.source_type === 'qa') frame = `A reader once asked me this. From ${p.source_title ?? p.ref}, I said: `;
  else if (p.source_type === 'spoken') frame = `I spoke these words myself, on the record${p.voicecert ? ' — VoiceCert-attested' : ''} (${p.source_title ?? p.ref}): `;
  else if (book.slug === 'bible-kjv') frame = `Hear the word, from ${p.ref}: `;
  else frame = `From ${p.ref}: `;
  let quote = '';
  for (const s of clean.match(/[^.;!?]+[.;!?]*\s*/g) ?? [clean]) {
    if (frame.length + quote.length + s.length > 490) break;
    quote += s;
  }
  return frame + (quote.trim() || clean.slice(0, 490 - frame.length));
}

async function ask(slug, question) {
  const book = books[slug];
  if (!book) throw new Error(`unknown book: ${slug}`);
  const vector = await embedText(question);
  const results = await client.points.search(`book_${slug}`, vector, { limit: 5, withPayload: true });
  const passages = results
    .filter((r) => r.score >= SCORE_THRESHOLD)
    .map((r) => ({ ...r.payload, score: r.score }));
  if (passages.length === 0) {
    return {
      covered: false,
      spoken: `${book.title} does not speak directly to that question.`,
      passages: [],
    };
  }
  return { covered: true, spoken: frameFor(book, passages[0]), passages };
}

let newsCache = { at: 0, items: [] };
async function news() {
  if (Date.now() - newsCache.at < 10 * 60 * 1000) return newsCache.items;
  const rss = await fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en').then((r) => r.text());
  const items = [...rss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)]
    .map((m) => ({
      title: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link: m[2].trim(),
    }))
    .slice(0, 8);
  newsCache = { at: Date.now(), items };
  return items;
}

async function render(question, token, { avatarId, avatarOwnerUserId, output = 'video', slug = 'bible-kjv' }) {
  const answer = await ask(slug, question);
  const conv = await fetch(`${MASKY}/conversations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarId, avatarOwnerUserId }),
  }).then((r) => r.json());
  if (!conv.conversationId) throw new Error(`conversation failed: ${JSON.stringify(conv).slice(0, 200)}`);
  const turnRes = await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userText: answer.spoken.slice(0, 499), mode: 'speak', output }),
  });
  const turn = await turnRes.json();
  if (!turnRes.ok || !turn.turn) throw new Error(`turn failed (${turnRes.status}): ${JSON.stringify(turn).slice(0, 300)}`);
  return {
    ...answer,
    conversation: { id: conv.conversationId, liveUrl: conv.liveUrl, shareSlug: conv.shareSlug },
    turn: turn.turn,
  };
}

const server = createServer(async (req, res) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return res.writeHead(204, headers).end();
  let body = '';
  for await (const c of req) body += c;
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    const data = body ? JSON.parse(body) : {};
    const url = req.url.split('?')[0];

    if (req.method === 'GET' && url === '/api/books') {
      const list = Object.values(books).map(({ slug, title, author, units }) => ({ slug, title, author, units }));
      return res.writeHead(200, headers).end(JSON.stringify({ books: list }));
    }
    if (req.method === 'GET' && url === '/api/news') {
      return res.writeHead(200, headers).end(JSON.stringify({ stories: await news() }));
    }
    if (req.method === 'POST' && url === '/api/books') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      const title = String(data.title ?? '').trim();
      if (!title) return res.writeHead(400, headers).end('{"error":"title required"}');
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      if (books[slug]) return res.writeHead(409, headers).end('{"error":"book exists"}');
      try {
        await client.collections.create(`book_${slug}`, { dimension: 384, distanceMetric: 'COSINE' });
      } catch { /* may exist from a prior run */ }
      books[slug] = {
        slug,
        title,
        author: user.name,
        ownerSub: user.sub,
        authorAvatarId: user.avatar_id ?? null,
        units: 0,
        nextId: 1,
        createdAt: Date.now(),
      };
      saveBooks();
      return res.writeHead(200, headers).end(JSON.stringify({ book: books[slug] }));
    }

    const contentMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/content$/);
    if (req.method === 'POST' && contentMatch) {
      const book = books[contentMatch[1]];
      if (!book) return res.writeHead(404, headers).end('{"error":"unknown book"}');
      const user = await maskyUser(token);
      if (!user || (book.ownerSub && user.sub !== book.ownerSub)) {
        return res.writeHead(403, headers).end('{"error":"not your book"}');
      }
      const { title = 'untitled', sourceType = 'book', text, voicecertSessionId } = data;
      if (!text || text.length < 40) return res.writeHead(400, headers).end('{"error":"text too short"}');
      let voicecert = null;
      if (sourceType === 'spoken') {
        const vc = voicecertSessions.get(voicecertSessionId);
        if (!vc || vc.sub !== user.sub) {
          return res.writeHead(403, headers).end('{"error":"spoken content requires a VoiceCert-attested session — authenticate first"}');
        }
        voicecert = { sessionId: voicecertSessionId, method: vc.method, attestedAt: vc.issuedAt };
      }
      const chunks = chunkText(text, title);
      const points = [];
      for (const c of chunks) {
        points.push({
          id: book.nextId++,
          vector: await embedText(c.text),
          payload: { source_type: sourceType, source_title: title, ref: c.ref, text: c.text, ...(voicecert ? { voicecert } : {}) },
        });
      }
      await client.points.upsert(`book_${book.slug}`, points);
      book.units += points.length;
      saveBooks();
      return res.writeHead(200, headers).end(JSON.stringify({ ok: true, unitsAdded: points.length, totalUnits: book.units }));
    }

    // VoiceCert attestation — gates spoken-word recording. The widget on the
    // client yields a token; we verify it server-side with the site secret.
    if (req.method === 'POST' && url === '/api/voicecert/session') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      if (!data.token) return res.writeHead(400, headers).end('{"error":"VoiceCert widget token required"}');
      const verify = await fetch('https://vjo75sxcjitvjyzwbkiadmg2u40nojps.lambda-url.us-east-1.on.aws/v1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: process.env.VOICECERT_SECRET, token: data.token }),
      }).then((r) => r.json()).catch((e) => ({ success: false, error: e.message }));
      if (!verify.success) {
        return res.writeHead(403, headers).end(JSON.stringify({ error: 'VoiceCert verification failed', detail: verify }));
      }
      const sessionId = 'vc_' + Math.random().toString(36).slice(2, 12);
      const session = {
        sessionId,
        sub: user.sub,
        name: user.name,
        method: 'voicecert',
        issuedAt: Date.now(),
      };
      voicecertSessions.set(sessionId, session);
      return res.writeHead(200, headers).end(JSON.stringify({ session }));
    }

    // Visitor talks to someone's book agent; the exchange lands in the owner's inbox.
    if (req.method === 'POST' && url === '/api/talk') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky to talk — your avatar is your identity"}');
      const { slug, question } = data;
      if (!books[slug] || !question) return res.writeHead(400, headers).end('{"error":"slug and question required"}');
      const answer = await ask(slug, question);
      const convoId = `${user.sub}~${slug}`;
      const convo = (convos[convoId] ??= {
        id: convoId,
        fromSub: user.sub,
        fromName: user.name,
        fromAvatarId: user.avatar_id ?? null,
        fromPicture: user.picture ?? null,
        slug,
        bookTitle: books[slug].title,
        turns: [],
        renderedUrl: null,
        createdAt: Date.now(),
      });
      convo.turns.push({ who: 'visitor', text: question, at: Date.now() });
      convo.turns.push({ who: 'agent', text: answer.spoken, ref: answer.passages[0]?.ref ?? null, at: Date.now() });
      convo.updatedAt = Date.now();
      saveConvos();
      return res.writeHead(200, headers).end(JSON.stringify({ ...answer, conversationId: convoId }));
    }

    // Owner inbox: incoming conversations with their books (text-only until rendered).
    if (req.method === 'GET' && url === '/api/inbox') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      const mine = Object.values(convos).filter((c) => books[c.slug]?.ownerSub === user.sub);
      return res.writeHead(200, headers).end(JSON.stringify({ conversations: mine }));
    }

    // Owner renders an inbox conversation as two-avatar video on THEIR credits.
    const renderMatch = url.match(/^\/api\/inbox\/([^/]+)\/render$/);
    if (req.method === 'POST' && renderMatch) {
      const convo = convos[decodeURIComponent(renderMatch[1])];
      if (!convo) return res.writeHead(404, headers).end('{"error":"unknown conversation"}');
      const user = await maskyUser(token);
      if (!user || books[convo.slug]?.ownerSub !== user.sub) {
        return res.writeHead(403, headers).end('{"error":"only the book owner can render"}');
      }
      const bookAvatar = books[convo.slug].authorAvatarId ?? NARRATOR_AVATAR_ID;
      const conv = await fetch(`${MASKY}/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: bookAvatar, avatarOwnerUserId: NARRATOR_OWNER }),
      }).then((r) => r.json());
      if (!conv.conversationId) throw new Error(`conversation failed: ${JSON.stringify(conv).slice(0, 200)}`);
      for (let i = 0; i < convo.turns.length; i += 2) {
        const q = convo.turns[i];
        const a = convo.turns[i + 1];
        if (!q || !a) break;
        await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userText: q.text.slice(0, 499),
            avatarText: a.text.slice(0, 499),
            ...(convo.fromAvatarId ? { speakerAvatarId: convo.fromAvatarId, userOutput: 'video' } : {}),
            output: 'video',
            mode: 'chat',
          }),
        });
      }
      convo.renderedUrl = conv.liveUrl;
      saveConvos();
      return res.writeHead(200, headers).end(JSON.stringify({ liveUrl: conv.liveUrl, shareSlug: conv.shareSlug }));
    }

    const askMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/ask$/);
    if (req.method === 'POST' && (askMatch || url === '/api/ask')) {
      const slug = askMatch ? askMatch[1] : 'bible-kjv';
      return res.writeHead(200, headers).end(JSON.stringify(await ask(slug, data.question)));
    }
    if (req.method === 'POST' && url === '/api/render') {
      const t = token || SERVICE_TOKEN;
      if (!t) return res.writeHead(401, headers).end('{"error":"Masky bearer token required"}');
      const result = await render(data.question, t, {
        avatarId: data.avatarId ?? NARRATOR_AVATAR_ID,
        avatarOwnerUserId: data.avatarOwnerUserId ?? NARRATOR_OWNER,
        output: data.output,
        slug: data.slug,
      });
      return res.writeHead(200, headers).end(JSON.stringify(result));
    }
    res.writeHead(404, headers).end('{"error":"not found"}');
  } catch (e) {
    res.writeHead(500, headers).end(JSON.stringify({ error: e.message }));
  }
});
server.listen(PORT, () => console.log(`LivingBook API on :${PORT} — ${Object.keys(books).length} book(s)`));
