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
import { createRequire } from 'node:module';
import { pipeline } from '@xenova/transformers';
import { createStore, createVectorStore } from './store.mjs';
import { createAudiobooks } from './audiobook.mjs';
const { PDFParse } = createRequire(import.meta.url)('pdf-parse');

const PORT = process.env.PORT ?? 8787;
const SERVICE_TOKEN = process.env.MASKY_SERVICE_TOKEN;
const NARRATOR_AVATAR_ID = process.env.MASKY_NARRATOR_AVATAR_ID;
const NARRATOR_OWNER = process.env.MASKY_NARRATOR_OWNER;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // admin ops on ownerless books (bible-kjv)
const MASKY = 'https://masky.ai/api';
const SCORE_THRESHOLD = 0.35;

const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const DATA_DIR = new URL('./local_data', import.meta.url).pathname;
const store = await createStore(DATA_DIR);
const vectors = await createVectorStore(store);

const convos = await store.load('convos', {});
const saveConvos = () => store.save('convos', convos);

// VoiceCert demo gate: production liveness attestation isn't live yet, so this
// mints demo sessions the recording flow requires before any spoken ingestion.
const voicecertSessions = new Map();
// Mobile pairing: web session mints a short code; the app claims it once for
// the same Masky SSO token (device-code pattern; Expo Go can't take an https
// OAuth redirect).
const pairCodes = new Map();
const follows = await store.load('follows', {});
const saveFollows = () => store.save('follows', follows);

const books = await store.load('books', {
  'bible-kjv': {
    slug: 'bible-kjv',
    title: 'The Holy Bible (KJV)',
    author: 'Public Domain',
    ownerSub: null,
    units: 2769,
    nextId: 100000,
    createdAt: 0,
  },
});
for (const b of Object.values(books)) b.visibility ??= 'public';
const saveBooks = () => store.save('books', books);
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
  else if (p.source_type === 'qa') frame = `A reader once asked me this, and I said: `;
  else if (p.source_type === 'spoken') frame = `I spoke these words myself, on the record${p.voicecert ? ' — VoiceCert-attested' : ''}: `;
  else if (book.slug === 'bible-kjv') frame = `Hear the word, from ${p.ref}: `;
  else frame = `In ${book.title.toUpperCase()}, I wrote: `;
  let quote = '';
  for (const s of clean.match(/[^.;!?]+[.;!?]*\s*/g) ?? [clean]) {
    if (frame.length + quote.length + s.length > 490) break;
    quote += s;
  }
  return frame + (quote.trim() || clean.slice(0, 490 - frame.length));
}

