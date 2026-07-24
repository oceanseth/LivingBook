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
  const spoken = `Hear the word, from ${top.ref}: ${top.text}`;
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
  const turn = await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userText: answer.spoken, mode: 'speak', output }),
  }).then((r) => r.json());
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
      return res.writeHead(200, headers).end(JSON.stringify(await ask(data.question)));
    }
    if (req.url === '/api/render') {
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      if (!token) return res.writeHead(401, headers).end('{"error":"Masky bearer token required"}');
      return res.writeHead(200, headers).end(JSON.stringify(await render(data.question, token, data)));
    }
    res.writeHead(404, headers).end('{"error":"not found"}');
  } catch (e) {
    res.writeHead(500, headers).end(JSON.stringify({ error: e.message }));
  }
});
server.listen(PORT, () => console.log(`LivingBook ask server on :${PORT}`));
