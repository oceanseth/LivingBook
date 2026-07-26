# Day-After-Hackathon Plan — off sponsors, onto our AWS

Goal: nothing about LivingBook depends on a sponsor free tier, a trial clock, or
Seth's laptop being awake. Target stack mirrors what this account already runs
for Masky: **App Runner + RDS Postgres (pgvector) + EventBridge + CloudFront**.

What stays (not sponsors, ours): **Masky** (identity + video rendering),
**VoiceCert** (human verification — already our Lambda), AWS.

## Current dependency audit (2026-07-25)

| Dependency | Runs where | Risk |
| --- | --- | --- |
| API server + all app state (books/alerts/convos/follows JSON) | Seth's laptop | Laptop sleep/reboot = site down, data local-only |
| cloudflared quick tunnel | Laptop → Cloudflare edge | Random hostname dies unpredictably (twice already) |
| Actian VectorAI (vectors) | Laptop Docker | 5K-vector CE cap; 30-day trial ends ~Aug 23 |
| Guild.ai (reply drafting, hourly heartbeat, marketing decisions) | Guild cloud | Free tier 100 automations/mo — days from exhaustion |
| Pioneer (news reasoning, query reformulation) | Pioneer cloud | Paid sub, per-token burn |
| Band (podcast agent rooms) | Band cloud | Free; thin integration |
| Senso (Masky-org KB + GEO monitoring) | Senso cloud | ~$91 credits left; GEO runs drain Mon/We/Fr |

## Execution order (each file is one work session)

1. **[offboard-laptop-and-tunnel.md](offboard-laptop-and-tunnel.md)** — the
   foundation: containerize the API, App Runner service, app state → Postgres,
   CloudFront `/api/*` behavior, retire tunnel + watchdog. Everything else
   assumes this exists.
2. **[offboard-actian.md](offboard-actian.md)** — vectors → pgvector on RDS.
   Same MiniLM embeddings, so it's a data COPY, not a re-embed.
3. **[offboard-pioneer.md](offboard-pioneer.md)** — reasoning → Amazon Bedrock.
   Do before Guild so the replacement LLM path exists.
4. **[offboard-guild.md](offboard-guild.md)** — scheduling → EventBridge,
   decisioning → Bedrock, versioning/audit → git + Postgres.
5. **[offboard-band.md](offboard-band.md)** — podcast orchestration in-server.
6. **[offboard-senso.md](offboard-senso.md)** — stop the credit drain, export,
   decide keep-vs-drop.

## End-to-end test (run after step 6, before cleanup)

- [ ] livingbook.masky.ai loads with laptop LID CLOSED (books list, talk, news)
- [ ] Login with Masky round-trip returns to originating page
- [ ] Talk to Out of Focus → verbatim answer with BOOK TITLE frame
- [ ] 🎬 render a turn on user credits → share link plays
- [ ] /b/out-of-focus cold load in incognito
- [ ] Author: create book → upload PDF → ask it (web) — and via iOS app pairing
- [ ] News tab reasoning (now Bedrock) with real references
- [ ] Scout: EventBridge fires /api/scout/run → alert appears in 🔔 + app →
      full alert page → approve text-only AND approve+video → X intent opens
- [ ] Record spoken truth (VoiceCert gate still verifies)
- [ ] Podcast generation end-to-end
- [ ] Restart App Runner service → all data still present (Postgres persisted)

## Cleanup (only after every box above is checked)

- [ ] Kill: cloudflared, tunnel-watchdog, caffeinate, local `node server.mjs`
- [x] Stop local Docker `vectorai` — DONE 2026-07-25 (container + image removed; `local_data/` kept as cold backup)
- [x] Web `api-config.js` → same-origin '' + `api-config.json` → permanent URL, fixed
      in repo source (public/) so rebuilds can't revert — DONE 2026-07-26. Root cause
      of the laptop-off outage: a Jul 25 build sync re-uploaded the repo's stale
      tunnel-pointing api-config.js over the manual fix.
- [ ] Guild: deactivate time + API triggers; keep workspace/agent for the
      public Agent Hub listing (it costs nothing idle)
- [ ] Pioneer: downgrade/cancel sub — Bedrock path verified live 2026-07-25 (Seth's action)
- [ ] Senso: GEO schedule already reduced; decide subscription
- [ ] Rotate keys that traveled through chat during the hackathon:
      Masky client secret + mky_ key, trigger keys; refresh SSM entries
- [ ] Update README architecture table + SUBMISSION note ("post-hackathon:
      migrated to self-hosted AWS; sponsor integrations preserved behind flags")
