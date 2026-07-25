#!/usr/bin/env node
// One full marketing-agent run: live news feed → vector retrieval → Guild-governed
// decision (versioned agent) → Masky speak-mode video + draft post.
//
// Usage: node --env-file=../.env marketing-run.mjs
// Requires: ask server on :8787, `guild` CLI authenticated, MASKY_SERVICE_TOKEN.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ASK = 'http://localhost:8787';
const MASKY = 'https://masky.ai/api';
const AGENT = 'seth~livingbook-marketing';
const WORKSPACE = 'seth~livingbook';

// 1. Shared story feed — top headlines (Google News RSS; X trends slot in here later)
const rss = await fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en').then((r) => r.text());
const titles = [...rss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
  .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim())
  .slice(0, 5);
console.log('trends:', titles.map((t) => `\n  - ${t}`).join(''));

// 2. Retrieve candidate verbatim passages per trend from the vector store
const trends = [];
const passages = [];
for (const topic of titles.slice(0, 3)) {
  const res = await fetch(`${ASK}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: `What does the Bible say about: ${topic}` }),
  }).then((r) => r.json());
  trends.push({ topic, summary: topic, source: 'news.google.com' });
  for (const p of (res.passages ?? []).slice(0, 2)) {
    passages.push({ ref: p.ref, text: p.text, score: p.score });
  }
}
console.log(`retrieved ${passages.length} candidate passages`);

// 3. Ask the Guild-governed agent for the campaign decision
const input = {
  book: { id: 'bible-kjv', title: 'The Holy Bible (KJV)', voice: 'reverent, exact, King James English' },
  trends,
  passages,
  budget: { dailyOutboundRemaining: 3, creditBudgetRemaining: 5 },
  engagementNotes: 'First run — no engagement history yet.',
};
const basic = Buffer.from(
  `${process.env.GUILD_TRIGGER_KEY_ID}:${process.env.GUILD_TRIGGER_KEY_SECRET}`,
).toString('base64');
const createdRes = await fetch('https://app.guild.ai/api/workspaces/seth/livingbook/sessions', {
  method: 'POST',
  headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_type: 'api_trigger', agent_input: { text: JSON.stringify(input) } }),
});
const created = await createdRes.json();
if (!createdRes.ok) throw new Error(`session create failed (${createdRes.status}): ${JSON.stringify(created).slice(0, 300)}`);
const sessionId = created.id ?? created.session_id ?? created.session?.id;
console.log('guild session:', sessionId);

let decision = null;
for (let i = 0; i < 30 && !decision; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const { stdout } = await exec('guild', ['--mode', 'json', '--quiet', 'session', 'events', sessionId]);
  const events = JSON.parse(stdout);
  for (const e of (events.items ?? events)) {
    const data = e?.content?.data;
    if (typeof data === 'string' && data.includes('"decision"')) {
      try { decision = JSON.parse(data.replace(/^```(json)?|```$/g, '').trim()); } catch { /* partial */ }
    }
  }
}
if (!decision) throw new Error('no decision from Guild agent after 150s — check guild session events');
console.log('decision:', decision.decision, '| trend:', decision.selectedTrend, '| passage:', decision.selectedPassageRef);
console.log('rationale:', decision.rationale);
console.log('post:', decision.postText);

// 4. Verbatim post-check: the spoken quote must be grounded in a candidate passage
const grounded = passages.some((p) => decision.videoScript?.spoken?.includes(p.text.replace(/\s*\{[^}]*\}/g, '').slice(0, 80)));
if (decision.decision === 'post' && !grounded) {
  console.error('REJECTED: spoken script is not grounded in a retrieved passage — not rendering.');
  process.exit(1);
}

// 5. Render via Masky speak mode on the narrator (service identity)
if (decision.decision === 'post') {
  const token = process.env.MASKY_SERVICE_TOKEN;
  const conv = await fetch(`${MASKY}/conversations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarId: process.env.MASKY_NARRATOR_AVATAR_ID,
      avatarOwnerUserId: process.env.MASKY_NARRATOR_OWNER,
    }),
  }).then((r) => r.json());
  const turn = await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userText: decision.videoScript.spoken.slice(0, 499), mode: 'speak', output: 'video' }),
  }).then((r) => r.json());
  console.log('rendering:', conv.liveUrl);
  console.log('turn:', turn.turn?.id, turn.turn?.status ?? turn.error);
} else {
  console.log('agent chose to hold — no render.');
}
