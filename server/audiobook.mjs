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

// PDF page furniture: extraction page separators plus running headers
// (a repeated word + page number, or the book title + page number). The
// word-list is learned empirically from the corpus — a token that precedes a
// small number 8+ times is a running header, not prose. `(?!:)` protects
// scripture-style refs ("John 3:16").
export function pageFurniturePatterns(fullText, title) {
  const pats = [/--\s*\d+\s+of\s+\d+\s*--/g];
  const counts = {};
  for (const m of fullText.matchAll(/\b([A-Z][a-z]{2,})\s+\d{1,3}\b(?!:)/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  const skip = new Set(['Figure', 'Table', 'Page', 'Chapter', 'Part', 'Section']);
  for (const [w, n] of Object.entries(counts)) {
    if (n >= 8 && !skip.has(w)) pats.push(new RegExp(`\\b${w}\\s+\\d{1,3}\\b(?!:)`, 'g'));
  }
  if (title) {
    pats.push(new RegExp(`\\b${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\d{1,3}\\b(?!:)`, 'gi'));
  }
  return pats;
}

export function stripPageFurniture(text, patterns) {
  let t = text;
  for (const p of patterns) t = t.replace(p, ' ');
  return t.replace(/\s{2,}/g, ' ').trim();
}

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
  // "Book text" = units tagged source_type 'book' — plus units whose
  // source_title equals the book title: ingest normalizes book/PDF uploads to
  // that title, so this catches uploads saved before the ingest coercion fix
  // (e.g. a PDF uploaded with the dropdown still on 'podcast').
  // The filename test catches pre-normalization uploads where a PDF landed as
  // e.g. source_type 'podcast', source_title 'my book FINAL.pdf'.
  const BOOK_TEXT_WHERE =
    "book_slug=$1 AND (coalesce(payload->>'source_type','book') = 'book' OR payload->>'source_title' = $2 OR payload->>'source_title' ~* '\\.(pdf|docx?|txt|md|epub)\\s*$')";

  async function bookTextStats(slug) {
    // Sum the stored verbatim units — the exact text a full render would speak.
    const r = await pool.query(
      `SELECT count(*)::int AS units, coalesce(sum(length(payload->>'text')),0)::bigint AS chars FROM units WHERE ${BOOK_TEXT_WHERE}`,
      [slug, books[slug]?.title ?? ''],
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
        videoTurnId: null,
        videoStatus: 'none',
        videoSlug: null,
        fullTurnIds: [],
        fullStatus: 'none',
        chars: 0,
        estSeconds: 0,
      }));
    }
    // Generic detection: scan the book's ordered unit text for chapter
    // headings (chunking collapsed whitespace, so headings sit inline). A
    // chapter starts at the unit whose text carries the heading; its preview
    // is the prose right after it. No headings found → one chapter, the whole
    // book. Per-chapter unit id ranges feed the future full render.
    const r = await pool.query(
      `SELECT id::int, payload->>'text' AS text FROM units WHERE ${BOOK_TEXT_WHERE} ORDER BY id`,
      [slug, books[slug]?.title ?? ''],
    );
    if (!r.rows.length) return [];
    const WORDS = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
    const NUM = `\\d{1,3}|[IVXLCivxlc]{1,7}|${WORDS.join('|')}`;
    const HEADING = new RegExp(`(?:^|[\\s"'])((chapter|part|section)\\s+(${NUM}))\\b[.:;,–—-]?\\s*`, 'gi');
    const toInt = (s) => {
      const t = s.toLowerCase();
      if (/^\d+$/.test(t)) return Number(t);
      const w = WORDS.indexOf(t);
      if (w !== -1) return w + 1;
      const rv = { i: 1, v: 5, x: 10, l: 50, c: 100 };
      let n = 0;
      for (let k = 0; k < t.length; k++) n += rv[t[k]] < (rv[t[k + 1]] ?? 0) ? -rv[t[k]] : rv[t[k]];
      return n;
    };
    // Pass 1: every heading-shaped match, tagging TOC-ish units. A table of
    // contents shows dot leaders or several headings in one unit; running page
    // headers repeat an already-seen number. Both must not start chapters.
    const all = []; // { unitIdx, heading, type, num, after }
    const tocNames = {}; // chapter number -> name harvested from TOC entries
    for (let i = 0; i < r.rows.length; i++) {
      const text = r.rows[i].text;
      const inUnit = [...text.matchAll(HEADING)];
      const isToc = inUnit.length >= 2 || /(\.\s*){5,}|…/.test(text);
      if (isToc) {
        // Harvest "Chapter N: Name ....… 42" entries — the TOC is the one
        // place the PDF states chapter names explicitly.
        for (const t of text.matchAll(new RegExp(`chapter\\s+(${NUM})\\s*[:.–—-]?\\s*([A-Za-z][^…]{1,60}?)\\s*(?:\\.{2,}|…|\\d{1,3}\\b)`, 'gi'))) {
          const num = toInt(t[1]);
          const name = t[2].replace(/[\s.…\d]+$/, '').trim();
          if (name && !tocNames[num]) tocNames[num] = name;
        }
        continue;
      }
      for (const m of inUnit) {
        all.push({ unitIdx: i, heading: m[1].trim(), type: m[2].toLowerCase(), num: toInt(m[3]), after: text.slice((m.index ?? 0) + m[0].length) });
      }
    }
    // Pass 2: per type, accept only the strictly-sequential chain (1, 2, 3…).
    // Running headers repeat the current number and cross-references cite
    // arbitrary ones — both fail `num === expected` and drop out.
    const expected = { chapter: 1, part: 1, section: 1 };
    const chains = { chapter: [], part: [], section: [] };
    for (const m of all) {
      if (m.num === expected[m.type]) {
        expected[m.type] += 1;
        chains[m.type].push(m);
      }
    }
    // Parts OVERLAY chapters (a part contains chapters), and a late stray
    // "Part 1" in backmatter can swallow the book's tail — so when the
    // chapter chain is strong, it alone defines the chapters.
    const starts =
      chains.chapter.length >= 3
        ? chains.chapter
        : [...chains.chapter, ...chains.part, ...chains.section].sort((a, b) => a.unitIdx - b.unitIdx);
    const title = (t) => t.replace(/\s+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    const mk = (idx, name, firstUnit, lastUnit, preview) => {
      const chars = r.rows.slice(firstUnit, lastUnit + 1).reduce((n, row) => n + row.text.length, 0);
      return {
        idx,
        id: `ch-${idx + 1}`,
        title: name,
        preview: preview.slice(0, 420),
        previewTurnId: null,
        previewStatus: 'none',
        videoTurnId: null,
        videoStatus: 'none',
        videoSlug: null,
        fullTurnIds: [],
        fullStatus: 'none',
        firstUnitId: r.rows[firstUnit].id,
        lastUnitId: r.rows[lastUnit].id,
        chars,
        estSeconds: Math.round(chars / CHARS_PER_SECOND),
      };
    };
    // Require a few headings before trusting the pattern — one stray
    // "chapter twelve" mid-sentence must not split the book in two.
    if (starts.length < 3) {
      return [mk(0, books[slug]?.title ?? 'The book', 0, r.rows.length - 1, r.rows[0].text)];
    }
    const chapters = [];
    if (starts[0].unitIdx > 0) {
      chapters.push(mk(0, 'Opening', 0, starts[0].unitIdx - 1, r.rows[0].text));
    }
    for (let s = 0; s < starts.length; s++) {
      const st = starts[s];
      const lastUnit = s + 1 < starts.length ? Math.max(starts[s + 1].unitIdx - 1, st.unitIdx) : r.rows.length - 1;
      let preview = (st.after.length > 120 ? st.after : `${st.after} ${r.rows[st.unitIdx + 1]?.text ?? ''}`).trim();
      // TOC gave us the real name → "Chapter 1: Our Stories"; and when the
      // body text opens by repeating that name, strip it so the preview is
      // prose, not the title again.
      const name = st.type === 'chapter' ? tocNames[st.num] : null;
      const chTitle = name ? `${title(st.heading)}: ${name}` : title(st.heading);
      if (name && preview.toLowerCase().startsWith(name.toLowerCase())) {
        preview = preview.slice(name.length).replace(/^[\s.:–—-]+/, '');
      }
      chapters.push(mk(chapters.length, chTitle, st.unitIdx, lastUnit, preview));
    }
    return chapters;
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  async function startRender(slug, { test = true, release = 'free' } = {}) {
    const book = books[slug];
    if (!book) throw new Error('unknown book');
    const voice = {
      avatarId: book.authorAvatarId ?? narrator.avatarId,
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
    const pending = ab.chapters.some((c) => c.previewStatus === 'pending' || c.videoStatus === 'pending');
    if (!pending) return ab;
    const turns = await convTurns(ab.conversation.shareSlug);
    const byId = new Map(turns.map((t) => [t.id, t]));
    let changed = false;
    for (const ch of ab.chapters) {
      if (ch.previewStatus === 'pending' && ch.previewTurnId) {
        const t = byId.get(ch.previewTurnId);
        if (t?.status === 'error') (ch.previewStatus = 'error'), (changed = true);
        else if (t?.audioUrl) (ch.previewStatus = 'ready'), (changed = true);
      }
      if (ch.videoStatus === 'pending' && ch.videoTurnId) {
        const t = byId.get(ch.videoTurnId);
        if (t?.status === 'error') (ch.videoStatus = 'error'), (changed = true);
        else if (t?.videoUrl) {
          ch.videoStatus = 'ready';
          ch.videoSlug = t.shareSlug ?? null;
          changed = true;
        }
      }
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
  // Tribe + donation checks use Masky's shipped API (masky.md § Tribes &
  // credit gifts) with the READER's own token: GET /tribes/{owner} answers
  // isMember for the token holder; GET /donations/sent?to={owner} totals the
  // token holder's gifts to the author. The tribe owner identifier is the
  // book's avatarOwner Masky uid. Manual grants remain as an override, and a
  // passing live check writes a grant so later checks are instant.
  function canListenFull(ab, userSub, isOwner) {
    if (!ab) return { ok: false, why: 'none' };
    if (isOwner) return { ok: true, why: 'owner' };
    if (ab.release === 'free') return { ok: true, why: 'free' };
    if (userSub && ab.grants[userSub]) return { ok: true, why: ab.grants[userSub].via };
    return { ok: false, why: ab.release }; // 'tribe' | 'donation' → UI shows the matching CTA
  }

  const accessCache = new Map(); // `${slug}:${token.slice(-16)}` -> { at, result }
  async function checkAccess(slug, userToken, userSub, isOwner) {
    const ab = audiobooks[slug];
    const base = canListenFull(ab, userSub, isOwner);
    const tribeOwner = books[slug]?.avatarOwner ?? null;
    const meta = ab
      ? { release: ab.release, donationMin: ab.donationMin ?? null, tribeOwner }
      : {};
    if (base.ok || !userToken || !tribeOwner) return { ...base, ...meta };
    const key = `${slug}:${userToken.slice(-16)}`;
    const hit = accessCache.get(key);
    if (hit && Date.now() - hit.at < 60000) return { ...hit.result, ...meta };
    const result = { ...base };
    try {
      if (ab.release === 'tribe') {
        const r = await fetch(`${MASKY}/tribes/${encodeURIComponent(tribeOwner)}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const d = r.ok ? await r.json() : null;
        if (d?.isMember || d?.isOwner) {
          result.ok = true;
          result.why = 'tribe-member';
          if (userSub) {
            ab.grants[userSub] = { via: 'tribe', at: Date.now() };
            save();
          }
        }
      } else if (ab.release === 'donation') {
        const min = Number(ab.donationMin ?? 0) || 0;
        const r = await fetch(`${MASKY}/donations/sent?to=${encodeURIComponent(tribeOwner)}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const d = r.ok ? await r.json() : null;
        result.donatedTotal = Number(d?.total ?? 0) || 0;
        if (min > 0 && result.donatedTotal >= min) {
          result.ok = true;
          result.why = 'donation';
          if (userSub) {
            ab.grants[userSub] = { via: 'donation', at: Date.now() };
            save();
          }
        }
      }
    } catch (e) {
      console.error('access check failed', slug, e.message);
    }
    accessCache.set(key, { at: Date.now(), result });
    return { ...result, ...meta };
  }

  function publicView(ab, userSub, isOwner, accessOverride) {
    if (!ab) return null;
    const access = accessOverride ?? canListenFull(ab, userSub, isOwner);
    return {
      slug: ab.slug,
      status: ab.status,
      test: ab.test,
      release: ab.release,
      donationMin: ab.donationMin ?? null,
      buyLinks: ab.buyLinks ?? [],
      tribeOwner: books[ab.slug]?.avatarOwner ?? null,
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
        videoStatus: c.videoStatus ?? 'none',
        videoLiveUrl: c.videoSlug ? `https://masky.ai/live/t-${c.videoSlug}` : null,
        fullStatus: c.fullStatus,
        estSeconds: c.estSeconds,
      })),
      updatedAt: ab.updatedAt,
    };
  }

  // Re-render ONE chapter — as audio (replacing its preview) or as a video
  // take. Re-detects first so a text cleanup/patch flows into the new turn;
  // stored chapter keeps its identity (turn ids) when detection still aligns.
  async function rerenderChapter(slug, idx, output = 'audio') {
    const ab = audiobooks[slug];
    const ch = ab?.chapters[idx];
    if (!ch) throw new Error('unknown chapter');
    const fresh = await detectChapters(slug);
    if (fresh.length === ab.chapters.length && fresh[idx]) {
      ch.title = fresh[idx].title;
      ch.preview = fresh[idx].preview;
    }
    const text = `${ch.title}. ${ch.preview}`.slice(0, TURN_TEXT_LIMIT);
    const res = await fetch(`${MASKY}/conversations/${ab.conversation.id}/turn`, {
      method: 'POST',
      headers: maskyHeaders,
      body: JSON.stringify({ userText: text, mode: 'speak', output }),
    });
    const data = await res.json();
    if (!res.ok || !data.turn?.id) throw new Error(`turn failed: ${JSON.stringify(data).slice(0, 200)}`);
    if (output === 'video') {
      ch.videoTurnId = data.turn.id;
      ch.videoStatus = 'pending';
      ch.videoSlug = null;
    } else {
      ch.previewTurnId = data.turn.id;
      ch.previewStatus = 'pending';
    }
    if (ab.status === 'ready') ab.status = 'previews';
    ab.updatedAt = Date.now();
    save();
    return ab;
  }

  // Strip page furniture from every stored book-text unit (post-hoc twin of
  // the at-ingest stripping). Patterns are learned corpus-wide, applied
  // per unit. Returns counts; embeddings are left as-is (a few header tokens
  // don't move a 700-char chunk's vector meaningfully).
  async function cleanUnits(slug) {
    const r = await pool.query(
      `SELECT id::int, payload->>'text' AS text FROM units WHERE ${BOOK_TEXT_WHERE} ORDER BY id`,
      [slug, books[slug]?.title ?? ''],
    );
    const corpus = r.rows.map((x) => x.text).join('\n');
    const pats = pageFurniturePatterns(corpus, books[slug]?.title ?? '');
    let changed = 0;
    let removed = 0;
    for (const row of r.rows) {
      const next = stripPageFurniture(row.text, pats);
      if (next !== row.text) {
        await pool.query(
          "UPDATE units SET payload = payload || jsonb_build_object('text', $3::text) WHERE book_slug=$1 AND id=$2",
          [slug, row.id, next],
        );
        changed += 1;
        removed += row.text.length - next.length;
      }
    }
    return { units: r.rows.length, changed, removedChars: removed, patterns: pats.length };
  }

  return {
    ready,
    rerenderChapter,
    cleanUnits,
    get: (slug) => audiobooks[slug] ?? null,
    estimate,
    detectChapters,
    startRender,
    refresh,
    chapterAudioUrl,
    canListenFull,
    publicView,
    setSettings(slug, { release, tribeUrl, donationMin, buyLinks }) {
      const ab = audiobooks[slug];
      if (!ab) throw new Error('no audiobook yet');
      if (release) {
        if (!['free', 'tribe', 'donation'].includes(release)) throw new Error('bad release');
        ab.release = release;
      }
      if (tribeUrl !== undefined) ab.tribeUrl = tribeUrl;
      if (donationMin !== undefined) {
        const n = Number(donationMin);
        if (!Number.isFinite(n) || n < 0) throw new Error('bad donationMin');
        ab.donationMin = n;
      }
      if (buyLinks !== undefined) {
        if (!Array.isArray(buyLinks) || buyLinks.length > 10) throw new Error('bad buyLinks');
        ab.buyLinks = buyLinks
          .map((l) => ({ label: String(l.label ?? '').slice(0, 60), url: String(l.url ?? '') }))
          .filter((l) => /^https?:\/\//i.test(l.url));
      }
      ab.updatedAt = Date.now();
      save();
      return ab;
    },
    checkAccess,
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
