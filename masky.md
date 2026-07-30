# Masky API skill

Teach your AI agent to drive [Masky](https://masky.ai) — the AI avatar platform — by calling the HTTP API directly with `curl`. No MCP server required: any agent with a shell or HTTP tool can use this. Hand it this file (paste the URL into your prompt, or drop the file in your project) and ask it to make avatars and conversations.

Covers two things: (1) the **avatar API** — generate images, create avatars, run conversations that render talking-head audio/video; and (2) **"Login with Masky" (OAuth 2.0 SSO)** — add a sign-in button to your own site where users pick which of their avatars represents them and optionally let you generate on their credits (see the SSO section below).

Masky avatars each have a still image, a personality prompt, and a voice. You start a conversation with an avatar, then inject turns; each turn renders spoken audio and optional talking-head video. Conversations expose a live-embed URL that auto-plays each new turn — drop it into OBS or any web page.

## Auth

Get a key at **https://masky.ai/developer** (sign in → Generate key → copy the `mky_…` token, shown once). Then authenticate every request:

```
Authorization: Bearer mky_...
```

Base URL: `https://masky.ai/api`. All bodies are JSON (`Content-Type: application/json`). The avatar owner is billed for generation; image generation and video turns cost credits.

## Endpoints

### Generate an image (text-to-image)
```bash
curl -s -X POST https://masky.ai/api/images/generate \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"prompt":"photorealistic portrait of a friendly robot barista, studio light","aspectRatio":"1:1"}'
# 200 -> { "imageUrl": "https://.../img.jpeg", "aspectRatio": "1:1", "creditCost": 0.005 }
```
Synchronous — returns when the image is rendered + stored (usually a few seconds). The redemption is labelled `masky-image` on your billing.

Params:
- `prompt` — text description, max 2000 chars (required).
- `aspectRatio` — `1:1` (default), `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`.

The returned `imageUrl` is a long-lived public Firebase Storage URL that you can pass straight into `POST /avatars` as `imageUrl`. Failures don't burn credits (charge happens after a successful render). Errors: `400` invalid prompt/aspectRatio, `401` bad key, `402` not enough credits (response includes `{ requiredCredits, availableCredits }`), `502` upstream generation failed.

### Generate a video (text→video, image→video, or video edit)
Renders a short video via Masky's video models. **Async** (renders take ~1–3 min): `POST` starts the job, then poll `GET /api/videos/{id}` until `status` is `"video"`.

**Avatar-aware:** reference your avatars by name in the prompt (or pass `avatarIds`) and their images are sent to an image-conditioned model so they actually appear in the video.
```bash
# Start — feature an avatar by naming it in the prompt
curl -s -X POST https://masky.ai/api/videos/generate \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"prompt":"Aphrodite walks along a moonlit beach, camera slowly pushing in","resolution":"720p"}'
# 202 -> { "generationId":"...", "status":"pending", "model":"cinematic",
#          "referencedAvatars":[{"id":"...","name":"Aphrodite"}], "poll":"/api/videos/..." }

# Poll until ready
curl -s https://masky.ai/api/videos/GENERATION_ID -H "Authorization: Bearer $MASKY_API_KEY"
# -> { "status":"pending" }            ... then ...
# -> { "status":"video", "videoUrl":"https://.../vid.mp4", "model":"cinematic" }
```
Params:
- `prompt` — required. Mention avatars by name to feature them.
- `avatarIds` — optional explicit avatar ids to feature (up to 3), in addition to any named in the prompt.
- `image` — optional explicit conditioning image URL (image-to-video) instead of / with an avatar.
- `srcVideo` — optional source video URL to **edit** (uses `ensemble`); combine with a prompt describing the change.
- `model` — override the auto-pick: `cinematic` (default; text→video and single-image→video), `motion` (image→video), `scene` (text→video), `ensemble` (1–3 reference images for character consistency, or video editing).
- `resolution` / `aspectRatio` / `duration` / `seed` — passed through (model-specific; e.g. `cinematic` resolution is `720p` or `1080p`).

**Model auto-pick:** 0–1 reference image → `cinematic`; 2–3 → `ensemble` (character consistency); a `srcVideo` → `ensemble` (video-to-video edit). Billed per second of output (≈0.02–0.03 credits/sec, label `masky-video`), once, on success. Errors: `400` no prompt / model needs an image, `402` insufficient credits, `502` upstream failed to start.

### List voices
```bash
curl -s https://masky.ai/api/voices -H "Authorization: Bearer $MASKY_API_KEY"
# -> { "voices": [ { "id": "...", "name": "Deep Male Conversational Voice", "source": "preset" }, ... ] }
```
Pick a voice `id` before creating an avatar.

### List your avatars
```bash
curl -s https://masky.ai/api/avatars -H "Authorization: Bearer $MASKY_API_KEY"
# -> { "avatars": [ { "avatarId": "...", "avatarOwnerUserId": "twitch:123", "displayName": "...", ... } ] }
```

### Create an avatar
```bash
curl -s -X POST https://masky.ai/api/avatars \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "displayName": "Barista Bot",
    "imageUrl": "https://.../img.jpeg",
    "personalityPrompt": "You are a cheerful robot barista who explains coffee like a pro.",
    "humeVoiceId": "9c5a3d53-4a8c-4fa2-adad-8e61a830d0e8"
  }'
# -> { "avatar": { "avatarId": "...", "avatarOwnerUserId": "twitch:123", ... } }
```
Note the raw API field is `humeVoiceId` (a voice `id` from `/voices`). `imageUrl` is fetched and stored by Masky. Save the returned `avatarId` and `avatarOwnerUserId`. Optional `folderId` (from `/avatar-folders`) files the new avatar under one of your folders.

### Avatar folders (organize your avatar list)
Lightweight buckets shown in the avatar rail on masky.ai. Each folder has a `name` and an optional `icon` image URL (when `icon` is null the name is shown alone).
```bash
# List
curl -s https://masky.ai/api/avatar-folders -H "Authorization: Bearer $MASKY_API_KEY"
# -> { "folders": [ { "folderId": "...", "name": "Streamers", "icon": null, ... } ] }

# Create
curl -s -X POST https://masky.ai/api/avatar-folders \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Streamers","icon":"https://.../folder-icon.png"}'
# -> { "folder": { "folderId": "...", "name": "Streamers", "icon": "https://..." } }

# Delete — avatars inside are NOT deleted, they just become unfiled
curl -s -X DELETE https://masky.ai/api/avatar-folders/FOLDER_ID \
  -H "Authorization: Bearer $MASKY_API_KEY"
# -> { "ok": true, "folderId": "...", "unfiledAvatars": 3 }
```
Avatar objects returned by `GET /avatars` include their `folderId` (or null).

### Brain memory — save + recall
Every avatar can have a persistent brain (set a brain slug on the Brain tab). Memories are scoped: `public` (shared), `private` (owner-only), per-speaker identity slices (`speakerRef`), or **sandboxes** (see below). The brain's owner picks where memories are physically stored on the Brain tab — Masky-managed memory (default) or their own BYOK memory system (HydraDB, Obsidian) — and these endpoints work the same on top of whichever is selected.
```bash
# Save a memory
curl -s -X POST https://masky.ai/api/avatars/AVATAR_ID/brain/pages \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"content":"Alice is hiring a CISO this quarter.","speakerRef":"twitch:alice"}'
# -> { "ok": true, "id": "...", "system": "masky", "sandboxId": null }

# Recall memories (raw ranked matches — no LLM, works on every memory system)
curl -s -X POST https://masky.ai/api/avatars/AVATAR_ID/brain/recall \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"what is Alice hiring for?","speakerRef":"twitch:alice","limit":8}'
# -> { "memories": [ { "id":"...", "content":"...", "score":0.91, "namespace":"..." } ], "system":"masky" }

# Synthesized answer (Masky-managed memory only; needs the brain's LLM key)
curl -s -X POST https://masky.ai/api/avatars/AVATAR_ID/brain/query \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"what do you remember about Alice?"}'
# -> { "answer": "...", "citations": [...] }
```

### Brain sandboxes — a fresh, isolated brain per id
Pass `sandboxId` (`[a-zA-Z0-9_-]{1,64}`, e.g. a session id or an end-user id from your app) on any save/recall/query call and that call operates on an isolated namespace: reads see ONLY that sandbox — nothing from the shared scopes or from any other sandboxId — and writes never leak out. Same brain, same memory system, zero cross-contamination. First use of a new id is an empty ("fresh") brain.
```bash
# Save into sandbox "sess_123"
curl -s -X POST https://masky.ai/api/avatars/AVATAR_ID/brain/pages \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"content":"User prefers metric units.","sandboxId":"sess_123"}'

# Recall sees only sess_123's memories
curl -s -X POST https://masky.ai/api/avatars/AVATAR_ID/brain/recall \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"unit preference","sandboxId":"sess_123"}'

# Wipe a sandbox (owner only) — resets that id to a fresh brain
curl -s -X DELETE https://masky.ai/api/avatars/AVATAR_ID/brain/sandboxes/sess_123 \
  -H "Authorization: Bearer $MASKY_API_KEY"
# -> { "ok": true, "sandboxId": "sess_123", "deleted": 4 }
```

### Start a conversation
```bash
curl -s -X POST https://masky.ai/api/conversations \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"avatarOwnerUserId":"twitch:123","avatarId":"<avatarId>"}'
# -> { "conversationId": "...", "shareSlug": "c-26-06-xxxx",
#      "viewerToken": "...", "liveUrl": "https://masky.ai/live/c-26-06-xxxx?token=..." }
```
The `liveUrl` is the embeddable URL. Treat it as a secret — anyone with it can watch.

**Even for a single clip, do this — there is no standalone "speak" file endpoint you should use for playback.** When the user asks for "a video of my avatar saying X", create a conversation, inject one `speak`-mode turn (below), and hand back the conversation `liveUrl` to embed in an `<iframe>`. It auto-plays the turn the moment it renders (~30–60s for video) with captions, play/pause, and volume — the orchestrated player users expect. The conversation URL keeps working as you add more turns; for that one turn's own page, read its `liveUrl` (`/live/t-…`) from the conversation (below). Want an owner link instead of the viewer token? `POST /conversations/{id}/access-link` returns a rotatable `/{slug}?key=…` URL.

### Read a conversation (for polling turn status)
```bash
curl -s "https://masky.ai/api/conversations/by-slug/<shareSlug>" \
  -H "Authorization: Bearer $MASKY_API_KEY"
# -> { "conversationId": "...", "conversation": { ... }, "turns": [ { id, role, status, audioUrl, videoUrl, ... } ] }
```
Lists all turns with their current status + media URLs. Audio/video URLs are freshly re-signed on every read (1h TTL on each fetch), so cache the response only briefly. See **Inject a turn** below for the per-turn shape and polling pattern.

### Inject a turn
```bash
curl -s -X POST https://masky.ai/api/conversations/<conversationId>/turn \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"userText":"What did you have for breakfast?","output":"video"}'
# 202 -> {
#   "turn": {
#     "id": "<turnId>",
#     "role": "avatar",
#     "status": "pending",        // becomes "ready" / "error" later
#     "output": "video",
#     "avatarText": null,         // populated once Gemini reply lands
#     "audioUrl": null,           // populated once Hume TTS finishes (~seconds)
#     "videoUrl": null,           // populated once the talking-head finishes (~30-60s)
#     "shareSlug": null,          // minted when audio/video is ready
#     "createdAt": 1750000000000
#   },
#   "firestorePath": "conversations/<conversationId>/turns/<turnId>",
#   "async": true                  // false in local dev only
# }
```

**The turn is async.** The 202 returns immediately with a pending shell. Audio and video URLs land on the SAME turn doc as the worker completes — they don't come back over a webhook or a streaming response. Two ways to know when a turn is ready:

1. **Watch the live URL** — the easiest path. The `liveUrl` returned by `POST /conversations` auto-plays each new turn the moment it's ready, in order. If you're showing the user the live page (or rendering it in OBS), you don't need to poll at all.
2. **Poll the conversation** — `GET /api/conversations/by-slug/{shareSlug}` returns the full conversation including all turns with their current `status`, `audioUrl`, `videoUrl`. Look up your turn by `id`. A text turn is done when `status == "ready"`. An audio turn is done when `audioUrl` is non-null. A video turn is done when `videoUrl` is non-null (and `audioUrl` will also be set). `status == "error"` means it failed and `errorMessage` explains why. Poll every ~2s; expect text in ~3s, audio in ~5-10s, video in ~30-60s.

Long replies are auto-chunked into ~3-sentence pieces. Each chunk becomes its own turn doc and lands separately, so polling-callers may see multiple new turns appear from a single POST. The live URL plays them seamlessly in order.

**Sharing or replaying a single turn.** Once a turn has rendered media, its share fields populate (on the POST response once ready, and on every `GET …/by-slug/{shareSlug}` turn):
- `shareSlug` — the turn's slug, `t-yy-mm-XXXX`.
- `shareUrl` (`https://masky.ai/t-{shareSlug}`) — a static share page: a social card (OG/Twitter) that plays the clip. Best for posting to social where a link preview matters.
- `liveUrl` (`https://masky.ai/live/t-{shareSlug}`) — the **live viewer UI scoped to that one turn**: tap-to-play with play/pause, sound on/off, and live caption **translation into any language** (same player as a full conversation's live URL, just one turn). Best when you want to hand someone a clean, controllable player for a single reply — embeddable in a page or OBS.

So: full conversation → the conversation's `liveUrl` (`/live/c-…?token=`); a single turn → that turn's `liveUrl` (`/live/t-…`, no token needed — the slug is the grant).

Request fields:
- `userText` — what is said to the avatar (required).
- `output` — `text` | `audio` | `video` (how the conversation avatar replies; default `audio`). If the avatar has no voice configured and you ask for audio/video, it soft-degrades to text and records `mediaError` on the turn — the user still gets a text reply.
- `mode` — `chat` (default; Gemini answers using the avatar's personality + history) or `speak` (avatar says `userText` verbatim, no Gemini).
- `reinterpret` — when `true` in `speak` mode, rewrites `userText` through the conversation avatar's personality before TTS. In `chat` mode (combined with `speakerAvatarId`), rewrites `userText` through the SPEAKER's personality so the conversation avatar replies as if it heard the speaker say it in-character.

**Two-avatar conversations** (two of YOUR avatars talking, both rendered):
- `speakerAvatarId` — render the user turn as a second avatar you own (its face + voice) instead of plain text.
- `userOutput` — `text` | `audio` | `video` for that speaker turn.
- `avatarText` — chat mode: the conversation avatar speaks this EXACT line instead of a generated reply.

One call can script both sides of an exchange — the speaker avatar says `userText`, the conversation avatar says `avatarText`:
```bash
curl -s -X POST https://masky.ai/api/conversations/<conversationId>/turn \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "userText": "So sell me — what is this, in one breath?",
    "avatarText": "An API that turns text into avatars who talk. This very podcast is the output.",
    "speakerAvatarId": "<your-second-avatarId>",
    "userOutput": "video",
    "output": "video",
    "mode": "chat"
  }'
```

## Worked example — a two-avatar podcast

1. `POST /images/generate` twice → two portrait `imageUrl`s.
2. `GET /voices` → pick a voice `id` for each character.
3. `POST /avatars` twice → a host avatar and a guest avatar. Save both `avatarId`s.
4. `POST /conversations` with the **host** avatar → save `conversationId` + `liveUrl`.
5. For each exchange, `POST /conversations/{id}/turn` with `speakerAvatarId` = the guest, `userText` = the guest's line, `avatarText` = the host's reply, `output`/`userOutput` = `video`.
6. Open the `liveUrl` (or embed it) to watch each turn render.

## Login with Masky (SSO)

Masky is also an **OAuth 2.0 identity provider**. Add a "Login with Masky" button to your own site: the user signs in and picks **which of their avatars represents them on your site** — the avatar's name + photo become the identity you receive, and (if they grant the `generate` scope) you can call this API to render avatars/turns **on their credits**, as that avatar.

**1. Register your app** (one-time). Use a first-party `mky_` key from https://masky.ai/developer:
```bash
curl -s -X POST https://masky.ai/api/oauth/clients \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"My App","redirectDomains":["myapp.com"],"scopes":["profile","generate"]}'
# -> { "clientId": "mkc_…", "clientSecret": "mks_…", … }   # secret shown ONCE
```
Scopes: `profile` (identity via userinfo), `avatars:read`, `generate` (spend the user's credits on images/turns), `tribes` (tribe membership queries + credit-paid join), `donations` (propose user→user credit gifts; each needs the user's confirmation on masky.ai).

**2. Send the user to consent.** Open in their browser:
```
https://masky.ai/oauth-authorize.html?client_id=mkc_…&redirect_uri=https://myapp.com/callback&scope=profile%20generate&state=<csrf>
```
`redirect_uri`'s host must be in your `redirectDomains` (https only, except localhost). They approve and Masky redirects to `redirect_uri?code=…&state=…`. PKCE (`code_challenge`/S256) is supported for public clients.

**3. Exchange the code for a token:**
```bash
curl -s -X POST https://masky.ai/api/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"authorization_code","code":"<code>","redirect_uri":"https://myapp.com/callback","client_id":"mkc_…","client_secret":"mks_…"}'
# -> { "access_token":"mky_…", "token_type":"Bearer", "scope":"profile generate", "avatar":{ "id","name","picture" } }
```
The `access_token` **is a scoped `mky_` key** — use it as the `Authorization: Bearer` on any endpoint above (subject to its scopes; rendering needs `generate`). Codes are single-use and expire in 5 minutes.

**4. Get the identity:**
```bash
curl -s https://masky.ai/api/oauth/userinfo -H "Authorization: Bearer <access_token>"
# -> { "sub":"ava_…", "name":"Aphrodite", "picture":"https://…", "avatar_id":"…", "scope":"profile generate" }
```
`sub` is a stable pseudonym per (user, your app, avatar) — never the raw Masky uid, and un-correlatable across sites. Treat it as the user's account id on your side.

Users can review and revoke your app anytime from https://masky.ai/developer (Connected apps). MCP users get the same flow via the `register_oauth_client` + `get_sso_integration_guide` tools.

### App / service identities (client_credentials)

**There are no standalone application accounts on Masky.** Every identity — human or app — is an avatar on a user's account, and every identity you accept downstream must resolve through `/oauth/userinfo`. **Never invent local identities in your own system (e.g. `app_yourname`) for a Masky-integrated app** — that breaks the "every user is a verifiable Masky avatar" invariant for every site consuming Masky SSO.

When your app itself needs to act (a backend minting content, an agent running 24/7), give it a **service avatar**: create an avatar for the app on the owner's account, attach it to your client, and use `client_credentials`:

```bash
# Attach a service avatar to your client (owner's mky_ key; also accepted at registration time)
curl -s -X PATCH https://masky.ai/api/oauth/clients/mkc_… \
  -H "Authorization: Bearer $MASKY_API_KEY" -H "Content-Type: application/json" \
  -d '{"serviceAvatarId":"<one of your avatarIds>"}'

# Get a token that acts AS that avatar — no user, no consent; the secret is the credential
curl -s -X POST https://masky.ai/api/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"mkc_…","client_secret":"mks_…"}'
# -> { "access_token":"mky_…", "token_type":"Bearer", "scope":"…", "avatar":{ "id","name","picture" } }
```

The token behaves exactly like a user's SSO token: `/oauth/userinfo` returns a normal `ava_` sub with the avatar's name and picture, generation bills the client owner's credits, and the owner can revoke it from Connected apps. Tokens are long-lived — **request one and store it; don't mint a new token per call.**

## Tribes & credit gifts (SSO)

With an SSO token you can integrate a creator's **tribe** (their community with a credit-priced join) and send **credit gifts** between users. `{user}` params accept a Masky uid or twitchUsername. None of these are public: membership queries only answer for the token holder's own tribe or own membership.

```bash
# Tribe info (`tribes` scope) — name, join cost, member count, whether the token's user is a member
curl -s https://masky.ai/api/tribes/<user> -H "Authorization: Bearer <access_token>"
# -> { "user":"…", "tribeName":"…", "joinCost":10, "memberCount":42, "isMember":false, "isOwner":false }

# Membership check — is <member> in <user>'s tribe? Caller must be one of the two.
curl -s "https://masky.ai/api/tribes/<user>/membership?member=<other>" -H "Authorization: Bearer <access_token>"
# -> { "tribeOwner":"…", "member":true, "joinedAt":1750000000000 }

# Join — charges joinCost from the user's credits (free for the creator's active Twitch subs)
curl -s -X POST https://masky.ai/api/tribes/<user>/join -H "Authorization: Bearer <access_token>"
# -> { "success":true, "isSubscriber":false, "charged":10 }
```

Credit gifts are **two-phase** (`donations` scope): your token can only *propose* — the transfer executes only after the user confirms on a masky.ai page with their own session, so a delegated token can never move credits by itself.

```bash
# 1) Propose a gift
curl -s -X POST https://masky.ai/api/donations/intents \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"to":"<user>","amount":5,"note":"great stream!"}'
# -> { "intentId":"…", "status":"pending", "confirmUrl":"https://masky.ai/donate-confirm.html?intent=…", "expiresAt":… }

# 2) Open confirmUrl in a popup — the user clicks "Send credits" there.
#    The page postMessages {type:"masky:gift", status, intentId} to the opener (a hint);
#    poll for the authoritative status. Intents expire after 10 minutes.
curl -s https://masky.ai/api/donations/intents/<intentId> -H "Authorization: Bearer <access_token>"
# -> status: "pending" | "confirmed" | "cancelled" | "expired"

# 3) Gifts this user has sent to someone (totals + history)
curl -s "https://masky.ai/api/donations/sent?to=<user>" -H "Authorization: Bearer <access_token>"
# -> { "to":"…", "total":12.5, "count":3, "gifts":[{ "amount":5, "note":"…", "createdAt":… }] }
```

Gifted credits arrive as global Masky credits. The sender's transferable balance excludes credits locked to a creator's page or already spent, so a propose/confirm can fail with `Insufficient transferable credits`.

## Notes

- Audio turns land in seconds; video turns in ~30–60s. The live URL handles ordering — don't overlap turns.
- Long replies are auto-chunked into ~3-sentence video segments that play back seamlessly.
- Full endpoint reference / OpenAPI: https://masky.ai/api/docs
- Prefer the turnkey path? Install the [Masky MCP server](https://www.npmjs.com/package/masky-mcp-server) instead — same capabilities as native Claude tools.
