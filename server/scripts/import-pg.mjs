#!/usr/bin/env node
// Import exported vectors + JSON app state into the livingbook Postgres.
// Usage (through the port-forward):
//   PGHOST=127.0.0.1 PGPORT=15432 PGPASSWORD=... node scripts/import-pg.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 15432),
  user: process.env.PGUSER ?? 'livingbook',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? 'livingbook',
  ssl: { rejectUnauthorized: false },
});

// app state
for (const key of ['books', 'alerts', 'convos', 'follows']) {
  const f = `local_data/${key}.json`;
  if (!existsSync(f)) continue;
  const v = readFileSync(f, 'utf8');
  await pool.query(
    'INSERT INTO app_state (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v=$2, updated_at=now()',
    [key, v],
  );
  console.log('state:', key, 'ok');
}

// vectors
const toVec = (v) => `[${v.join(',')}]`;
for (const file of readdirSync('local_data/export')) {
  const slug = file.replace(/\.jsonl$/, '');
  const lines = readFileSync(`local_data/export/${file}`, 'utf8').trim().split('\n');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const line of lines) {
      const p = JSON.parse(line);
      await client.query(
        'INSERT INTO units (book_slug, id, embedding, payload) VALUES ($1,$2,$3,$4) ON CONFLICT (book_slug,id) DO UPDATE SET embedding=$3, payload=$4',
        [slug, p.id, toVec(p.vector), JSON.stringify(p.payload)],
      );
    }
    await client.query('COMMIT');
    console.log('vectors:', slug, lines.length);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('FAILED', slug, e.message);
  } finally {
    client.release();
  }
}
const c = await pool.query('SELECT book_slug, count(*) FROM units GROUP BY 1 ORDER BY 1');
console.table(c.rows);
await pool.end();
