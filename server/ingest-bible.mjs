#!/usr/bin/env node
// Ingest the KJV Bible into the vector store as verbatim source units.
// Chunks are 5-verse windows; the payload keeps the EXACT text plus verse
// provenance so answers can quote byte-identical passages (no-invention rule).
//
// A high-question-volume subset is ingested by default (Genesis, Psalms,
// Proverbs + the New Testament); pass --all to ingest everything.
//
// Usage: node server/ingest-bible.mjs [--all] [path/to/en_kjv.json]
import { readFileSync } from 'node:fs';
import { createVectorStore } from './store.mjs';
import { pipeline } from '@xenova/transformers';

const SLUG = 'bible-kjv';
const DIM = 384; // all-MiniLM-L6-v2
const WINDOW = 5;
const SUBSET = new Set([
  'Genesis', 'Psalms', 'Proverbs',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
]);

const all = process.argv.includes('--all');
const jsonPath = process.argv.filter((a) => a.endsWith('.json'))[0]
  ?? new URL('../local_data/en_kjv.json', import.meta.url).pathname;

const bible = JSON.parse(readFileSync(jsonPath, 'utf8').replace(/^﻿/, ''));

// Build 5-verse chunks with provenance.
const chunks = [];
for (const book of bible) {
  const bookName = book.name;
  if (!all && !SUBSET.has(bookName)) continue;
  book.chapters.forEach((verses, ci) => {
    for (let v = 0; v < verses.length; v += WINDOW) {
      const slice = verses.slice(v, v + WINDOW);
      chunks.push({
        text: slice.join(' '),
        book: bookName,
        chapter: ci + 1,
        verse_start: v + 1,
        verse_end: v + slice.length,
        ref: `${bookName} ${ci + 1}:${v + 1}-${v + slice.length}`,
      });
    }
  });
}
console.log(`chunking done: ${chunks.length} chunks (${all ? 'full bible' : 'subset'})`);

const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
async function embedText(text) {
  const out = await embed(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

const vectors = await createVectorStore();

const BATCH = 64;
let done = 0;
for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const points = [];
  for (const [j, c] of batch.entries()) {
    points.push({
      id: i + j + 1,
      vector: await embedText(c.text),
      payload: { source_type: 'book', ...c },
    });
  }
  await vectors.upsert(SLUG, points);
  done += batch.length;
  if (done % 512 < BATCH) console.log(`upserted ${done}/${chunks.length}`);
}
console.log(`ingest complete: ${done} verbatim units in ${SLUG}`);
