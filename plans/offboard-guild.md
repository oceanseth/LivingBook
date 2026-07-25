# Offboard: Guild.ai → EventBridge + Bedrock + git-versioned prompts

Why: the free tier (100 automations/mo) can't survive our hourly cadence, and
scheduling/decisioning belongs on our own stack now.

## What Guild provides today, and its replacement

| Guild capability | Our replacement |
| --- | --- |
| Hourly time trigger (heartbeat sessions) | **EventBridge Scheduler**: `rate(1 hour)` → hits `POST /api/scout/run-all` on App Runner (new endpoint wrapping scoutSweep; shared-secret header) |
| API-trigger sessions (scout reply drafts, marketing decisions) | Direct `llmChat()` (Bedrock, from [offboard-pioneer.md](offboard-pioneer.md)) using the same system prompts |
| Versioned agent + rollback (the STRATEGY MEMO) | Prompts move to `agents-src/prompts/*.md` in git — version = commit, rollback = revert; active version pinned via SSM parameter `/livingbook/prompt-version` so rollback needs no redeploy |
| Session audit log (governance) | `agent_runs` table in Postgres: input, output, prompt version, model, tokens, outcome. `/api/agent-runs` for review. CloudWatch alarm on error rate |

## Steps

1. Extract the two Guild agent system prompts (marketing strategist + scout
   reply) from `agents-src/livingbook-marketing/agent.ts` into
   `agents-src/prompts/` (single source of truth; the Guild agent build reads
   the same files so the Hub listing stays honest).
2. Implement `agent_runs` logging around every `llmChat` decisioning call.
3. New endpoint `POST /api/scout/run-all` (auth: `x-scout-key` shared secret
   from SSM); EventBridge Scheduler → that URL, `rate(1 hour)`,
   retry 2, DLQ to SQS.
4. Remove server-side `setInterval`/`setTimeout` sweep (scheduler owns cadence
   now); keep `POST /api/scout/run` for manual runs.
5. `guildSuggestReply` → `suggestReply()` on Bedrock; keep the Guild path
   behind `AGENT_RUNTIME=guild` flag for demos.
6. Parity test: run a sweep; alert quality comparable; `agent_runs` rows
   written with prompt version.
7. Guild cleanup: deactivate both triggers (time + API) in the workspace,
   keep the published agent on the Hub (free, good marketing), delete the
   trigger API key from active use (leave SSM entry marked dormant).

## What we consciously lose

Guild's cross-org governance UI and one-click rollback UX. Accepted: git
history + SSM pin + `agent_runs` covers our actual needs at this scale.
