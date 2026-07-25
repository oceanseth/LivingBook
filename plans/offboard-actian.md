# Offboard: Actian VectorAI → pgvector on RDS

**STATUS: DONE 2026-07-25.** All 3,581 vectors migrated with score parity; container,
image, client dependency, and code paths removed. Cold backup in `server/local_data/`
(delete ~Aug 25). Final doc sweep happens in the cleanup phase.


Why: the local container dies with the laptop; Community Edition caps at 5K
vectors and the 1M trial ends ~Aug 23. pgvector on the existing Postgres 16
instance is AWS-native, uncapped, and battle-boring.

Key insight: **embeddings don't change** (all-MiniLM-L6-v2, 384-dim, computed
in our server). Migration is a straight data copy — no re-embedding, identical
retrieval scores (cosine).

## Target schema (database `livingbook`)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE units (
  book_slug   text NOT NULL,
  id          int  NOT NULL,
  embedding   vector(384) NOT NULL,
  payload     jsonb NOT NULL,          -- exact current Actian payload shape
  PRIMARY KEY (book_slug, id)
);
CREATE INDEX units_hnsw ON units
  USING hnsw (embedding vector_cosine_ops);
```

## Steps

1. Add `VECTOR_STORE=pg|actian` flag in server; implement the pg path:
   - upsert: `INSERT ... ON CONFLICT (book_slug,id) DO UPDATE`
   - search: `SELECT payload, 1-(embedding <=> $1) AS score FROM units
     WHERE book_slug=$2 ORDER BY embedding <=> $1 LIMIT $3`
   (score semantics match Actian's cosine similarity — thresholds 0.35/0.30/
   0.22 carry over unchanged.)
2. Export from local Actian: `scripts/export-actian.mjs` — scroll every
   collection (`client.points.scroll`), write `local_data/export/{slug}.jsonl`
   (id, vector, payload). ~2.8K points, seconds.
3. Import to Postgres: `scripts/import-pg.mjs` (batch INSERT 500/tx).
4. Flip `VECTOR_STORE=pg` on App Runner; verify:
   - "mercy" on bible-kjv returns 1 Timothy 1:16-20 ≈ 0.66 (parity check)
   - Out of Focus therapist question returns §91 with BOOK TITLE frame
5. Retire: stop local `vectorai` container (keep `local_data/` as backup);
   remove `@actian/vectorai-client` after a week of quiet.

## Keep-the-story note

The Actian integration code stays in the repo behind the flag — it's part of
the hackathon submission and still runs anywhere with Docker. README gets a
line: "vector store: pgvector (production) / Actian VectorAI (edge/offline
demo mode)".
