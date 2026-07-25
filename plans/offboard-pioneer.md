# Offboard: Pioneer → Amazon Bedrock

**STATUS: DONE 2026-07-25.** `llmChat()` shipped in image v3 with `LLM_PROVIDER=bedrock`
default (Haiku 4.5 fast tier, Sonnet 5 smart tier, Converse API). One-time Anthropic
use-case form submitted for the account (as Masky). Parity test passed live (Red Sea
story → Acts 27 retrieval, refs-only reasoning, real articles). Deviation from step 2:
no temperature is sent — Sonnet 5 rejects non-default sampling params. Remaining user
action: cancel/downgrade the Pioneer sub (step 5).

Why: Pioneer's `pioneer/auto` router is a paid per-token sub. Bedrock gives the
same class of models inside our AWS bill/IAM, no separate vendor.

## What Pioneer does today (2 call sites, both in server.mjs)

1. `newsReason()` — News-tab grounded reasoning (2-4 sentences, no-quote
   contract, retry-on-violation).
2. `scoutBook()` — headline → timeless-theme retrieval query (+ the Pioneer
   fallback inside `guildSuggestReply`).

## Steps

1. Add `LLM_PROVIDER=bedrock|pioneer` flag and one helper:
   `llmChat(messages, maxTokens)`:
   - bedrock path: `bedrock-runtime` `Converse` API, model
     `us.anthropic.claude-haiku-4-5-20251001-v1:0` for reformulation (cheap,
     fast) and `us.anthropic.claude-sonnet-5` for News reasoning. App Runner
     instance role gets `bedrock:InvokeModel`.
   - pioneer path: current fetch (kept for the submission story).
2. The no-invention post-check is provider-agnostic — unchanged. Verify the
   reject-and-retry loop against Bedrock (temperature 0.4).
3. Parity test: Red Sea chokepoint story → expect Revelation 18-class
   retrieval + refs-only reasoning + a real related article.
4. Flip the flag on App Runner; watch a day of News-tab usage in CloudWatch.
5. Cancel/downgrade the Pioneer sub. Keep the key in SSM (dormant) in case we
   want their router for a demo.

Cost note: News reasoning is cached per (book, story) and low-volume; expect
single-digit dollars/mo on Bedrock at current traffic.
