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
    "previewTurnId": "…", "previewStatus": "none|pending|ready|error",
    "fullTurnIds": [], "fullStatus": "none|pending|ready|error",
    "chars": 0, "estSeconds": 0
  }]
}
```

## Chapter detection

1. **bible-kjv** — fixed canon: the 66 books, titles + summaries in
   `server/bible-structure.mjs`. Preview = the summary (test mode).
2. **Generic uploaded book** — current fallback groups ingested units by
   `source_title` (one chapter per uploaded document), preview = first unit's
   text (≤420 chars).
3. **Proper detection (do this when an author asks for real chapters):** work
   from the ORIGINAL text, not the chunks. Heuristics, in order:
   - explicit markers: lines matching `/^(chapter|book|part|section)\s+([0-9ivxlc]+|one|two…)/i`, markdown `#`/`##` headings, or PDF outline/TOC entries;
   - typographic breaks: short (<60 char) title-case lines between blank lines;
   - fallback: split every ~8–12k chars at a paragraph boundary, titles "Chapter N".
   Chapter title = the marker line (cleaned); preview = the first full paragraph
   AFTER the title (≥120 chars — skip epigraphs shorter than that). Save each
   chapter's `chars` (sum of its text) and `estSeconds = chars / charsPerSecond`.
   Persist via the structure doc — the ingestion side should also tag units
   with `chapter_id` so full render can pull exact chapter text.

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
- `tribe` — only the author's Masky tribe members. **The Masky API has no tribe
  membership endpoint yet** — until it does, access comes from the `grants`
  map (`POST …/grant {sub}`) and everyone else sees the join-tribe CTA
  (`tribeUrl`) on every chapter row.
- `donation` — user must donate to the author on Masky. **No user→user
  donation endpoint exists yet either** — same `grants` fallback; the CTA
  explains donating unlocks the audiobook.

Previews (`scope=preview`) are ALWAYS free — they are the marketing.

**Masky dev asks (tell their team):** (1) `GET /api/tribes/{owner}/members` or
a `tribe:member` claim in `/oauth/userinfo`; (2) user→user donation endpoint
with a webhook or receipt we can verify server-side to auto-grant access.

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