async function ask(slug, question, minScore = SCORE_THRESHOLD) {
  const book = books[slug];
  if (!book) throw new Error(`unknown book: ${slug}`);
  const vector = await embedText(question);
  const results = await vectors.search(slug, vector, 5);
  const passages = results
    .filter((r) => r.score >= minScore)
    .map((r) => {
      const p = { ...r.payload, score: r.score };
      // Filenames must never surface: any unit whose stored title looks like a
      // file (legacy uploads) is treated as book text titled by the BOOK TITLE.
      if (slug !== 'bible-kjv' && typeof p.text === 'string') {
        // PDF footnote markers glued to punctuation ("psychiatrist.18 None") —
        // extraction artifacts, not the author's words. Strip on the way out.
        p.text = p.text.replace(/(?<=[a-zA-Z][.!?;:,\u201d")\u2019])\d{1,3}(?=\s|$)/g, '');
      }
      const fileLike = /\.(pdf|docx?|txt|md|epub)\s*$/i.test(p.source_title ?? '');
      if ((p.source_type === 'book' || fileLike) && slug !== 'bible-kjv') {
        if (fileLike) p.source_type = 'book';
        delete p.source_title;
        const part = String(p.ref ?? '').match(/§\d+$/)?.[0] ?? '';
        p.ref = `${book.title.toUpperCase()}${part ? ' ' + part : ''}`;
      }
      return p;
    });
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

// News-tab grounded reasoning via llmChat (Bedrock by default): the model may reason
// freely about RELEVANCE, but every quote must be one of the retrieved verbatim
// units — enforced by substring post-check. Real related links come from a live
// news search, so references are real, never invented.
const reasonCache = new Map();
async function newsReason(slug, story) {
  const key = `${slug}~${story}`;
  if (reasonCache.has(key)) return reasonCache.get(key);
  const book = books[slug];
  if (!book) throw new Error(`unknown book: ${slug}`);
  // Hybrid retrieval: embed the raw story AND an
  // LLM-reformulated thematic query (headlines full of proper nouns embed
  // poorly against a timeless corpus), then merge by best score.
  const reform = await llmChat([
    {
      role: 'user',
      content: `Rewrite this news story as a short search query of timeless universal themes (no proper nouns, no dates), the way a concordance would index it. Reply with the query only.\nStory: ${story}`,
    },
  ], 60).catch(() => null);
  const essence = reform?.content?.replace(/^"|"$/g, '') || story;
  const a = await ask(slug, story, 0.22);
  const b = await ask(slug, essence, 0.22);
  const bestByRef = new Map();
  for (const p of [...a.passages, ...b.passages]) {
    if (!bestByRef.has(p.ref) || bestByRef.get(p.ref).score < p.score) bestByRef.set(p.ref, p);
  }
  const passages = [...bestByRef.values()].sort((x, y) => y.score - x.score).slice(0, 3);
  const q = encodeURIComponent(story.split(' - ')[0].slice(0, 80));
  const relatedRss = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`)
    .then((r) => r.text())
    .catch(() => '');
  const related = [...relatedRss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)]
    .slice(0, 3)
    .map((m) => ({ title: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(), link: m[2].trim() }));
  const norm = (s) => s.replace(/[“”"']/g, '').replace(/\s+/g, ' ').toLowerCase().trim();
  // Strip source-edition {margin notes} BEFORE the model sees the text, so the
  // verbatim it quotes is the verbatim we check against.
  for (const p of passages) p.text = p.text.replace(/\s*\{[^}]*\}/g, '');
  const cleanTexts = passages.map((p) => norm(p.text));
  const messages = [
    {
      role: 'system',
      content:
        `You are the reasoning voice of "${book.title}" on LivingBook's News tab. ` +
        `You receive a news story, verbatim passages from this book's knowledge base, and real related articles. ` +
        `Write 2-4 sentences of first-person reasoning connecting the book to the story. ` +
        `HARD RULES: do NOT use quotation marks and do NOT reproduce passage text — refer to passages ` +
        `by their ref only (e.g.: as Revelation 18:11-15 foresaw). The exact text is shown to the reader ` +
        `separately, verbatim. Never invent facts or sources; if the passages don't relate, say so honestly. ` +
        `You may mention one related article by its exact title. Plain text only, no markdown.`,
    },
    {
      role: 'user',
      content: JSON.stringify({ story, passages: passages.slice(0, 3), relatedArticles: related }),
    },
  ];
  let reasoning = null;
  let model = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const llmRes = await llmChat(messages, 600, { tier: 'smart' });
    const candidate = llmRes.content;
    if (!candidate) throw new Error(`llm reasoning failed (${LLM_PROVIDER})`);
    // No-invention post-check: the reasoner must not quote at all. Reject any
    // quotation-mark usage or any reproduced 40+char passage span.
    const quoted = [...candidate.matchAll(/[“"]([^”"]{12,})[”"]/g)].map((m) => m[1].trim());
    const violation =
      quoted.find((span) => !related.some((r) => norm(r.title).includes(norm(span)))) ??
      (cleanTexts.some((t) => {
        const c = norm(candidate);
        for (let i = 0; i + 40 <= t.length; i += 20) if (c.includes(t.slice(i, i + 40))) return true;
        return false;
      })
        ? 'reproduced passage text'
        : undefined);
    if (!violation) {
      reasoning = candidate;
      model = llmRes.model;
      break;
    }
    messages.push({ role: 'assistant', content: candidate });
    messages.push({
      role: 'user',
      content: `REJECTED (${String(violation).slice(0, 80)}): do not quote or reproduce any passage text — refer to passages by ref only. Rewrite.`,
    });
  }
  if (!reasoning) throw new Error('reasoning rejected twice: quotes not grounded in retrieved passages');
  const result = {
    reasoning,
    model,
    passages: passages.slice(0, 3).map(({ ref, text }) => ({ ref, text })),
    references: related,
  };
  reasonCache.set(key, result);
  return result;
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

// ── Scout: every book watches the world for its author ──────────────────────
const alerts = await store.load('alerts', {});
const saveAlerts = () => store.save('alerts', alerts);

// ── LLM provider: Bedrock Converse (default) or Pioneer (submission-era path) ──
// tier 'fast' = query reformulation / keyword work; 'smart' = user-facing prose.
const LLM_PROVIDER = process.env.LLM_PROVIDER ?? 'bedrock';
const BEDROCK_FAST = process.env.BEDROCK_MODEL_FAST ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const BEDROCK_SMART = process.env.BEDROCK_MODEL_SMART ?? 'us.anthropic.claude-sonnet-5';
let bedrock = null;
async function llmChat(messages, maxTokens = 300, { tier = 'fast' } = {}) {
  if (LLM_PROVIDER === 'bedrock') {
    const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
    bedrock ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const modelId = tier === 'smart' ? BEDROCK_SMART : BEDROCK_FAST;
    const system = messages.filter((m) => m.role === 'system').map((m) => ({ text: m.content }));
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: [{ text: m.content }] }));
    // No sampling params: Sonnet 5 rejects non-default temperature/top_p.
    const out = await bedrock.send(new ConverseCommand({
      modelId,
      ...(system.length ? { system } : {}),
      messages: turns,
      inferenceConfig: { maxTokens },
    }));
    return { content: out.output?.message?.content?.[0]?.text?.trim(), model: modelId };
  }
  const r = await fetch('https://api.pioneer.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PIONEER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.PIONEER_MODEL ?? 'claude-haiku-4-5', max_tokens: maxTokens, messages }),
  }).then((x) => x.json());
  return { content: r.choices?.[0]?.message?.content?.trim(), model: r.model };
}

