#!/usr/bin/env node
// LivingBook ask server — the no-invention answer pipeline.
//
// POST /api/ask { question }
//   → embeds the question, retrieves verbatim units from Actian VectorAI,
//     and returns exact passages with provenance. The connective frame is
//     assembled from templates; the quoted text is byte-identical payload text.
//
// POST /api/render { question, avatarId, output }  (Authorization: Bearer <user's Masky SSO token, generate scope>)
//   → runs /api/ask, then renders the answer through Masky in `speak` mode
//     (verbatim, no LLM rewrite) on the caller's credits. Returns the turn's
//     live/share URLs for embed + one-tap reshare.
import { createServer } from 'node:http';
import { VectorAIClient } from '@actian/vectorai-client';
import { pipeline } from '@xenova/transformers';

const PORT = process.env.PORT ?? 8787;
// Service identity (run with: node --env-file=../.env server.mjs). When set,
// /api/render works without a caller token, billing the client owner.
const SERVICE_TOKEN = process.env.MASKY_SERVICE_TOKEN;
const NARRATOR_AVATAR_ID = process.env.MASKY_NARRATOR_AVATAR_ID;
const NARRATOR_OWNER = process.env.MASKY_NARRATOR_OWNER;
const COLLECTION = 'book_bible-kjv';
const SCORE_THRESHOLD = 0.35; // below this we honestly say the book doesn't cover it
const MASKY = 'https://masky.ai/api';

const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const client = new VectorAIClient('localhost:6574', { restUrl: 'http://localhost:6573' });

async function ask(question) {
  const out = await embed(question, { pooling: 'mean', normalize: true });
  const results = await client.points.search(COLLECTION, Array.from(out.data), {
    limit: 5,
    withPayload: true,
  });
  const passages = results
    .filter((r) => r.score >= SCORE_THRESHOLD)
    .map((r) => ({ ref: r.payload.ref, text: r.payload.text, score: r.score }));
  if (passages.length === 0) {
    return { covered: false, spoken: 'The scriptures I hold do not speak directly to that question.', passages: [] };
  }
  const top = passages[0];
  // Connective frame only — the quote itself is the stored verbatim text.
  // Strip the source edition's {translator margin notes}, and trim to Masky's
  // 500-char userText cap at sentence boundaries (never mid-verse).
  const frame = `Hear the word, from ${top.ref}: `;
  const clean = top.text.replace(/\s*\{[^}]*\}/g, '');
  let quote = '';
  for (const sentence of clean.match(/[^.;!?]+[.;!?]*\s*/g) ?? [clean]) {
    if (frame.length + quote.length + sentence.length > 495) break;
    quote += sentence;
  }
  const spoken = frame + (quote.trim() || clean.slice(0, 495 - frame.length));
  return { covered: true, spoken, passages };
}

async function render(question, token, { avatarId, avatarOwnerUserId, output = 'video' }) {
  const answer = await ask(question);
  const conv = await fetch(`${MASKY}/conversations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarId, avatarOwnerUserId }),
  }).then((r) => r.json());
  if (!conv.conversationId) throw new Error(`conversation failed: ${JSON.stringify(conv)}`);
  const turnRes = await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userText: answer.spoken, mode: 'speak', output }),
  });
  const turn = await turnRes.json();
  if (!turnRes.ok || !turn.turn) throw new Error(`turn failed (${turnRes.status}): ${JSON.stringify(turn).slice(0, 300)}`);
  return { ...answer, conversation: { id: conv.conversationId, liveUrl: conv.liveUrl, shareSlug: conv.shareSlug }, turn: turn.turn };
}

const server = createServer(async (req, res) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return res.writeHead(204, headers).end();
  if (req.method !== 'POST') return res.writeHead(405, headers).end('{"error":"POST only"}');
  let body = '';
  for await (const c of req) body += c;
  try {
    const data = JSON.parse(body || '{}');
    if (req.url === '/api/ask') {
      const result = await ask(data.question);
      return res.writeHead(200, headers).end(JSON.stringify(result));
    }
    if (req.url === '/api/render') {
      const callerToken = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      const token = callerToken || SERVICE_TOKEN;
      if (!token) return res.writeHead(401, headers).end('{"error":"Masky bearer token required"}');
      const result = await render(data.question, token, {
        avatarId: data.avatarId ?? NARRATOR_AVATAR_ID,
        avatarOwnerUserId: data.avatarOwnerUserId ?? NARRATOR_OWNER,
        output: data.output,
      });
      return res.writeHead(200, headers).end(JSON.stringify(result));
    }
    res.writeHead(404, headers).end('{"error":"not found"}');
  } catch (e) {
    res.writeHead(500, headers).end(JSON.stringify({ error: e.message }));
  }
});
server.listen(PORT, () => console.log(`LivingBook ask server on :${PORT}`));
