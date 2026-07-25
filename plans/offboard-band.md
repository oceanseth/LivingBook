# Offboard: Band AI → in-server podcast orchestration

Why: Band supplied agent-to-agent rooms for podcast episodes — a thin but real
dependency. Post-hackathon, episode orchestration runs in our own server and
the transcript persists in Postgres.

## Steps

1. Port `server/podcast_run.py` → `server/podcast.mjs` (it's mostly Masky API
   calls + our ask pipeline; the only Python-ism was band_rest).
2. Replace the Band room with an `episodes` table: `id, story, panel jsonb,
   turns jsonb (speaker, text, at), masky_conversation, live_url, created_at`.
   The "conversation record" judges saw in Band becomes a queryable table +
   `/api/episodes` endpoint (feeds the future Podcast tab UI).
3. Keep the Band path behind `PODCAST_BUS=band|local` — the two registered
   Band agents (LivingBook Producer, Bible KJV) cost nothing parked.
4. Endpoint `POST /api/podcast/generate {story, slugs[]}` (auth: book owner or
   admin) so episodes can be triggered from the site, not just CLI.
5. Test: generate an episode about a current headline; verify player URL and
   `episodes` row.
6. Cleanup: nothing to cancel (Band free tier); remove hermes-venv dependency
   from any cron/docs.
