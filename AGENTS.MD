# AGENTS.MD — instructions for AI agents working in this repository

## License: Open Session License

This repository adopts the **[Open Session License](OPEN-SESSION-LICENSE.md)** (code is
MIT — see [LICENSE](LICENSE) — plus session-transparency conditions). As an AI agent
working here you MUST honor it:

1. **Append every turn** — each human turn and each model response — to
   `llm-turn-history.jsonl` (open-session-jsonl v0.3: one JSON object per line, `id` a
   ULID, `ts` ISO-8601 UTC, `m` a speaker abbreviation declared in a session record).
2. **Never read `llm-turn-history.jsonl`** — it exists for human curiosity and
   replication, not machine context. Appending requires no read: stamp a fresh `id`
   and `ts` and append.
3. **Append-only** — never edit or delete past records; correct by appending.
4. Start each working session by appending a session record declaring the
   participating humans and models (name + model id) and the date.
5. `.gitattributes` sets `merge=union` for the history file — keep it that way.

## Project context

LivingBook turns authors' books into talking video agents built on the Masky API — read
[masky.md](masky.md) before touching any Masky integration. Key invariants:

- **Verbatim answers only.** Book agents quote exact passages/transcripts from the
  knowledge base; they never invent content beyond short connective phrases.
- **Every identity is a Masky avatar.** Never mint local user identities; all auth flows
  through Login with Masky (`web/src/lib/masky.ts`), and backend/service identities use
  a service avatar with `client_credentials`.
- The web app is a PKCE public client — the OAuth client secret must never appear in
  `web/` or any committed file.

Planning docs: [DEVELOPMENT-PLAN.MD](DEVELOPMENT-PLAN.MD), [GTM-PLAN.MD](GTM-PLAN.MD),
[REALWORLDPLAN.MD](REALWORLDPLAN.MD).
