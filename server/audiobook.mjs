// Audiobook engine: structure detection, cost estimation, preview rendering,
// and access gating. The full workflow contract lives in
// .claude/skills/audiobook-render/SKILL.md — keep the two in sync.
//
// A book's audiobook is one structure doc (store key `audiobooks`, one entry
// per slug). Chapters carry a free preview (the chapter's first paragraph —
// or, in test mode, a summary) rendered as a Masky speak-mode audio turn, and
// eventually full chapter audio. Masky media URLs are re-signed per read with
// a ~1h TTL, so we never persist audio URLs — we store turn ids and resolve
// fresh URLs from the conversation at play time.
import { BIBLE_BOOKS } from './bible-structure.mjs';

const MASKY = 'https://masky.ai/api';
// Speech-rate + cost model for the estimate. Masky does not publish an audio
// credits/sec figure (video is ~0.02–0.03/sec), so the rate is configurable
// and the estimate is labelled an estimate everywhere it surfaces.
const CHARS_PER_SECOND = Number(process.env.SPEECH_CHARS_PER_SEC ?? 14);
const AUDIO_CREDITS_PER_SEC = Number(process.env.MASKY_AUDIO_CREDITS_PER_SEC ?? 0.01);
const TURN_TEXT_LIMIT = 499; // one speak turn = one un-chunked audio clip