async function guildSuggestReply(book, signal, passages) {
  try {
    const basic = Buffer.from(`${process.env.GUILD_TRIGGER_KEY_ID}:${process.env.GUILD_TRIGGER_KEY_SECRET}`).toString('base64');
    const input = {
      book: { id: book.slug, title: book.title },
      trends: [{ topic: signal.title, summary: signal.summary ?? signal.title, source: signal.url }],
      passages: passages.map((p) => ({ ref: p.ref, text: p.text })),
      budget: { dailyOutboundRemaining: 3, creditBudgetRemaining: 5 },
      engagementNotes: 'Scout mode: draft a REPLY to this specific post/paper, addressed to its author, grounded in the passages.',
    };
    const created = await fetch('https://app.guild.ai/api/workspaces/seth/livingbook/sessions', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_type: 'api_trigger', agent_input: { text: JSON.stringify(input) } }),
    }).then((r) => r.json());
    const sessionId = created.id ?? created.session_id;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const ev = await fetch(`https://app.guild.ai/api/sessions/${sessionId}/events`, {
        headers: { Authorization: `Basic ${basic}` },
      }).then((r) => r.json()).catch(() => null);
      const items = ev?.items ?? [];
      for (const e of items) {
        const d = e?.content?.data;
        if (typeof d === 'string' && d.includes('"decision"')) {
          const parsed = JSON.parse(d.replace(/^```(json)?|```$/g, '').trim());
          if (parsed.postText) return { reply: parsed.postText, via: 'guild', sessionId };
        }
      }
    }
  } catch { /* fall through to direct LLM drafting */ }
  const drafted = await llmChat([
    {
      role: 'system',
      content: `Draft a <=240-char reply to a post/paper on behalf of the author of "${book.title}". Ground it ONLY in the provided passages (refer to them, do not fabricate). Warm, specific, no hashtags.`,
    },
    { role: 'user', content: JSON.stringify({ signal, passages: passages.slice(0, 2) }) },
  ], 300, { tier: 'smart' });
  return { reply: drafted.content, via: LLM_PROVIDER };
}

