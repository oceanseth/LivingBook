#!/usr/bin/env node
// Append a record to llm-turn-history.jsonl (open-session-jsonl v0.3).
// Append-only by design: never reads the file, per the Open Session License.
//
// Usage:
//   node scripts/append-turn.mjs <speakerAbbrev> < turn.txt      # message record
//   node scripts/append-turn.mjs --raw '<json>'                  # arbitrary record (header/session/identity)
// Optional: -x "<summary of tool activity>" on model turns.
import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const HISTORY = new URL('../llm-turn-history.jsonl', import.meta.url).pathname;
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid(now = Date.now()) {
  let time = '';
  for (let i = 9, t = now; i >= 0; i--, t = Math.floor(t / 32)) time = B32[t % 32] + time;
  let rand = '';
  for (const b of randomBytes(16)) rand += B32[b % 32];
  return time + rand.slice(0, 16);
}

const args = process.argv.slice(2);
let record;
if (args[0] === '--raw') {
  record = JSON.parse(args[1]);
} else {
  const speaker = args[0];
  if (!speaker) {
    console.error('usage: append-turn.mjs <speakerAbbrev> [-x "tool summary"] < turn.txt');
    process.exit(1);
  }
  const xIdx = args.indexOf('-x');
  const text = (await import('node:fs')).readFileSync(0, 'utf8').replace(/\n$/, '');
  record = { id: ulid(), m: speaker, t: text, ts: new Date().toISOString() };
  if (xIdx !== -1) record.x = args[xIdx + 1];
}
appendFileSync(HISTORY, JSON.stringify(record) + '\n');
