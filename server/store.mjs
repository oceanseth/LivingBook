// Storage backends. STORE=file (default, local dev) keeps today's JSON files;
// STORE=pg persists the same shapes as JSONB rows in Postgres. VECTOR_STORE
// likewise selects Actian (local Docker) or pgvector on RDS. Server code sees
// one tiny interface either way.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function fileStore(dir) {
  const path = (k) => `${dir}/${k}.json`;
  return {
    async load(k, fallback) {
      return existsSync(path(k)) ? JSON.parse(readFileSync(path(k), 'utf8')) : fallback;
    },
    async save(k, v) {
      writeFileSync(path(k), JSON.stringify(v, null, 1));
    },
  };
}

async function pgPool() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'livingbook',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE ?? 'livingbook',
    max: 5,
    ssl: { rejectUnauthorized: false },
  });
  await pool.query('SELECT 1');
  return pool;
}

async function pgStore() {
  const pool = await pgPool();
  return {
    pool,
    async load(k, fallback) {
      const r = await pool.query('SELECT v FROM app_state WHERE k=$1', [k]);
      return r.rows[0]?.v ?? fallback;
    },
    async save(k, v) {
      await pool
        .query(
          'INSERT INTO app_state (k, v, updated_at) VALUES ($1, $2, now()) ON CONFLICT (k) DO UPDATE SET v=$2, updated_at=now()',
          [k, JSON.stringify(v)],
        )
        .catch((e) => console.error('store.save failed', k, e.message));
    },
  };
}

export async function createStore(dir) {
  return (process.env.STORE ?? 'file') === 'pg' ? pgStore() : fileStore(dir);
}

// ── vectors ──────────────────────────────────────────────────────────────────
// Both backends return search hits as [{ score, payload }] with cosine
// similarity scores, so retrieval thresholds are backend-independent.

async function actianVectors() {
  const { VectorAIClient } = await import('@actian/vectorai-client');
  const client = new VectorAIClient('localhost:6574', { restUrl: 'http://localhost:6573' });
  return {
    async ensure(slug) {
      try {
        await client.collections.create(`book_${slug}`, { dimension: 384, distanceMetric: 'COSINE' });
      } catch {
        /* exists */
      }
    },
    async upsert(slug, points) {
      await client.points.upsert(`book_${slug}`, points);
    },
    async search(slug, vector, limit) {
      return client.points.search(`book_${slug}`, vector, { limit, withPayload: true });
    },
  };
}

async function pgVectors(sharedPool) {
  const pool = sharedPool ?? (await pgPool());
  const toVec = (v) => `[${v.join(',')}]`;
  return {
    async ensure() {
      /* table is shared; nothing per-book */
    },
    async upsert(slug, points) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of points) {
          await client.query(
            'INSERT INTO units (book_slug, id, embedding, payload) VALUES ($1,$2,$3,$4) ON CONFLICT (book_slug,id) DO UPDATE SET embedding=$3, payload=$4',
            [slug, p.id, toVec(p.vector), JSON.stringify(p.payload)],
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    async search(slug, vector, limit) {
      const r = await pool.query(
        'SELECT payload, 1 - (embedding <=> $1) AS score FROM units WHERE book_slug=$2 ORDER BY embedding <=> $1 LIMIT $3',
        [toVec(vector), slug, limit],
      );
      return r.rows.map((row) => ({ score: Number(row.score), payload: row.payload }));
    },
  };
}

export async function createVectorStore(sharedStore) {
  return (process.env.VECTOR_STORE ?? 'actian') === 'pg'
    ? pgVectors(sharedStore?.pool)
    : actianVectors();
}