async function scoutBook(slug) {
  const book = books[slug];
  if (!book) throw new Error(`unknown book: ${slug}`);
  const seed = `${book.title}. ${book.sampleText ?? ''}`.slice(0, 500);
  const STOP = new Set('the a an and or of to in on for with that this is are be as it its not we you i they when than then their our your from should would could'.split(' '));
  const keywordTerms = () => {
    const freq = new Map();
    for (const w of seed.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
      if (!STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w).join(' ');
  };
  let terms = (await llmChat([
    {
      role: 'user',
      content: `Reply with ONLY a search query, nothing else — 3 to 6 words, no quotes, no explanation — for finding literature related to:\n${seed}`,
    },
  ], 40).catch(() => null))?.content;
  terms = terms?.split('\n').filter((l) => l.trim()).pop()?.replace(/[*_#"'`]/g, '').trim();
  if (!terms || terms.split(/\s+/).length > 8) terms = keywordTerms();
  const candidates = [];
  // arXiv
  try {
    const xml = await fetch(
      `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(terms)}&max_results=6&sortBy=submittedDate&sortOrder=descending`,
    ).then((r) => r.text());
    for (const m of xml.matchAll(/<entry>[\s\S]*?<id>([\s\S]*?)<\/id>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<summary>([\s\S]*?)<\/summary>/g)) {
      candidates.push({ url: m[1].trim(), title: m[2].replace(/\s+/g, ' ').trim(), summary: m[3].replace(/\s+/g, ' ').slice(0, 400), source: 'arxiv' });
    }
  } catch { /* arxiv down — news still runs */ }
  // News
  try {
    const rss = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(terms)}&hl=en-US&gl=US&ceid=US:en`).then((r) => r.text());
    for (const m of [...rss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)].slice(0, 5)) {
      candidates.push({ url: m[2].trim(), title: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(), summary: '', source: 'news' });
    }
  } catch { /* ignore */ }
  // Direct mention hunt: the book's title or the author's name in the news.
  for (const phrase of [book.title.replace(/\s*\(.*\)$/, ''), book.author]) {
    if (!phrase || phrase === 'Public Domain') continue;
    try {
      const rss = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent('"' + phrase + '"')}&hl=en-US&gl=US&ceid=US:en`).then((r) => r.text());
      for (const m of [...rss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)].slice(0, 3)) {
        const t = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        if (t.toLowerCase().includes(phrase.toLowerCase())) {
          candidates.unshift({ url: m[2].trim(), title: t, summary: '', source: 'news', kind: 'mention', phrase });
        }
      }
    } catch { /* ignore */ }
  }
  const created = [];
  for (const c of candidates) {
    const key = `${slug}~${c.url}`;
    if (Object.values(alerts).some((a) => a.key === key)) continue;
    const { passages } = await ask(slug, `${c.title}. ${c.summary}`.slice(0, 400), 0.3);
    if (!passages.length && c.kind !== 'mention') continue;
    const suggestion = await guildSuggestReply(book, c, passages.slice(0, 3));
    if (!suggestion.reply) continue;
    const id = 'al_' + Math.random().toString(36).slice(2, 10);
    alerts[id] = {
      id,
      key,
      slug,
      kind: c.kind ?? 'related',
      bookTitle: book.title,
      signal: c,
      passage: passages[0]
        ? { ref: passages[0].ref, text: passages[0].text.replace(/\s*\{[^}]*\}/g, '') }
        : { ref: book.title.toUpperCase(), text: '' },
      score: passages[0]?.score ?? 1,
      suggestedReply: suggestion.reply,
      suggestedVia: suggestion.via,
      status: 'pending',
      createdAt: Date.now(),
    };
    created.push(alerts[id]);
    if (created.length >= 2) break; // cap per run — quality over volume
  }
  saveAlerts();
  return { terms, candidates: candidates.length, created };
}

// Hourly scout over every book (deduped by signal URL, so quiet when nothing
// new). Runs shortly after startup too — dev restarts kept resetting the old
// 1h timer so it never fired. Each sweep also logs a digest session to Guild,
// so the workspace shows an auditable hourly trail even on quiet hours.
async function scoutSweep(reason) {
  const summary = { reason, books: 0, candidates: 0, alertsCreated: 0 };
  for (const slug of Object.keys(books)) {
    try {
      const r = await scoutBook(slug);
      summary.books += 1;
      summary.candidates += r.candidates;
      summary.alertsCreated += r.created.length;
    } catch (e) {
      console.error('scout error', slug, e.message);
    }
  }
  console.log('scout sweep done:', JSON.stringify(summary));
  try {
    const basic = Buffer.from(`${process.env.GUILD_TRIGGER_KEY_ID}:${process.env.GUILD_TRIGGER_KEY_SECRET}`).toString('base64');
    await fetch('https://app.guild.ai/api/workspaces/seth/livingbook/sessions', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_type: 'api_trigger',
        agent_input: {
          text: JSON.stringify({
            book: { id: 'scout-digest', title: 'LivingBook Scout Digest' },
            trends: [{ topic: `Scout sweep (${reason}): ${summary.books} books, ${summary.candidates} candidates, ${summary.alertsCreated} new alerts`, summary: 'Review the sweep; output decision hold unless a strategy change is warranted.' }],
            passages: [],
            budget: { dailyOutboundRemaining: 0, creditBudgetRemaining: 0 },
            engagementNotes: 'Hourly digest — governance trail. dailyOutboundRemaining is 0: always hold.',
          }),
        },
      }),
    });
  } catch (e) {
    console.error('digest session failed:', e.message);
  }
}
setTimeout(() => scoutSweep('startup'), 3 * 60 * 1000);
setInterval(() => scoutSweep('hourly'), 3600 * 1000);

// ── Audiobooks ──────────────────────────────────────────────────────────────
const audiobooks = createAudiobooks({
  store,
  vectors,
  books,
  serviceToken: SERVICE_TOKEN,
  narrator: { avatarId: NARRATOR_AVATAR_ID, owner: NARRATOR_OWNER },
});
await audiobooks.ready;

