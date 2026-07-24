# 📖 LivingBook — books that talk back

**Live at [livingbook.masky.ai](https://livingbook.masky.ai) · Web + iOS (Expo)**

Real authors' books become living video agents that answer **only in the author's exact
words**. Ask the Bible about today's courtroom drama and a narrator reads you the verse —
on video, shareable in one tap. *"Some of the best ideas in the world come from the most
unexpected places."*

**What works today (all built during the hackathon):**
- **Authors** sign in with Masky (OAuth + PKCE — your avatar *is* your identity), claim
  books, and upload podcasts, fan Q&A transcripts, or **live spoken sessions gated by
  VoiceCert human verification** — so their agent can truthfully say *"I spoke these
  words myself, on the record — VoiceCert-attested."*
- **Readers** (web + iPhone app) ask any book anything and get byte-exact passages:
  *"I've answered this before, on Ep 42 of my podcast, and I said: '…'"* A **News tab**
  delivers each book's take on live headlines; a **Talk tab** lets you converse with a
  book as your own avatar, landing in the author's inbox — renderable as a two-avatar
  video on the author's credits and shared to socials. A **podcast generator** stages
  the books you follow discussing a story you pick.
- **The marketing agent** watches real trends and produces grounded answer-videos
  (today it connected the Red Sea chokepoint story to Revelation 18's merchants
  mourning sea trade destroyed "in one hour" — and rendered the narrator saying it).

**Self-evolving, three ways:** the knowledge base grows from use (every Q&A, AMA, and
attested spoken session is re-ingested); the marketing agent's strategy memo is revised
by a coach loop and shipped as **new versions on Guild.ai with rollback + full session
audit** (v1→v2 shipped live today); and Replay QA simulates readers to find and feed
back what breaks.

**Sponsor tools — seven, all live:**
- **Actian VectorAI DB** — the verbatim knowledge base: Docker-local/offline
  (edge-ready), per-book collections, 2,769 Bible units + author uploads, hybrid
  retrieval with provenance on every unit.
- **Pioneer** — grounded reasoning on `pioneer/auto`: reformulates headlines into
  timeless themes (Actian's hybrid-RAG pattern), reasons over retrieved passages under
  a **no-quote contract** — refs only, verbatim text rendered from the store,
  violations auto-rejected (it caught a model quoting the Bible from memory, live).
- **Guild.ai** — the marketing agent's governed runtime: API triggers, audit-logged
  sessions, versioned self-evolution.
- **Band AI** — podcast episodes are real agent-to-agent rooms: "LivingBook Producer"
  and "Bible KJV" agents converse under their own keys, rendered by Masky's two-avatar
  API.
- **Senso** — org fully onboarded (15-doc KB, 40 tracking prompts, 3 published
  citeables on cited.md, GEO monitoring) as the ingestion/verified-ground-truth layer.
- **VoiceCert** — live server-side human verification (widget token → Lambda verify)
  gating spoken ground truth.
- **Masky** — identity provider + all avatar video rendering. Cloud: AWS.

**The core claim, enforced not promised:** LLMs select and reason — they never generate
an author's words. Byte-identical substring checks reject any ungrounded quote. Books
stay alive; authors stay in control; readers get proof.

*Built openly: this repo ships its complete human/AI session log under the
[Open Session License](OPEN-SESSION-LICENSE.md).*
