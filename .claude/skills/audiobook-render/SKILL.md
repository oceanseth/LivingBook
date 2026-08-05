---
name: audiobook-render
description: Drive the LivingBook audiobook workflow end to end — detect a book's chapters, build and save its structure.json, estimate render cost in Masky credits, render free chapter previews (first paragraph read by the book's avatar), gate full-chapter audio by the author's release criteria (free / tribe / donation), and produce the downloadable full render. Use when an author asks to "render an audiobook", "add audio previews", "estimate audiobook cost", or when working on /b/{slug} Listen features.
---

# Audiobook render — the LivingBook audio pipeline

Turn an ingested LivingBook book into a navigable audiobook: chapters with free
spoken previews, full-chapter audio gated by the author's chosen criteria, and a
downloadable full render. The runtime engine is `server/audiobook.mjs` (HTTP
routes in `server/server.mjs` under `/api/books/{slug}/audiobook`); the reader
UI lives on the book's existing page `https://livingbook.masky.ai/b/{slug}`.
Keep this file and `server/audiobook.mjs` in sync — this is the contract.

## Invariants (LivingBook-wide, apply here too)

- **Verbatim only.** Full chapter audio is the book's exact ingested text.
  Previews are the chapter's real first paragraph (or, in test mode, a fixed
  summary the author approves). Never paraphrase book text for the render.
- **Every render is a Masky speak-mode turn** (`mode:"speak"` — no LLM rewrite)
  by the book's avatar (fallback: the narrator service avatar).
- **Never persist Masky media URLs** — they are re-signed per read (~1h TTL).
  Persist turn ids + the conversation shareSlug; resolve fresh URLs at play
  time via `GET /api/conversations/by-slug/{shareSlug}`.

## The structure document (`audiobooks` store key, one entry per slug)

```jsonc
{
  "slug": "bible-kjv",
  "version": 1,
  "test": true,                    // true → previews only (full render short-circuited)
  "status": "previews",            // none | previews | rendering | ready
  "release": "free",               // free | tribe | donation  (author's access criteria)
  "tribeUrl": null,                // join-my-tribe link shown in the gate CTA
  "voice": { "avatarId": "…", "avatarOwnerUserId": "…" },
  "conversation": { "id": "…", "shareSlug": "c-…", "liveUrl": "…" }, // one conv per render
  "estimate": { "chars": 3100000, "seconds": 221428, "hours": 61.5,
                 "creditsPerSecond": 0.01, "credits": 2214.28, "charsPerSecond": 14 },
  "grants": { "<oauth sub>": { "via": "donation|tribe|manual", "at": 0 } },
  "chapters": [{
    "idx": 0, "id": "genesis", "title": "Genesis",
    "preview": "first paragraph (or summary) text",
    "titleEdited": false, "previewEdited": false,  // author-pinned via the rerender popup
    "previewTurnId": "…", "previewStatus": "none|pending|ready|error",
    "fullTurnIds": [], "fullStatus": "none|pending|ready|error",
    "chars": 0, "estSeconds": 0
  }]
}
```

## Chapter detection

1. **bible-kjv** — fixed canon: the 66 books, titles + summaries in
   `server/bible-structure.mjs`. Preview = the summary (test mode).
2. **Generic uploaded book (implemented)** — scan the book's ordered unit
   texts for inline headings `(chapter|part|section) + (number|roman|word)`
   (chunking collapsed line breaks, so headings sit inline). Selection rules,
   each earned from a real failure (Out of Focus ch. 2 was the case study):
   - **TOC-ish units are skipped** (dot leaders `……`, or **≥3** headings in
     one unit — not 2: a true chapter start regularly shares its unit with a
     cross-reference like "In Chapter 8, I discuss…"). TOC units instead feed
     `tocNames` ("Chapter N: Name …. 42" harvesting).
   - **Strictly-sequential chain, earliest occurrence wins.** Running page
     headers repeat the current number and always sit DEEPER than the true
     start; cross-references cite arbitrary numbers. Both fail the
     expected-number walk. Do NOT prefer "sentence-boundary-shaped" matches —
     page breaks fall at sentence ends, so glued running headers often look
     boundary-clean while the true start doesn't.
   - **Full title = longest common word-prefix** between the accepted start's
     following text and any other same-number match. Running headers repeat
     the FULL "Chapter N: Title" on every page — that common prefix beats the
     TOC, whose own layout truncates long titles ("The History That Laid the
     Groundwork…" vs the real "…of Mental Health Treatment in America").
     TOC name is the fallback; derived must extend it and stay ≤90 chars.
   - Preview = prose after the heading (padded from the next unit when <120
     chars, capped 420) with the title stripped: as a prefix, as a leading
     fragment that's a *suffix* of the title (body headings sometimes carry
     only the tail), and — ≥3-word titles only — glued running-header
     occurrences anywhere. Short titles ("Stigma") are real prose words and
     are never stripped mid-text.
   Units before the first heading become an "Opening" chapter; fewer than 3
   headings total → the whole book is one chapter. Each chapter records
   `firstUnitId`/`lastUnitId` — the full render pulls exact text by id range.