// Owner of the book — or the admin token for ownerless/public-domain books.
async function audiobookAuthor(book, token, req) {
  if (ADMIN_TOKEN && req.headers['x-admin-token'] === ADMIN_TOKEN) return { admin: true, sub: null };
  const user = await maskyUser(token);
  if (user && book.ownerSub && user.sub === book.ownerSub) return { admin: false, sub: user.sub };
  return null;
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
      const user = await maskyUser(token);
      const mine = user ? (follows[user.sub] ?? []) : [];
      const list = Object.values(books)
        .filter((b) => b.visibility !== 'private' || (user && b.ownerSub === user.sub))
        .map(({ slug, title, author, units, authorAvatarId, avatarImage, ownerSub, visibility }) => ({
          slug, title, author, units, authorAvatarId, avatarImage, ownerSub, visibility,
          followed: mine.includes(slug),
        }));
      return res.writeHead(200, headers).end(JSON.stringify({ books: list }));
    }
    const followMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/follow$/);
    if (req.method === 'POST' && followMatch) {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      if (!books[followMatch[1]]) return res.writeHead(404, headers).end('{"error":"unknown book"}');
      const mine = (follows[user.sub] ??= []);
      const idx = mine.indexOf(followMatch[1]);
      if (idx === -1) mine.push(followMatch[1]);
      else mine.splice(idx, 1);
      saveFollows();
      return res.writeHead(200, headers).end(JSON.stringify({ followed: idx === -1 }));
    }
    const visMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/visibility$/);
    if (req.method === 'POST' && visMatch) {
      const book = books[visMatch[1]];
      if (!book) return res.writeHead(404, headers).end('{"error":"unknown book"}');
      const user = await maskyUser(token);
      if (!user || (book.ownerSub && user.sub !== book.ownerSub)) return res.writeHead(403, headers).end('{"error":"not your book"}');
      book.visibility = data.visibility === 'private' ? 'private' : 'public';
      saveBooks();
      return res.writeHead(200, headers).end(JSON.stringify({ ok: true, visibility: book.visibility }));
    }
    const avatarMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/avatar$/);
    if (req.method === 'POST' && avatarMatch) {
      const book = books[avatarMatch[1]];
      if (!book) return res.writeHead(404, headers).end('{"error":"unknown book"}');
      const user = await maskyUser(token);
      if (!user || (book.ownerSub && user.sub !== book.ownerSub)) {
        return res.writeHead(403, headers).end('{"error":"not your book"}');
      }
      book.authorAvatarId = data.avatarId ?? null;
      book.avatarOwner = data.avatarOwnerUserId ?? null;
      book.avatarImage = data.avatarImage ?? null;
      if (data.avatarName) book.author = data.avatarName;
      saveBooks();
      return res.writeHead(200, headers).end(JSON.stringify({ ok: true, book: { slug: book.slug, authorAvatarId: book.authorAvatarId } }));
    }
    if (req.method === 'GET' && url === '/api/news') {
      return res.writeHead(200, headers).end(JSON.stringify({ stories: await news() }));
    }
    if (req.method === 'POST' && url === '/api/news/reason') {
      if (!data.slug || !data.story) return res.writeHead(400, headers).end('{"error":"slug and story required"}');
      const reasoned = await newsReason(data.slug, data.story);
      return res.writeHead(200, headers).end(JSON.stringify(reasoned));
    }
    if (req.method === 'POST' && url === '/api/books') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      const title = String(data.title ?? '').trim();
      if (!title) return res.writeHead(400, headers).end('{"error":"title required"}');
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      if (books[slug]) return res.writeHead(409, headers).end('{"error":"book exists"}');
      await vectors.ensure(slug);
      books[slug] = {
        slug,
        title,
        author: data.authorName?.trim() || user.name,
        ownerSub: user.sub,
        authorAvatarId: data.avatarId ?? user.avatar_id ?? null,
        avatarOwner: data.avatarOwnerUserId ?? null,
        units: 0,
        nextId: 1,
        createdAt: Date.now(),
      };
      saveBooks();
      return res.writeHead(200, headers).end(JSON.stringify({ book: books[slug] }));
    }

    // ── Audiobook routes ────────────────────────────────────────────────────
    const abMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/audiobook(\/.*)?$/);
    if (abMatch) {
      const book = books[abMatch[1]];
      if (!book) return res.writeHead(404, headers).end('{"error":"unknown book"}');
      const slug = book.slug;
      const sub = (await maskyUser(token))?.sub ?? null;
      const author = await audiobookAuthor(book, token, req);
      const rest = abMatch[2] ?? '';

      if (req.method === 'GET' && rest === '') {
        await audiobooks.refresh(slug).catch(() => {});
        const view = audiobooks.publicView(audiobooks.get(slug), sub, Boolean(author));
        return res.writeHead(200, headers).end(JSON.stringify({ audiobook: view }));
      }
      if (req.method === 'POST' && rest === '/estimate') {
        if (!author) return res.writeHead(403, headers).end('{"error":"author only"}');
        return res.writeHead(200, headers).end(JSON.stringify({ estimate: await audiobooks.estimate(slug) }));
      }
      if (req.method === 'POST' && rest === '/normalize') {
        // One-time repair for pre-coercion uploads: units whose source_title is
        // a raw filename ARE the book text — retag them as such so audiobook
        // detection, estimates, and answer framing all treat them correctly.
        if (!author) return res.writeHead(403, headers).end('{"error":"author only"}');
        const r = await store.pool.query(
          "UPDATE units SET payload = payload || jsonb_build_object('source_type','book','source_title',$2::text) WHERE book_slug=$1 AND payload->>'source_title' ~* '\\.(pdf|docx?|txt|md|epub)\\s*$'",
          [slug, book.title],
        );
        return res.writeHead(200, headers).end(JSON.stringify({ normalized: r.rowCount }));
      }
      if (req.method === 'GET' && rest === '/sources') {
        // Author diagnostics: what's actually ingested, by source type + title.
        if (!author) return res.writeHead(403, headers).end('{"error":"author only"}');
        const r = await store.pool.query(
          "SELECT coalesce(payload->>'source_type','?') AS source_type, payload->>'source_title' AS source_title, count(*)::int AS units, sum(length(payload->>'text'))::bigint AS chars FROM units WHERE book_slug=$1 GROUP BY 1,2 ORDER BY 3 DESC",
          [slug],
        );
        return res.writeHead(200, headers).end(JSON.stringify({ sources: r.rows }));
      }
      if (req.method === 'POST' && rest === '/render') {
        if (!author) return res.writeHead(403, headers).end('{"error":"author only"}');
        if (data.dryRun) {
          // Detection preview: what chapters WOULD render — no conversation,
          // no turns, no credits spent.
          const chapters = await audiobooks.detectChapters(slug);
          return res.writeHead(200, headers).end(
            JSON.stringify({ dryRun: true, chapters, estimate: await audiobooks.estimate(slug) }),
          );
        }
        // Payment: rendering spends the author's Masky credits. Today the
        // service avatar renders (bills the service account); per-author
        // billing arrives with the authors' own `generate`-scoped tokens.
        const ab = await audiobooks.startRender(slug, {
          test: data.test !== false, // short-circuit: previews only, until full render ships
          release: data.release ?? 'free',
        });
        return res.writeHead(202, headers).end(JSON.stringify({ audiobook: audiobooks.publicView(ab, sub, true) }));
      }
      if (req.method === 'POST' && rest === '/settings') {
        if (!author) return res.writeHead(403, headers).end('{"error":"author only"}');
        const ab = audiobooks.setSettings(slug, { release: data.release, tribeUrl: data.tribeUrl });
        return res.writeHead(200, headers).end(JSON.stringify({ audiobook: audiobooks.publicView(ab, sub, true) }));
      }
      if (req.method === 'POST' && rest === '/grant') {
        if (!author) return res.writeHead(403, headers).end('{"error":"author only"}');
        if (!data.sub) return res.writeHead(400, headers).end('{"error":"sub required"}');
        audiobooks.grant(slug, data.sub, data.via ?? 'manual');
        return res.writeHead(200, headers).end('{"ok":true}');
      }
      if (req.method === 'GET' && rest === '/download') {
        if (!author) return res.writeHead(403, headers).end('{"error":"author only"}');
        return res.writeHead(200, headers).end(JSON.stringify(await audiobooks.downloadManifest(slug)));
      }
      const audioMatch = rest.match(/^\/chapter\/(\d+)\/audio$/);
      if (req.method === 'GET' && audioMatch) {
        const idx = Number(audioMatch[1]);
        const scope = (req.url.includes('scope=full') ? 'full' : 'preview');
        if (scope === 'full') {
          const access = audiobooks.canListenFull(audiobooks.get(slug), sub, Boolean(author));
          if (!access.ok) return res.writeHead(403, headers).end(JSON.stringify({ error: 'no access', release: access.why }));
        }
        try {
          return res.writeHead(200, headers).end(JSON.stringify(await audiobooks.chapterAudioUrl(slug, idx, scope)));
        } catch (e) {
          return res.writeHead(409, headers).end(JSON.stringify({ error: e.message }));
        }
      }
      return res.writeHead(404, headers).end('{"error":"unknown audiobook route"}');
    }

    const contentMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/content$/);
    if (req.method === 'POST' && contentMatch) {
      const book = books[contentMatch[1]];
      if (!book) return res.writeHead(404, headers).end('{"error":"unknown book"}');
      const user = await maskyUser(token);
      if (!user || (book.ownerSub && user.sub !== book.ownerSub)) {
        return res.writeHead(403, headers).end('{"error":"not your book"}');
      }
      let { title = 'untitled', sourceType = 'book', text, voicecertSessionId } = data;
      if (!text && data.pdfBase64) {
        const parser = new PDFParse({ data: Buffer.from(data.pdfBase64, 'base64') });
        const parsed = await parser.getText();
        await parser.destroy();
        text = (parsed.text ?? '').replace(/\u0000/g, ' ');
      }
      if (!text || text.length < 40) return res.writeHead(400, headers).end('{"error":"text too short (or PDF had no extractable text)"}');
      let voicecert = null;
      if (sourceType === 'spoken') {
        const vc = voicecertSessions.get(voicecertSessionId);
        if (!vc || vc.sub !== user.sub) {
          return res.writeHead(403, headers).end('{"error":"spoken content requires a VoiceCert-attested session — authenticate first"}');
        }
        voicecert = { sessionId: voicecertSessionId, method: vc.method, attestedAt: vc.issuedAt };
      }
      // A PDF (or file-named) upload IS the book text, whatever the dropdown
      // said — coerce so audiobook detection and framing treat it as the book.
      if (data.pdfBase64 || /\.(pdf|docx?|txt|md|epub)\s*$/i.test(title)) sourceType = 'book';
      if (sourceType === 'book') title = book.title;
      const chunks = chunkText(text, title);
      const points = [];
      for (const c of chunks) {
        points.push({
          id: book.nextId++,
          vector: await embedText(c.text),
          payload: { source_type: sourceType, source_title: title, ref: c.ref, text: c.text, ...(voicecert ? { voicecert } : {}) },
        });
      }
      await vectors.upsert(book.slug, points);
      book.units += points.length;
      if (!book.sampleText) book.sampleText = text.slice(0, 400);
      saveBooks();
      return res.writeHead(200, headers).end(JSON.stringify({ ok: true, unitsAdded: points.length, totalUnits: book.units }));
    }

    if (req.method === 'POST' && url === '/api/pair/start') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      pairCodes.set(code, { token, exp: Date.now() + 10 * 60 * 1000 });
      return res.writeHead(200, headers).end(JSON.stringify({ code, expiresInSec: 600 }));
    }
    if (req.method === 'POST' && url === '/api/pair/claim') {
      const entry = pairCodes.get(String(data.code ?? '').toUpperCase());
      if (!entry || entry.exp < Date.now()) return res.writeHead(404, headers).end('{"error":"invalid or expired code"}');
      pairCodes.delete(String(data.code).toUpperCase());
      const user = await maskyUser(entry.token);
      return res.writeHead(200, headers).end(JSON.stringify({ accessToken: entry.token, user }));
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
      if (books[slug].visibility === 'private' && books[slug].ownerSub !== user.sub) {
        return res.writeHead(403, headers).end('{"error":"this book is private"}');
      }
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

    if (req.method === 'GET' && url.startsWith('/api/talk/history')) {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      const slug = new URL(req.url, 'http://x').searchParams.get('slug');
      const convo = convos[`${user.sub}~${slug}`];
      return res.writeHead(200, headers).end(JSON.stringify({ turns: convo?.turns ?? [], renderUrl: convo?.visitorRenderUrl ?? null }));
    }
    if (req.method === 'POST' && url === '/api/talk/render-turn') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      const convo = convos[`${user.sub}~${data.slug}`];
      const turn = convo?.turns?.[data.index];
      if (!turn || turn.who !== 'agent') return res.writeHead(404, headers).end('{"error":"no such agent turn"}');
      const book = books[convo.slug];
      const conv = await fetch(`${MASKY}/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: book.authorAvatarId ?? NARRATOR_AVATAR_ID,
          avatarOwnerUserId: book.avatarOwner ?? NARRATOR_OWNER,
        }),
      }).then((r) => r.json());
      if (!conv.conversationId) throw new Error(`conversation failed: ${JSON.stringify(conv).slice(0, 200)}`);
      await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: turn.text.slice(0, 499), mode: 'speak', output: 'video' }),
      });
      turn.renderUrl = conv.liveUrl;
      saveConvos();
      return res.writeHead(200, headers).end(JSON.stringify({ liveUrl: conv.liveUrl }));
    }
    if (req.method === 'POST' && url === '/api/talk/render') {
      const user = await maskyUser(token);
      if (!user) return res.writeHead(401, headers).end('{"error":"Login with Masky required"}');
      const convo = convos[`${user.sub}~${data.slug}`];
      if (!convo || convo.turns.length === 0) return res.writeHead(404, headers).end('{"error":"no conversation yet"}');
      const book = books[convo.slug];
      // Rendered on the VISITOR's own token — their credits, their share link.
      const conv = await fetch(`${MASKY}/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: book.authorAvatarId ?? NARRATOR_AVATAR_ID,
          avatarOwnerUserId: book.avatarOwner ?? NARRATOR_OWNER,
        }),
      }).then((r) => r.json());
      if (!conv.conversationId) throw new Error(`conversation failed: ${JSON.stringify(conv).slice(0, 200)}`);
      const recent = convo.turns.slice(-6);
      for (let i = 0; i < recent.length; i += 2) {
        const q = recent[i];
        const a = recent[i + 1];
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
      convo.visitorRenderUrl = conv.liveUrl;
      saveConvos();
      return res.writeHead(200, headers).end(JSON.stringify({ liveUrl: conv.liveUrl, shareSlug: conv.shareSlug }));
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

    if (req.method === 'POST' && url === '/api/scout/run') {
      const result = await scoutBook(data.slug);
      return res.writeHead(200, headers).end(JSON.stringify(result));
    }
    if (req.method === 'GET' && (url === '/api/alerts' || url.startsWith('/api/alerts?'))) {
      const all = url.includes('all=1');
      let mine = Object.values(alerts).filter((a) => a.status !== 'dismissed');
      if (!all) {
        const user = await maskyUser(token);
        if (!user) return res.writeHead(401, headers).end('{"error":"auth required (or ?all=1 demo mode)"}');
        mine = mine.filter((a) => books[a.slug]?.ownerSub === user.sub);
      }
      mine.sort((a, b) => b.createdAt - a.createdAt);
      return res.writeHead(200, headers).end(JSON.stringify({ alerts: mine.slice(0, 20) }));
    }
    const oneAlert = url.match(/^\/api\/alerts\/([a-z0-9_]+)$/);
    if (req.method === 'GET' && oneAlert) {
      const alert = alerts[oneAlert[1]];
      if (!alert) return res.writeHead(404, headers).end('{"error":"unknown alert"}');
      return res.writeHead(200, headers).end(JSON.stringify({ alert }));
    }
    const dismissMatch = url.match(/^\/api\/alerts\/([a-z0-9_]+)\/dismiss$/);
    if (req.method === 'POST' && dismissMatch) {
      const alert = alerts[dismissMatch[1]];
      if (!alert) return res.writeHead(404, headers).end('{"error":"unknown alert"}');
      alert.status = 'dismissed';
      saveAlerts();
      return res.writeHead(200, headers).end('{"ok":true}');
    }
    const approveMatch = url.match(/^\/api\/alerts\/([a-z0-9_]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) {
      const alert = alerts[approveMatch[1]];
      if (!alert) return res.writeHead(404, headers).end('{"error":"unknown alert"}');
      const book = books[alert.slug];
      const t = token || SERVICE_TOKEN;
      if (data.mode === 'text') {
        alert.status = 'approved';
        alert.finalReply = `${(data.reply ?? alert.suggestedReply).trim()} — ask my book anything: https://livingbook.masky.ai/b/${alert.slug}`;
        saveAlerts();
        return res.writeHead(200, headers).end(JSON.stringify({ finalReply: alert.finalReply }));
      }
      // Render the exact turn: the book speaks its matched passage, on-platform.
      const conv = await fetch(`${MASKY}/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: book.authorAvatarId ?? NARRATOR_AVATAR_ID,
          avatarOwnerUserId: book.avatarOwner ?? NARRATOR_OWNER,
        }),
      }).then((r) => r.json());
      const spoken = frameFor(book, { ...alert.passage, source_type: 'book' });
      await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: spoken.slice(0, 499), mode: 'speak', output: 'video' }),
      });
      alert.status = 'approved';
      alert.finalReply = `${(data.reply ?? alert.suggestedReply).trim()} — hear my book answer: ${conv.liveUrl} · ask it anything: https://livingbook.masky.ai`;
      alert.turnLiveUrl = conv.liveUrl;
      saveAlerts();
      return res.writeHead(200, headers).end(JSON.stringify({ finalReply: alert.finalReply, turnLiveUrl: conv.liveUrl }));
    }

    const askMatch = url.match(/^\/api\/books\/([a-z0-9-]+)\/ask$/);
    if (req.method === 'POST' && (askMatch || url === '/api/ask')) {
      const slug = askMatch ? askMatch[1] : 'bible-kjv';
      const answer = await ask(slug, data.question);
      return res.writeHead(200, headers).end(JSON.stringify(answer));
    }
    if (req.method === 'POST' && url === '/api/render') {
      const t = token || SERVICE_TOKEN;
      if (!t) return res.writeHead(401, headers).end('{"error":"Masky bearer token required"}');
      const bookForRender = data.slug ? books[data.slug] : null;
      const result = await render(data.question, t, {
        avatarId: data.avatarId ?? bookForRender?.authorAvatarId ?? NARRATOR_AVATAR_ID,
        avatarOwnerUserId: data.avatarOwnerUserId ?? bookForRender?.avatarOwner ?? NARRATOR_OWNER,
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