export function createAudiobooks({ store, vectors, books, serviceToken, narrator }) {
  const pool = store.pool ?? vectors.pool; // pg pool (STORE=pg in prod; absent in file-store dev)
  let audiobooks = {};
  const ready = store.load('audiobooks', {}).then((v) => (audiobooks = v));
  const save = () => store.save('audiobooks', audiobooks);

  const maskyHeaders = { Authorization: `Bearer ${serviceToken}`, 'Content-Type': 'application/json' };

  // ── estimation ────────────────────────────────────────────────────────────
  async function bookTextStats(slug) {
    // Sum the stored verbatim units — the exact text a full render would speak.
    const r = await pool.query(
      "SELECT count(*)::int AS units, coalesce(sum(length(payload->>'text')),0)::bigint AS chars FROM units WHERE book_slug=$1 AND coalesce(payload->>'source_type','book') = 'book'",
      [slug],
    );
    return { units: r.rows[0].units, chars: Number(r.rows[0].chars) };
  }

  async function estimate(slug) {
    const { units, chars } = await bookTextStats(slug);
    const seconds = Math.round(chars / CHARS_PER_SECOND);
    return {
      units,
      chars,
      seconds,
      hours: Math.round((seconds / 3600) * 10) / 10,
      creditsPerSecond: AUDIO_CREDITS_PER_SEC,
      credits: Math.round(seconds * AUDIO_CREDITS_PER_SEC * 100) / 100,
      charsPerSecond: CHARS_PER_SECOND,
      note: 'Estimate: chars ÷ chars-per-second × audio credits-per-second. Actual Masky billing may differ.',
    };
  }

  // ── structure detection ───────────────────────────────────────────────────
  async function detectChapters(slug) {
    if (slug === 'bible-kjv') {
      return BIBLE_BOOKS.map(([title, summary], idx) => ({
        idx,
        id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title,
        preview: summary,
        previewTurnId: null,
        previewStatus: 'none', // none | pending | ready | error
        fullTurnIds: [],
        fullStatus: 'none',
        chars: 0,
        estSeconds: 0,
      }));
    }
    // Generic detection: refs are "<source_title> §N" chunks in ingestion order.
    // Heading-based chapter detection from the original text is the skill's
    // job (see SKILL.md § Chapter detection); until an author re-uploads with
    // structure, fall back to one chapter per source document.
    const r = await pool.query(
      "SELECT payload->>'source_title' AS title, min(id)::int AS first_id, count(*)::int AS units, sum(length(payload->>'text'))::bigint AS chars, (array_agg(payload->>'text' ORDER BY id))[1] AS first_text FROM units WHERE book_slug=$1 AND coalesce(payload->>'source_type','book')='book' GROUP BY 1 ORDER BY 2",
      [slug],
    );
    return r.rows.map((row, idx) => ({
      idx,
      id: `ch-${idx + 1}`,
      title: row.title ?? `Chapter ${idx + 1}`,
      preview: (row.first_text ?? '').slice(0, 420),
      previewTurnId: null,
      previewStatus: 'none',
      fullTurnIds: [],
      fullStatus: 'none',
      chars: Number(row.chars),
      estSeconds: Math.round(Number(row.chars) / CHARS_PER_SECOND),
    }));
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  async function startRender(slug, { test = true, release = 'free' } = {}) {
    const book = books[slug];
    if (!book) throw new Error('unknown book');
    const voice = {
      avatarId: book.avatarId ?? narrator.avatarId,
      avatarOwnerUserId: book.avatarOwner ?? narrator.owner,
    };
    const chapters = await detectChapters(slug);
    if (!chapters.length) throw new Error('no book text ingested — upload the book first');
    const conv = await fetch(`${MASKY}/conversations`, {
      method: 'POST',
      headers: maskyHeaders,
      body: JSON.stringify(voice),
    }).then((r) => r.json());
    if (!conv.conversationId) throw new Error(`conversation failed: ${JSON.stringify(conv).slice(0, 200)}`);

    const ab = {
      slug,
      version: 1,
      test,
      status: 'previews', // previews render now; 'ready' when all land
      release, // free | tribe | donation
      tribeUrl: audiobooks[slug]?.tribeUrl ?? null,
      voice,
      conversation: { id: conv.conversationId, shareSlug: conv.shareSlug, liveUrl: conv.liveUrl },
      estimate: await estimate(slug),
      grants: audiobooks[slug]?.grants ?? {},
      chapters,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    audiobooks[slug] = ab;
    save();

    // Inject one speak-mode audio turn per chapter preview, sequentially —
    // each turn text stays under the auto-chunk threshold so one chapter
    // preview maps to exactly one turn id.
    (async () => {
      for (const ch of ab.chapters) {
        const text = `${ch.title}. ${ch.preview}`.slice(0, TURN_TEXT_LIMIT);
        try {
          const res = await fetch(`${MASKY}/conversations/${conv.conversationId}/turn`, {
            method: 'POST',
            headers: maskyHeaders,
            body: JSON.stringify({ userText: text, mode: 'speak', output: 'audio' }),
          });
          const data = await res.json();
          if (res.ok && data.turn?.id) {
            ch.previewTurnId = data.turn.id;
            ch.previewStatus = 'pending';
          } else {
            ch.previewStatus = 'error';
            console.error('audiobook turn failed', slug, ch.id, JSON.stringify(data).slice(0, 200));
          }
        } catch (e) {
          ch.previewStatus = 'error';
          console.error('audiobook turn error', slug, ch.id, e.message);
        }
        ab.updatedAt = Date.now();
        save();
      }
      // Full render is short-circuited in test mode; the real pipeline is
      // specified in SKILL.md § Full render and lands in a later pass.
    })().catch((e) => console.error('audiobook render loop failed', slug, e.message));
    return ab;
  }

  // ── turn status refresh + fresh audio URLs ────────────────────────────────
  const convCache = new Map(); // shareSlug -> { at, turns }
  async function convTurns(shareSlug, maxAgeMs = 15000) {
    const hit = convCache.get(shareSlug);
    if (hit && Date.now() - hit.at < maxAgeMs) return hit.turns;
    const r = await fetch(`${MASKY}/conversations/by-slug/${shareSlug}`, { headers: maskyHeaders });
    if (!r.ok) throw new Error(`conversation read failed: ${r.status}`);
    const data = await r.json();
    const turns = data.turns ?? [];
    convCache.set(shareSlug, { at: Date.now(), turns });
    return turns;
  }

  async function refresh(slug) {
    const ab = audiobooks[slug];
    if (!ab?.conversation?.shareSlug) return ab;
    const pending = ab.chapters.some((c) => c.previewStatus === 'pending');
    if (!pending) return ab;
    const turns = await convTurns(ab.conversation.shareSlug);
    const byId = new Map(turns.map((t) => [t.id, t]));
    let changed = false;
    for (const ch of ab.chapters) {
      if (ch.previewStatus !== 'pending' || !ch.previewTurnId) continue;
      const t = byId.get(ch.previewTurnId);
      if (!t) continue;
      if (t.status === 'error') (ch.previewStatus = 'error'), (changed = true);
      else if (t.audioUrl) (ch.previewStatus = 'ready'), (changed = true);
    }
    if (changed) {
      if (ab.chapters.every((c) => c.previewStatus === 'ready' || c.previewStatus === 'error')) ab.status = 'ready';
      ab.updatedAt = Date.now();
      save();
    }
    return ab;
  }

  async function chapterAudioUrl(slug, idx, scope) {
    const ab = audiobooks[slug];
    const ch = ab?.chapters[idx];
    if (!ch) throw new Error('unknown chapter');
    const turnId = scope === 'preview' ? ch.previewTurnId : ch.fullTurnIds[0];
    if (!turnId) throw new Error(scope === 'preview' ? 'preview not rendered' : 'full audio not rendered');
    const turns = await convTurns(ab.conversation.shareSlug, 30000);
    const t = turns.find((x) => x.id === turnId);
    if (!t?.audioUrl) throw new Error('audio not ready');
    return { audioUrl: t.audioUrl, ttlNote: 'signed URL, ~1h — fetch again to replay later' };
  }

  // ── access gating ─────────────────────────────────────────────────────────
  // Tribe membership and user→user donations are NOT yet in the Masky API
  // (masky.md has neither) — asked of the Masky devs. Until then the author
  // grants access manually (POST …/grant) and the UI shows the join-tribe /
  // donate marketing to everyone else.
  function canListenFull(ab, userSub, isOwner) {
    if (!ab) return { ok: false, why: 'none' };
    if (isOwner) return { ok: true, why: 'owner' };
    if (ab.release === 'free') return { ok: true, why: 'free' };
    if (userSub && ab.grants[userSub]) return { ok: true, why: ab.grants[userSub].via };
    return { ok: false, why: ab.release }; // 'tribe' | 'donation' → UI shows the matching CTA
  }

  function publicView(ab, userSub, isOwner) {
    if (!ab) return null;
    const access = canListenFull(ab, userSub, isOwner);
    return {
      slug: ab.slug,
      status: ab.status,
      test: ab.test,
      release: ab.release,
      tribeUrl: ab.tribeUrl,
      estimate: isOwner ? ab.estimate : undefined,
      conversation: isOwner ? ab.conversation : undefined,
      access,
      chapters: ab.chapters.map((c) => ({
        idx: c.idx,
        id: c.id,
        title: c.title,
        preview: c.preview,
        previewStatus: c.previewStatus,
        fullStatus: c.fullStatus,
        estSeconds: c.estSeconds,
      })),
      updatedAt: ab.updatedAt,
    };
  }

  return {
    ready,
    get: (slug) => audiobooks[slug] ?? null,
    estimate,
    detectChapters,
    startRender,
    refresh,
    chapterAudioUrl,
    canListenFull,
    publicView,
    setSettings(slug, { release, tribeUrl }) {
      const ab = audiobooks[slug];
      if (!ab) throw new Error('no audiobook yet');
      if (release) {
        if (!['free', 'tribe', 'donation'].includes(release)) throw new Error('bad release');
        ab.release = release;
      }
      if (tribeUrl !== undefined) ab.tribeUrl = tribeUrl;
      ab.updatedAt = Date.now();
      save();
      return ab;
    },
    grant(slug, sub, via = 'manual') {
      const ab = audiobooks[slug];
      if (!ab) throw new Error('no audiobook yet');
      ab.grants[sub] = { via, at: Date.now() };
      save();
      return ab;
    },
    async downloadManifest(slug) {
      const ab = audiobooks[slug];
      if (!ab) throw new Error('no audiobook yet');
      const turns = await convTurns(ab.conversation.shareSlug, 5000);
      const byId = new Map(turns.map((t) => [t.id, t]));
      return {
        slug,
        test: ab.test,
        note: ab.test
          ? 'Test render: chapter previews only — full chapter audio not yet rendered.'
          : 'Full audiobook chapter audio.',
        ttlNote: 'URLs are signed (~1h). Download promptly or re-request.',
        chapters: ab.chapters.map((c) => ({
          idx: c.idx,
          title: c.title,
          preview: byId.get(c.previewTurnId)?.audioUrl ?? null,
          full: c.fullTurnIds.map((id) => byId.get(id)?.audioUrl ?? null),
        })),
      };
    },
  };
}