3. **The author is the last-resort detector.** The ↻/🎬 buttons open a
   review popup (title + preview text, pre-filled) BEFORE rendering; edited
   fields POST as `{title, preview}` to the rerender route, are pinned via
   `titleEdited`/`previewEdited` on the chapter, and survive both future
   re-detections and full re-renders (carried over by idx). Never "improve"
   detection by overwriting a pinned field. Residual artifacts the popup is
   for: PDF drop-caps losing a chapter's first letter ("n the thick of"),
   body sub-title variants ("The Rise of ASD & ADHD" under "…Autism and
   ADHD"), previews that start mid-scene.
4. **Improving detection further** — the chunk scan cannot see typographic
   headings (short title-case lines) because chunking erased line structure.
   When an author needs those: re-ingest keeping the original text (or PDF
   outline) and split there; markdown `#`/`##` headings and TOC entries beat
   regexes. Diagnose with `…/audiobook/units?q=substr` before touching
   heuristics — the real corpus always beats theory (the ch. 2 bug had three
   plausible wrong explanations before the units showed the true start being
   discarded as TOC-ish). Test changes offline against fetched units (stub
   the pg pool) before deploying. Preview `POST …/audiobook/render
   {dryRun:true}` shows detected chapters + the estimate without creating a
   conversation or spending credits — always dry-run before a paid render.

## Cost estimation (before the author pays)

`POST /api/books/{slug}/audiobook/estimate` (author-only) sums the stored
verbatim units: `seconds = chars / SPEECH_CHARS_PER_SEC` (default 14 —
~150 wpm), `credits = seconds × MASKY_AUDIO_CREDITS_PER_SEC` (default 0.01;
env-tunable). Masky does not publish an audio credits/sec rate (video is
0.02–0.03/s) — ALWAYS surface the result as an estimate and update the env
defaults when Masky publishes real numbers. The author sees this in the book's
settings before confirming the paid render.

## Rendering

`POST /api/books/{slug}/audiobook/render` `{test: true|false, release: "free"}`
— author-only (or `x-admin-token` for ownerless books like bible-kjv).

1. Detect chapters → build + save the structure doc (`status: "previews"`).
2. `POST /api/conversations` once (book avatar, else narrator) → save ids.
3. Per chapter, sequentially: one speak-mode **audio** turn,
   `userText = "{title}. {preview}"` truncated to 499 chars (stays under
   Masky's ~3-sentence auto-chunk threshold so ONE turn = ONE preview);
   save `previewTurnId`, mark `pending`.
4. Status refresh is lazy: every `GET …/audiobook` polls the conversation
   by-slug (15s cache) while any chapter is `pending`, flips `ready`/`error`,
   and sets doc `status: "ready"` when all land.
5. **Full render (test=false): NOT YET IMPLEMENTED — short-circuited.** Spec:
   per chapter, pull exact unit texts in order, split at sentence boundaries
   into ≤499-char speak turns, inject sequentially (respect Masky queue; poll
   between batches), save ordered `fullTurnIds`, then stitch server-side by
   downloading each turn's audio and concatenating (ffmpeg) into one file per
   chapter + one full-book file, stored in S3 (signed URLs are too short-lived
   for a library). Billing must move to the AUTHOR's `generate`-scoped OAuth
   token so credits are theirs, per the payment flow below.

## Payment (author pays in Masky credits)

The author's settings panel shows the estimate, then "Render audiobook"
confirms. Today the render bills the service account (demo). The real flow:
request the author's SSO token with `generate` scope and pass it as the render
token so Masky bills them — the 402 response (`requiredCredits` /
`availableCredits`) is the "insufficient credits" UX.

## Access gating (release criteria)

`release` on the structure doc; enforced at `GET …/chapter/{idx}/audio?scope=full`:

- `free` — anyone can play full chapters (author page marketing only).
- `tribe` — Masky tribe members, checked LIVE via the shipped Masky API
  (masky.md § Tribes & credit gifts): the server calls
  `GET /api/tribes/{book.avatarOwner}` with the READER's own bearer token —
  `isMember` answers for the token holder. The gate CTA joins in-app:
  `POST /api/tribes/{owner}/join` (charges joinCost; free for the creator's
  Twitch subs).
- `donation` — the author sets `donationMin` (credits) in settings; the server
  totals the reader's gifts via `GET /api/donations/sent?to={owner}` (reader's
  token) and grants at `total ≥ donationMin`. The CTA proposes a two-phase
  gift (`POST /api/donations/intents` → user confirms on masky.ai in a popup
  → poll the intent), then re-checks.

A passing live check writes a `grants` entry so later checks skip the API;
manual `POST …/grant {sub}` remains as an author override. Reader sessions
need the `tribes` + `donations` OAuth scopes (in the web login SCOPES).
Previews (`scope=preview`) are ALWAYS free — they are the marketing.
All API responses send `Cache-Control: no-store` — browsers heuristically
cache header-less GETs, which made settings changes look unsaved.

## Author tooling routes (all author-only, or x-admin-token for ownerless books)

- `GET …/audiobook/sources` — what's ingested, grouped by source type/title.
- `GET …/audiobook/units?q=substr|ids=1,2` — inspect stored unit text.
- `POST …/audiobook/normalize` — retag filename-titled units as book text.
- `POST …/audiobook/clean` — strip PDF page furniture from stored units
  (page separators + running headers, patterns learned from the corpus; the
  same stripping runs at ingest for new uploads). Re-render previews after.
- `POST …/audiobook/patch-unit {id, find, replace}` — surgical repair of an
  extraction artifact (e.g. a lost drop-cap letter). Exact-substring-guarded;
  never for editing prose. Beware shell-quoting when scripting replacements —
  derive exact strings from the stored text, verify after writing.
- `POST …/audiobook/chapter/{idx}/rerender {output:"audio"|"video", title?,
  preview?}` — re-render one chapter's preview (re-detects first so text
  repairs flow in), or render a VIDEO take of the avatar reading it; video
  ready → the chapter carries `videoLiveUrl` (Masky live player, embeds with
  `?autoplay=1`). Optional `title`/`preview` are the author's corrections
  from the pre-render popup: they replace the detected values AND pin them
  (`titleEdited`/`previewEdited`) so re-detection and full re-renders never
  clobber them. The UI sends only fields the author actually changed, so an
  untouched field keeps receiving detection improvements.
