# Offboard: the laptop + cloudflared tunnel → App Runner + Postgres

The single highest-value migration. After this, the site survives laptop sleep,
and the tunnel/watchdog are deleted.

## Target

- **App Runner service `livingbook-api`** (same pattern as `masky-live-api`):
  Node 22 container running `server/server.mjs`, 1 vCPU / 2GB (MiniLM embedding
  model needs the memory), min 1 instance (no cold starts; the embed pipeline
  takes ~15s to warm).
- **App state → Postgres** on `masky-gbrain-production` RDS, new database
  `livingbook`: tables `books`, `alerts`, `convos`, `follows`, `pair_codes`
  (JSONB-heavy — mirror today's JSON shapes 1:1 to keep the diff small).
- **CloudFront**: add behavior `/api/*` on distribution `E2DGNXZJVOM8A` →
  App Runner origin (all-viewer headers, no caching). Site then calls
  same-origin `/api` — CORS gone, `api-config.js` pinned to `''` (same origin).

## Steps

1. `server/Dockerfile`: `FROM node:22-slim`, copy server/, `npm ci`, pre-download
   the Xenova MiniLM model at build (`RUN node warmup.mjs`) so cold start is fast;
   `EXPOSE 8787`.
2. Secrets: App Runner env from SSM `/livingbook/*` (instance role with
   `ssm:GetParameter` + `kms:Decrypt`). Never bake `.env` into the image.
3. Storage adapter in server.mjs: replace `readFileSync/writeFileSync` JSON
   helpers with a tiny `store.mjs` (pg Pool; `SELECT/UPSERT` JSONB by key).
   Feature-flag: `STORE=pg|file` so local dev still works.
4. RDS: `CREATE DATABASE livingbook;` on masky-gbrain-production; security
   group: allow App Runner VPC connector (create one in the RDS VPC).
5. ECR repo `livingbook-api`; build+push (arm64); create App Runner service
   with VPC connector for RDS access.
6. One-time data migration: `node scripts/migrate-state-to-pg.mjs` uploads
   current books.json/alerts/convos/follows.
7. CloudFront `/api/*` behavior → App Runner default domain. Verify
   `https://livingbook.masky.ai/api/books`.
8. Set `api-config.js` on S3 to `window.__API__=''` (same-origin); app's
   `api-config.json` to `{"apiUrl":"https://livingbook.masky.ai"}`.
9. Verify site with local server STOPPED. Then kill tunnel/watchdog/caffeinate.

## Notes / gotchas

- Vector search still points at the laptop until
  [offboard-actian.md](offboard-actian.md) is done — run these two back-to-back
  (the server can't answer questions without a reachable vector store). Do
  Actian's pgvector schema in the SAME database to share the VPC plumbing.
- Masky OAuth client `redirectDomains` already covers livingbook.masky.ai —
  unchanged.
- VoiceCert verify + Masky calls are outbound HTTPS — fine from App Runner.
- Cost: ~$25-40/mo (App Runner 1v/2GB always-on) + $0 extra RDS (existing
  instance).
