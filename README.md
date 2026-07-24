# 📖 LivingBook

> *"Some of the best ideas in the world come from the most unexpected places."*

**Books that talk back.** LivingBook brings real authors' books to life as talking video
agents — built on [Masky](https://masky.ai) — that authors can embed on their own websites
and readers can meet inside the LivingBook mobile app.

A submission to the **Self-Evolving Agent Hackathon**.

## What it does

- **Authors** sign in with **Login with Masky** (their Masky avatar *is* their identity),
  claim their books, and upload the book plus related material: podcast episodes where they
  discussed it, transcripts of fan Q&As, essays, errata — anything.
- **Readers** favorite books in the app and talk to the agent that represents each book.
  The agent answers **in the author's own words**: it retrieves exact, word-for-word
  passages and transcripts from the knowledge base and never invents new content beyond
  short connective phrases like *"I've answered this before, on this podcast, and I said…"*
- **Masky renders the answer** as a voice or talking-head video experience, depending on
  the user's available Masky credits. **Authors earn a share of the credit spend** their
  books generate, and every short clip is one tap away from being reshared to socials.
- A **self-evolving marketing agent** watches real-world signals trending on social media
  and proactively produces answer-videos that connect the book to the moment.
- A **News tab** shows trending stories with text-only reasoning from each book you
  follow: the Bible's take on today's headline, or Michael Crichton's — drawn from the
  novels where he predicted it — each grounded in verbatim passages plus real web
  references.
- A **Podcast tab** generates virtual podcasts between the authors and books you follow
  — agents discussing a news story you pick (or context you type), coordinated
  agent-to-agent over Band AI and rendered as two-avatar video by Masky. Join the panel
  yourself with a Masky avatar you own — or your real camera — and if your episode goes
  viral, listeners can subscribe to your future podcasts or pay to bring your avatar
  onto theirs. Creators monetize their avatars: generated video appearances, or booked,
  recorded real video-to-video sessions published on the platform.

### Example

> *"What does the Bible say about this lawsuit in the court today?"*

LivingBook's marketing agent sees the trial trending, retrieves the most relevant passage
from the Bible's knowledge base, and renders a video of a narrator — or the characters
themselves — reading that exact section, ready to embed or share.

Classic public-domain works (starting with the Bible) live in a **Public Domain** section
of the app, so the experience works from day one — no author signup required.

## Architecture (hackathon build)

| Piece | Tech |
| --- | --- |
| Landing page + author dashboard | Vite + React (`web/`) |
| Mobile app | React Native (`mobile/`, App Store submission planned) |
| Identity | Login with Masky (OAuth 2.0 + PKCE) — see [masky.md](masky.md) |
| Avatar voice/video rendering | Masky conversations API |
| Knowledge base (verbatim retrieval) | Actian VectorAI DB |
| Content ingestion / verified ground truth | Senso |
| Agent runtime, triggers, versioned self-evolution | Guild.ai |
| Simulated usage + autonomous QA / self-repair | Replay QA |
| Cloud | AWS |

## Repo docs

- [DEVELOPMENT-PLAN.MD](DEVELOPMENT-PLAN.MD) — build plan
- [GTM-PLAN.MD](GTM-PLAN.MD) — go-to-market plan
- [REALWORLDPLAN.MD](REALWORLDPLAN.MD) — virtual-to-physical community features
- [AGENTS.MD](AGENTS.MD) — instructions for AI agents working in this repo
- [masky.md](masky.md) — the Masky API skill this project builds on
- [OPEN-SESSION-LICENSE.md](OPEN-SESSION-LICENSE.md) — session-transparency license
  (code is MIT, see [LICENSE](LICENSE))

## Getting started (web)

```bash
cd web
cp .env.example .env.local        # set VITE_MASKY_CLIENT_ID (see below)
npm install
npm run dev
```

One-time OAuth client registration (needs a `mky_` key from https://masky.ai/developer):

```bash
MASKY_API_KEY=mky_... ./scripts/register-oauth-client.sh
```
