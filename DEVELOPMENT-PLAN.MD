# DEVELOPMENT-PLAN — LivingBook

> Draft v0.2 — sponsor research integrated. ⚠️ **The Self-Evolving Agents Hackathon
> ([luma.com/swarmhack](https://luma.com/swarmhack), tokens&, SF) is TODAY, Fri Jul 24
> 2026, 9:30 AM–7:30 PM PT — submission likely ~4:30 PM PT.** Expected rules (from this
> organizer's prior editions): use **≥3 sponsor tools**, 3-minute demo video, public
> GitHub repo, teams ≤4. Expected judging: **Idea / Technical Implementation / Tool Use /
> Presentation / Autonomy — 20% each.**

## Hackathon-day scope (today)

Optimize for the closed self-evolving loop, demoed once, fast:

1. **Bible vertical slice** — Bible (KJV, public domain) ingested; narrator avatar
   answers questions verse-verbatim on the web app; share links work.
2. **Marketing agent** — trending signal → relevant passage → Masky video → draft post.
3. **Self-repair loop** — Replay QA explores the app like a simulated reader, finds
   what broke, agent consumes the root cause via Replay MCP and fixes itself.
4. Sponsor tools ≥3: **Actian VectorAI DB + Guild.ai + Replay QA** (+ Senso ingestion,
   + optionally Pioneer/Fastino inference routing).

Judge-fit notes: Replay's CEO (Brian Hackett) and three Guild.ai judges are on the
panel; Senso's founder (Saroop Bharwani) co-hosts the event.

## Product surfaces

1. **Web (`web/`)** — Vite + React. Landing page ✅, Login with Masky ✅ (PKCE flow in
   `web/src/lib/masky.ts`), author dashboard (books, uploads, earnings), embeddable
   book-agent widget for authors' own sites.
2. **Mobile (`mobile/`)** — React Native reader app: browse/favorite books, talk to book
   agents (voice/video via Masky), Public Domain shelf (Bible first), reshare clips. App
   Store submission after the hackathon. Note: Replay QA has **no native mobile
   support** — simulated "mobile" usage is mobile-web (Playwright iPhone emulation
   against the responsive web app).
3. **Backend (AWS)** — serverless-first: API Gateway + Lambda (Node/TS), S3 for uploads,
   DynamoDB for app state (users, books, favorites, earnings ledger), Secrets Manager
   for the Masky client secret + service-avatar token, EventBridge for scheduled agent
   runs. (Guild.ai hosts the agents themselves — see below.)

## Sponsor stack (researched, concrete)

### Actian VectorAI DB — the verbatim knowledge base
Launched Apr 2026; portable (Docker), Qdrant-like collections/points/payload model,
HNSW, filters applied during ANN search, native RRF fusion. Docs index for agents:
`https://docs.vectoraidb.actian.com/llms.txt`.

- Run local: `docker run -d -p 6573-6575:6573-6575 -e ACTIAN_VECTORAI_ACCEPT_EULA=YES
  actian/vectorai:latest` (REST 6573, gRPC 6574, web UI 6575). Demo runs offline on the
  laptop — leans into Actian's edge story ("the book's brain runs anywhere").
- Free: Community Edition 5K vectors; signup grants a 30-day/1M-embedding trial.
- SDKs: `pip install actian-vectorai-client` / `npm install @actian/vectorai-client`.
- **One collection per book** (`book_<slug>`); book text + podcasts + Q&A in the same
  collection discriminated by payload `source_type` ∈ {book, podcast, qa}. Payload keeps
  the **exact original text** plus provenance (`chapter/verse/page` or
  `episode_id/speaker/t_start_ms/t_end_ms/url`). ~150–300-word chunks aligned to
  utterance/verse boundaries.
- Retrieval: hybrid RAG per their docs — embed question + reformulation, fuse with
  `reciprocal_rank_fusion`, `score_threshold` to honestly say "the book doesn't cover
  this", grouped search to dedup same-paragraph chunks.

### The no-invention contract
1. Retrieve top-k units from Actian (book-scoped, filtered).
2. The LLM only **selects** units and emits a connective frame — *"I've answered this
   before, on {podcast}, and I said: '{exactText}'"*. Post-check enforces the quote is a
   byte-identical substring of a retrieved unit; reject and retry otherwise.
3. Render via Masky **`speak` mode** (verbatim, no rewrite) on the book's avatar;
   text/audio/video per the user's Masky credit balance. Reader memory uses Masky
   **brain sandboxes** (`sandboxId = user sub`) so nothing leaks between users.
4. Surface each turn's `shareUrl`/`liveUrl` for one-tap reshare.

### Senso — ingestion + verified ground truth (+ GEO flourish)
Context layer for agents; REST at `https://sdk.senso.ai/api/v1` (`X-API-Key`), $100
free credits (~$0.05/action). Author uploads go `POST /content/raw` (or file upload,
202 async) → compiled, citation-backed KB; `/search` returns grounded passages with
citations we can cross-check against Actian retrieval. Brand Kit holds the author's
voice for marketing copy; the GEO/Remediate angle ("LivingBook publishes verified
author content so ChatGPT/Perplexity cite the author correctly") is a demo flourish
the organizer will recognize. Dev speed: `npm i -g @senso-ai/cli`,
`senso skills install --all --agent claude`, Senso MCP in the agent runtime.

### Guild.ai — where the agents live (and self-evolve, governed)
Control plane for agents (GA Apr 2026, $44M Series A). TS SDK
(`@guildai/agents-sdk`, Zod schemas; runtime allows only the SDK + zod — external
calls go through Guild **custom REST integrations**, which is how Masky/Senso/social
APIs get wired). CLI: `guild agent init --template LLM` → `guild agent test` →
`guild agent save --publish`.

- **Marketing agent** as a Guild LLM agent: scheduled trigger (hourly trend scan) +
  API trigger (`POST /api/workspaces/{owner}/{ws}/sessions`) for on-demand fires.
- **The self-evolving story:** every run is a logged Session; a "coach" agent reviews
  outcomes/engagement, rewrites the marketing agent's prompt/strategy, ships it as a
  new **version** via `guild agent save` — with rollback. Governed self-evolution:
  autonomy with a leash, audit trail included.
- Free tier: 100 automations/mo, no card. Publish to Agent Hub as the closer ("fork
  this to bring *your* book to life").

### Replay QA — the immune system of a self-evolving product
Autonomous QA agent: point it at the URL, it discovers user journeys, writes its own
Playwright tests, records deterministically, files root-caused bugs with suggested
fixes. Free tier 25 credits/mo (~1 full pass); sponsor credits at the event.

- Install the **Replay QA GitHub app** on this repo → every agent-authored PR gets a QA
  comment (recording + root cause + fix) before merge.
- **Replay MCP** in the coding agent (~25 time-travel tools) → the agent debugs its own
  recordings and applies fixes: change → simulated readers → breakage found →
  self-repair → redeploy. Zero-human loop = the Autonomy criterion.
- Demo artifact: the journey map of a simulated reader using the Bible agent + one bug
  found + one agent-applied fix, with the shareable app.replay.io link in the 3-min video.

## Identity (done on web, port to mobile)
Login with Masky, OAuth 2.0 + PKCE. `sub` from `/oauth/userinfo` is the user id
everywhere; no local identities (AGENTS.MD invariant). Mobile uses the same flow via an
in-app browser (Expo AuthSession) with a universal-link redirect. Backend service
identity = a **service avatar** + `client_credentials` token in Secrets Manager.

## Ingestion pipeline (author uploads → knowledge base)
1. Author uploads book text / podcast audio / Q&A transcript (S3 presigned).
2. Transcribe (audio) and normalize to **verbatim source units**; Senso ingestion in
   parallel for the compiled/verified KB.
3. Embed and upsert into the book's Actian collection. Every reader Q&A session and
   author AMA appends new `qa` units — **usage grows the agent**.

## Milestones

| # | Milestone | Contents |
| --- | --- | --- |
| M0 | Repo setup ✅ | Vite web + Masky SSO, docs, license plumbing |
| M1 | **Today AM** — Bible slice | KJV → Actian (local Docker); narrator avatar; verse-verbatim answers on web; share links |
| M2 | **Today midday** — marketing agent | Guild-hosted: trend signal → passage → Masky video → draft post; coach-agent versioning loop |
| M3 | **Today PM** — self-repair + submission | Replay QA pass + MCP fix loop; 3-min demo video; submit by ~4:30 PM PT |
| M4 | Author flow | Author login → create book → upload podcast/transcript → agent answers from it; earnings ledger |
| M5 | Mobile app | RN reader app (favorites, agent chat, Public Domain shelf); App Store submission |

## Decisions (Jul 24)

- **Scope today:** hackathon demo loop AND the author flow.
- **Mobile:** Expo (EAS builds, AuthSession for the Masky PKCE flow). Replay "mobile"
  simulation = mobile-web emulation.
- **Marketing agent:** start with **X trends**. Authors configure their own agent: spend
  budget, outbound messages/day, and connected channels (x.com, Instagram, TikTok) so
  posts go out on their behalf reacting to top trending posts/reels.
- **Domain:** web app deployed at **https://livingbook.masky.ai** (S3 + CloudFront
  `E2DGNXZJVOM8A` + Route53 in the masky.ai zone; ACM cert issued).
- **OAuth client:** `mkc_c6ea337a1294f9ba32e96255`, redirect
  `https://livingbook.masky.ai/callback`. Client id in `web/.env.local`; the client
  SECRET lives only in the untracked root `.env` → move to AWS Secrets Manager for the
  backend. It was shared in-session, so rotate it after the hackathon.

## Open questions (tracked)

- Credit-share economics: what % of user credit spend accrues to the author; does Masky
  provide the ledger or do we track app-side?
- X API access tier for trend reads + posting on authors' behalf (OAuth per author).
- Sponsor-service credentials needed: Actian VectorAI trial signup, Guild.ai account,
  Senso API key, Replay.io account/GitHub app install.
- Role of the existing Akash deployment, if any.
