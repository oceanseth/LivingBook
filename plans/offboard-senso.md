# Offboard: Senso — stop the drain, keep what's useful

Senso's role was (a) the Masky-org knowledge base + published citeables and
(b) GEO monitoring (Mon/We/Fr runs across 4 AI models) — that schedule is the
credit drain (~$0.05/action against the remaining ~$91).

Unlike the others, Senso serves MASKY marketing, not LivingBook runtime — the
LivingBook product has zero hard dependency on it. So this is a business
decision more than a migration.

## Steps

1. **Immediately** (stops the burn):
   `senso run-config set-schedule --data '{"schedule": [1]}'` — Mondays only
   (or `[]` to pause entirely). Cuts GEO spend ~66%.
2. Export everything we authored: `senso search`/kb listing → dump the
   `livingbook` folder + heal reports to `docs/senso-export/` (our content,
   our copy).
3. The 3 published citeables on cited.md stay live (free, indexed, good GEO
   for both Masky and LivingBook) — no action.
4. Decide by trial-end: if GEO reporting is proving valuable for Masky
   marketing, keep a minimal schedule; else set schedule `[]` and let credits
   sit. No subscription is active — credits only burn on runs.
5. LivingBook's "verified ingestion" story (which Senso played in the demo) is
   already superseded in production by our own pipeline + VoiceCert
   attestation; README architecture table gets updated accordingly.