- Known PDF pitfall: decorative drop-caps are separate text objects pdf-parse
  loses — every chapter body may open missing its first letter. Scan chapter
  openings for fragment words (dictionary check) and repair via patch-unit.

## Download

`GET …/audiobook/download` (author-only) → manifest of fresh signed audio URLs
per chapter (previews now; full audio once rendered). URLs live ~1h — fetch and
save immediately. When full render ships, this returns the stitched S3 files.

## Reader UI (on /b/{slug})

The Listen section renders from `GET …/audiobook`: chapter list with title,
preview paragraph text, a free ▶ preview button (fetch
`…/chapter/{idx}/audio` → play `audioUrl` in an `<audio>` element), and a
full-chapter play that either plays (access.ok) or shows the gate CTA matching
`release`. Author (or admin) sees the settings panel: estimate, release
radios, tribe URL, render button, download.

## Test render runbook (bible-kjv)

```bash
# 1. render previews (66 summaries, ~15s each of audio)
curl -s -X POST https://livingbook.masky.ai/api/books/bible-kjv/audiobook/render \
  -H "x-admin-token: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"test":true,"release":"free"}'
# 2. poll until status:"ready" (previews land ~5-10s each, sequential)
curl -s https://livingbook.masky.ai/api/books/bible-kjv/audiobook | jq .audiobook.status
# 3. play one
curl -s "https://livingbook.masky.ai/api/books/bible-kjv/audiobook/chapter/0/audio" | jq .audioUrl
# 4. open https://livingbook.masky.ai/b/bible-kjv → Listen section
```

`ADMIN_TOKEN` lives in SSM `/livingbook/admin-token` → App Runner env.
