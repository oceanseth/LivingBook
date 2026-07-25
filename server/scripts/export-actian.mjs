#!/usr/bin/env node
// Export every book's points (id, vector, payload) from the local Actian
// container to JSONL files — input for import-pg.mjs. Run from repo root.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { VectorAIClient } from '@actian/vectorai-client';

const client = new VectorAIClient('localhost:6574', { restUrl: 'http://localhost:6573' });
const books = JSON.parse(readFileSync('local_data/books.json', 'utf8'));
mkdirSync('local_data/export', { recursive: true });

for (const slug of Object.keys(books)) {
  const rows = [];
  let offset = undefined;
  for (;;) {
    const page = await client.points.scroll(`book_${slug}`, {
      limit: 256,
      offset,
      withPayload: true,
      withVectors: true,
    });
    for (const point of page.points ?? []) {
      rows.push(JSON.stringify({ id: point.id, vector: point.vector?.data ?? point.vector, payload: point.payload }));
    }
    if (page.nextPageOffset == null) break;
    offset = page.nextPageOffset;
  }
  writeFileSync(`local_data/export/${slug}.jsonl`, rows.join('\n') + '\n');
  console.log(slug, rows.length, 'points');
}
