import { useEffect, useRef, useState } from 'react';
import { login, type MaskySession } from './lib/masky';
import AvatarModal, { type PickedAvatar } from './AvatarModal';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';
const MASKY = 'https://masky.ai/api';

interface Chapter {
  idx: number;
  id: string;
  title: string;
  preview: string;
  titleEdited?: boolean;
  previewEdited?: boolean;
  previewStatus: string;
  videoStatus: string;
  videoLiveUrl: string | null;
  fullStatus: string;
  estSeconds: number;
}
// Pre-render review state: what the ↻/🎬 popup edits before rendering.
interface RerenderDraft {
  idx: number;
  output: 'audio' | 'video';
  title: string;
  preview: string;
  initTitle: string;
  initPreview: string;
}
interface MaskyAvatar {
  avatarId: string;
  avatarOwnerUserId: string;
  displayName: string;
  avatarImageUrl?: string;
  imageUrl?: string;
}
interface Audiobook {
  slug: string;
  status: string;
  test: boolean;
  release: 'free' | 'tribe' | 'donation';
  donationMin: number | null;
  buyLinks: { label: string; url: string }[];
  tribeOwner: string | null;
  tribeUrl: string | null;
  estimate?: { chars: number; seconds: number; hours: number; credits: number; creditsPerSecond: number; note: string };
  access: { ok: boolean; why: string; donatedTotal?: number };
  chapters: Chapter[];
}

// The Listen section of a living book: chapter previews as tabs over one
// detail pane (video takes auto-play on tab click), Play All with
// auto-advance, gated full chapters (free / Masky tribe / donation-total via
// the Masky API), and the author settings — avatar, release criteria,
// renders — as the first tab.
export default function Listen({
  slug,
  session,
  isOwner,
  bookAvatarImage,
  bookTitle,
}: {
  slug: string;
  session: MaskySession | null;
  isOwner: boolean;
  bookAvatarImage?: string | null;
  bookTitle?: string;
}) {
  const [ab, setAb] = useState<Audiobook | null | 'loading'>('loading');
  const [sel, setSel] = useState<number | 'settings'>(0);
  const [tabClicked, setTabClicked] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [avatars, setAvatars] = useState<MaskyAvatar[]>([]);
  const [choosingAvatar, setChoosingAvatar] = useState(false);
  const [picked, setPicked] = useState<PickedAvatar | null>(null);
  const [avatarImage, setAvatarImage] = useState<string | null>(bookAvatarImage ?? null);
  const [linkDraft, setLinkDraft] = useState<{ label: string; url: string }[] | null>(null);
  const [rerenderDraft, setRerenderDraft] = useState<RerenderDraft | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playAllRef = useRef(false);
  const abRef = useRef<Audiobook | null>(null);

  const authHeaders: Record<string, string> = session ? { Authorization: `Bearer ${session.accessToken}` } : {};

  const reload = () =>
    fetch(`${API}/api/books/${slug}/audiobook`, { headers: authHeaders, cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setAb(d.audiobook ?? null);
        abRef.current = d.audiobook ?? null;
      })
      .catch(() => setAb(null));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Keep polling while any render is in flight.
  useEffect(() => {
    if (ab === 'loading' || !ab || ab.status === 'ready') return;
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ab && typeof ab === 'object' ? ab.status : ab]);

  useEffect(() => {
    if (!choosingAvatar || !session || avatars.length) return;
    fetch(`${MASKY}/avatars`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((r) => r.json())
      .then((d) => setAvatars(d.avatars ?? []))
      .catch(() => {});
  }, [choosingAvatar, session, avatars.length]);

  function stopAll() {
    playAllRef.current = false;
    setPlayingAll(false);
    audioRef.current?.pause();
    setPlaying(null);
  }

  async function playChapter(idx: number, scope: 'preview' | 'full'): Promise<void> {
    setError(null);
    setBusy(`play-${idx}`);
    try {
      const r = await fetch(`${API}/api/books/${slug}/audiobook/chapter/${idx}/audio?scope=${scope}`, {
        headers: authHeaders,
        cache: 'no-store',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      if (!d.audioUrl) throw new Error('audio not available yet');
      audioRef.current?.pause();
      const el = new Audio(d.audioUrl);
      audioRef.current = el;
      setPlaying(idx);
      el.onended = () => {
        setPlaying(null);
        if (!playAllRef.current) return;
        const chapters = abRef.current?.chapters ?? [];
        const next = chapters.find((c) => c.idx > idx && c.previewStatus === 'ready');
        if (next) {
          setSel(next.idx);
          setTabClicked(false);
          void playChapter(next.idx, 'preview');
        } else {
          stopAll();
        }
      };
      await el.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      stopAll();
    } finally {
      setBusy(null);
    }
  }

  function playAll() {
    const chapters = abRef.current?.chapters ?? [];
    const first = chapters.find((c) => c.previewStatus === 'ready');
    if (!first) return;
    playAllRef.current = true;
    setPlayingAll(true);
    setSel(first.idx);
    setTabClicked(false);
    void playChapter(first.idx, 'preview');
  }

  async function authorPost(path: string, body?: object) {
    setBusy(path);
    setError(null);
    try {
      const r = await fetch(`${API}/api/books/${slug}/audiobook${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: body ? JSON.stringify(body) : '{}',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      await reload();
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // ── gate actions (reader side, Masky API with the reader's own token) ─────
  async function joinTribe() {
    const abx = abRef.current;
    if (!session || !abx?.tribeOwner) return login();
    setBusy('join');
    setError(null);
    try {
      const info = await fetch(`${MASKY}/tribes/${encodeURIComponent(abx.tribeOwner)}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).then((r) => r.json());
      if (info.isMember) {
        await reload();
        return;
      }
      const cost = info.joinCost ?? '?';
      if (!window.confirm(`Join ${info.tribeName ?? 'this tribe'} for ${cost} Masky credits? (Free for the creator's active Twitch subs.)`)) return;
      const r = await fetch(`${MASKY}/tribes/${encodeURIComponent(abx.tribeOwner)}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error ?? `join failed (${r.status})`);
      setNotice('Welcome to the tribe! Unlocking the book…');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function donate() {
    const abx = abRef.current;
    if (!session || !abx?.tribeOwner) return login();
    const min = abx.donationMin ?? 0;
    const already = abx.access.donatedTotal ?? 0;
    const suggested = Math.max(min - already, 1);
    const raw = window.prompt(
      `Donate Masky credits to the author. You've donated ${already} so far; ${min} total unlocks the full book.`,
      String(suggested),
    );
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a positive credit amount.');
    setBusy('donate');
    setError(null);
    try {
      const r = await fetch(`${MASKY}/donations/intents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: abx.tribeOwner, amount, note: `Unlock the ${bookTitle ?? slug} audiobook` }),
      });
      const d = await r.json();
      if (!r.ok || !d.intentId) throw new Error(d.error ?? `donation propose failed (${r.status})`);
      window.open(d.confirmUrl, 'masky-donate', 'width=480,height=640');
      setNotice('Confirm the gift in the Masky window — this page updates automatically once confirmed.');
      // Poll the intent until it resolves (intents expire after 10 minutes).
      for (let i = 0; i < 60; i++) {
        await new Promise((ok) => setTimeout(ok, 3000));
        const s = await fetch(`${MASKY}/donations/intents/${d.intentId}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }).then((x) => x.json()).catch(() => null);
        if (s?.status === 'confirmed') {
          setNotice('Gift confirmed — thank you! Unlocking…');
          await reload();
          return;
        }
        if (s?.status === 'cancelled' || s?.status === 'expired') {
          setNotice(`Gift ${s.status}.`);
          return;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (ab === 'loading') return null;

  if (!ab) {
    if (!isOwner) return null;
    return (
      <section className="panel listen">
        <h2>🎧 Audio book</h2>
        <p className="sub">
          Render this book as an audio book read by its avatar. Estimate the cost, pick who can
          listen, and release chapter previews free.
        </p>
        <button className="cta" disabled={busy !== null} onClick={() => authorPost('/render', { test: true, release: 'free' })}>
          {busy ? 'Starting…' : 'Render test previews'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  const gate =
    ab.access.ok ? null : ab.release === 'tribe' ? (
      <p className="listen-gate">
        🔒 Full chapters are for the author&rsquo;s Masky tribe.{' '}
        {session ? (
          <button className="linklike" disabled={busy !== null} onClick={joinTribe}>
            Join the tribe to unlock the whole book
          </button>
        ) : (
          <button className="linklike" onClick={() => login()}>Login with Masky to join the tribe.</button>
        )}
      </p>
    ) : ab.release === 'donation' ? (
      <p className="listen-gate">
        🔒 Donating {ab.donationMin ?? '?'} Masky credits to the author unlocks the full book
        {(ab.access.donatedTotal ?? 0) > 0 ? ` (you've donated ${ab.access.donatedTotal} so far)` : ''}.{' '}
        {session ? (
          <button className="linklike" disabled={busy !== null} onClick={donate}>
            {busy === 'donate' ? 'Waiting for confirmation…' : 'Donate to unlock'}
          </button>
        ) : (
          <button className="linklike" onClick={() => login()}>Login with Masky to donate.</button>
        )}
      </p>
    ) : null;

  const selCh = typeof sel === 'number' ? ab.chapters[sel] : null;

  return (
    <section className="panel listen">
      <h2>🎧 Listen{ab.test ? ' — chapter previews' : ''}</h2>
      <p className="sub">
        Every chapter&rsquo;s opening, read by the book&rsquo;s own voice — free.{' '}
        {ab.release === 'tribe'
          ? 'Full chapters are for tribe members.'
          : ab.release === 'donation'
            ? 'Full chapters unlock with a donation to the author.'
            : ''}
        {ab.status !== 'ready' && ' Rendering is in progress — new takes appear automatically.'}
      </p>

      <div className="listen-playall">
        {playingAll ? (
          <button className="cta" onClick={stopAll}>⏹ Stop</button>
        ) : (
          <button
            className="cta"
            disabled={busy !== null || !ab.chapters.some((c) => c.previewStatus === 'ready')}
            onClick={playAll}
          >
            ▶ Play All
          </button>
        )}
      </div>

      <div className="listen-tabs" role="tablist" aria-label="Chapters">
        {isOwner && (
          <button
            role="tab"
            aria-selected={sel === 'settings'}
            className={sel === 'settings' ? 'listen-tab active' : 'listen-tab'}
            onClick={() => setSel('settings')}
          >
            ⚙ Author Settings
          </button>
        )}
        {ab.chapters.map((ch) => (
          <button
            key={ch.id}
            role="tab"
            aria-selected={sel === ch.idx}
            className={sel === ch.idx ? 'listen-tab active' : 'listen-tab'}
            onClick={() => {
              stopAll();
              setSel(ch.idx);
              setTabClicked(true);
            }}
          >
            {ch.title}
          </button>
        ))}
      </div>

      {sel === 'settings' && isOwner && (
        <div className="listen-detail listen-owner">
          <div className="listen-avatar">
            {avatarImage && <img className="avatar" src={avatarImage} alt="book avatar" />}
            <span className="sub">This avatar reads the book. Changes apply on the next render.</span>
            <button className="ghost" onClick={() => setChoosingAvatar((v) => !v)}>
              {choosingAvatar ? 'Cancel' : '👤 Change avatar'}
            </button>
          </div>
          {choosingAvatar && (
            <div className="avatargrid">
              {avatars.map((av) => (
                <button
                  key={av.avatarId}
                  className="avatarcard"
                  onClick={() =>
                    setPicked({
                      avatarId: av.avatarId,
                      avatarOwnerUserId: av.avatarOwnerUserId,
                      displayName: av.displayName,
                      imageUrl: av.avatarImageUrl ?? av.imageUrl ?? '',
                    })
                  }
                >
                  {(av.avatarImageUrl ?? av.imageUrl) && <img src={av.avatarImageUrl ?? av.imageUrl} alt={av.displayName} />}
                  <span>{av.displayName}</span>
                </button>
              ))}
              {!avatars.length && <span className="sub">Loading your Masky avatars…</span>}
            </div>
          )}
          {ab.estimate && (
            <p className="sub">
              Full render estimate: ~{ab.estimate.hours} h of audio (~{Math.round(ab.estimate.seconds / 60)} min,{' '}
              {ab.estimate.chars.toLocaleString()} chars) ≈ <strong>{ab.estimate.credits} Masky credits</strong>{' '}
              at {ab.estimate.creditsPerSecond}/sec. {ab.test && 'This is a TEST render — previews only.'}
            </p>
          )}
          <div className="listen-release">
            Who can hear full chapters?
            {(['free', 'tribe', 'donation'] as const).map((r) => (
              <label key={r}>
                <input
                  type="radio"
                  name="release"
                  checked={ab.release === r}
                  disabled={busy !== null}
                  onChange={() => authorPost('/settings', { release: r })}
                />
                {r === 'free' ? 'Everyone, free' : r === 'tribe' ? 'My Masky tribe' : 'Donation required'}
              </label>
            ))}
          </div>
          {ab.release === 'donation' && (
            <label className="listen-donmin">
              Minimum total donation (credits):{' '}
              <input
                type="number"
                min={1}
                defaultValue={ab.donationMin ?? 5}
                onBlur={(e) => authorPost('/settings', { donationMin: Number(e.target.value) })}
              />
            </label>
          )}
          <div className="listen-buylinks-edit">
            <h4>Buy links</h4>
            <p className="sub">Where readers can buy the book — shown as a &ldquo;Buy it&rdquo; section on this page.</p>
            {(linkDraft ?? ab.buyLinks ?? []).map((l, i) => (
              <div className="askrow" key={i}>
                <input
                  placeholder="Label (e.g. Amazon)"
                  value={l.label}
                  onChange={(e) => {
                    const next = [...(linkDraft ?? ab.buyLinks ?? [])];
                    next[i] = { ...next[i], label: e.target.value };
                    setLinkDraft(next);
                  }}
                />
                <input
                  placeholder="https://…"
                  value={l.url}
                  onChange={(e) => {
                    const next = [...(linkDraft ?? ab.buyLinks ?? [])];
                    next[i] = { ...next[i], url: e.target.value };
                    setLinkDraft(next);
                  }}
                />
                <button
                  className="ghost"
                  onClick={() => setLinkDraft((linkDraft ?? ab.buyLinks ?? []).filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="alertactions">
              <button className="ghost" onClick={() => setLinkDraft([...(linkDraft ?? ab.buyLinks ?? []), { label: '', url: '' }])}>
                + Add link
              </button>
              {linkDraft && (
                <button
                  className="cta"
                  disabled={busy !== null}
                  onClick={async () => {
                    await authorPost('/settings', { buyLinks: linkDraft.filter((l) => l.url.trim()) });
                    setLinkDraft(null);
                  }}
                >
                  Save buy links
                </button>
              )}
            </div>
          </div>
          <div className="alertactions">
            <button
              className="ghost"
              disabled={busy !== null}
              onClick={() => authorPost('/render', { test: true, release: ab.release })}
            >
              {busy === '/render' ? 'Starting…' : '↻ Re-render all previews'}
            </button>
            <button
              className="ghost"
              disabled={busy === 'download'}
              onClick={async () => {
                setBusy('download');
                setError(null);
                try {
                  const r = await fetch(`${API}/api/books/${slug}/audiobook/download`, { headers: authHeaders });
                  const d = await r.json().catch(() => ({}));
                  if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
                  a.download = `${slug}-audiobook-manifest.json`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === 'download' ? 'Fetching…' : '⬇ Download render manifest'}
            </button>
          </div>
        </div>
      )}

      {selCh && (
        <div className="listen-detail">
          <div className="listen-row">
            <h3 className="listen-chtitle">{selCh.title}</h3>
            {selCh.previewStatus === 'ready' ? (
              playing === selCh.idx ? (
                <button className="ghost" onClick={stopAll}>⏸ Stop</button>
              ) : (
                <button className="ghost" disabled={busy !== null} onClick={() => playChapter(selCh.idx, 'preview')}>
                  ▶ Preview
                </button>
              )
            ) : (
              <span className="sub">{selCh.previewStatus === 'error' ? 'preview failed' : 'rendering…'}</span>
            )}
            {!ab.test && selCh.fullStatus === 'ready' && ab.access.ok && (
              <button className="ghost" disabled={busy !== null} onClick={() => playChapter(selCh.idx, 'full')}>
                ▶ Full chapter
              </button>
            )}
            {selCh.videoStatus === 'pending' && <span className="sub">video rendering…</span>}
            {isOwner && (
              <>
                <button
                  className="ghost"
                  disabled={busy !== null}
                  title="Review & re-render this chapter's audio preview"
                  onClick={() =>
                    setRerenderDraft({
                      idx: selCh.idx,
                      output: 'audio',
                      title: selCh.title,
                      preview: selCh.preview,
                      initTitle: selCh.title,
                      initPreview: selCh.preview,
                    })
                  }
                >
                  ↻
                </button>
                <button
                  className="ghost"
                  disabled={busy !== null || selCh.videoStatus === 'pending'}
                  title="Review & render this chapter's preview as avatar video"
                  onClick={() =>
                    setRerenderDraft({
                      idx: selCh.idx,
                      output: 'video',
                      title: selCh.title,
                      preview: selCh.preview,
                      initTitle: selCh.title,
                      initPreview: selCh.preview,
                    })
                  }
                >
                  🎬
                </button>
                {(selCh.titleEdited || selCh.previewEdited) && (
                  <span className="sub" title="You've hand-corrected this chapter — auto-detection won't overwrite it.">✎ edited</span>
                )}
              </>
            )}
          </div>
          <p className="listen-preview">{selCh.preview}</p>
          {selCh.videoStatus === 'ready' && selCh.videoLiveUrl && (
            <iframe
              key={`${selCh.id}-${tabClicked ? 'auto' : 'still'}`}
              className="player"
              src={`${selCh.videoLiveUrl}?autoplay=${tabClicked ? 1 : 0}`}
              title={`${selCh.title} — video`}
              allow="autoplay"
              allowFullScreen
            />
          )}
          {gate}
        </div>
      )}

      {(ab.buyLinks?.length ?? 0) > 0 && (
        <div className="listen-buyit">
          <h3>📖 Buy it</h3>
          <div className="listen-buyrow">
            {ab.buyLinks.map((l, i) => (
              <a key={i} className="cta" href={l.url} target="_blank" rel="noreferrer">
                {l.label || new URL(l.url).hostname.replace(/^www\./, '')}
              </a>
            ))}
          </div>
          {(ab.donationMin ?? 0) > 0 && ab.tribeOwner && (
            <p className="sub">
              Or support the author directly:{' '}
              {session ? (
                <button className="linklike" disabled={busy !== null} onClick={donate}>
                  {busy === 'donate' ? 'Waiting for confirmation…' : `donate Masky credits${ab.release === 'donation' ? ` (${ab.donationMin} total unlocks the full audiobook)` : ''}`}
                </button>
              ) : (
                <button className="linklike" onClick={() => login()}>
                  Login with Masky to donate credits to the author.
                </button>
              )}
            </p>
          )}
        </div>
      )}
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {rerenderDraft && (
        <div className="modal-backdrop" onClick={() => setRerenderDraft(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{rerenderDraft.output === 'video' ? '🎬 Render video take' : '↻ Re-render preview'}</h3>
              <button className="ghost" onClick={() => setRerenderDraft(null)}>✕</button>
            </div>
            <p className="sub">
              This is exactly what the avatar will read. Chapter detection is automatic and can get
              titles or opening text wrong (PDF page headers bleed into prose) — fix anything below
              before rendering. Your corrections stick: auto-detection won&rsquo;t overwrite them.
            </p>
            <label className="listen-editfield">
              Chapter title
              <input
                value={rerenderDraft.title}
                maxLength={120}
                onChange={(e) => setRerenderDraft({ ...rerenderDraft, title: e.target.value })}
              />
            </label>
            <label className="listen-editfield">
              Preview text ({rerenderDraft.preview.length}/420 chars)
              <textarea
                rows={7}
                value={rerenderDraft.preview}
                maxLength={420}
                onChange={(e) => setRerenderDraft({ ...rerenderDraft, preview: e.target.value })}
              />
            </label>
            <p className="sub">
              Spoken as &ldquo;{rerenderDraft.title}. …&rdquo; — title + text beyond 499 characters
              total is trimmed to keep one clean take.
            </p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setRerenderDraft(null)}>Cancel</button>
              <button
                className="cta"
                disabled={busy !== null || !rerenderDraft.title.trim() || !rerenderDraft.preview.trim()}
                onClick={async () => {
                  const d = rerenderDraft;
                  // Only send fields the author actually changed — unchanged
                  // fields stay un-pinned so detection improvements flow in.
                  await authorPost(`/chapter/${d.idx}/rerender`, {
                    output: d.output,
                    ...(d.title.trim() !== d.initTitle ? { title: d.title.trim() } : {}),
                    ...(d.preview.trim() !== d.initPreview ? { preview: d.preview.trim() } : {}),
                  });
                  setRerenderDraft(null);
                }}
              >
                {busy ? 'Rendering…' : rerenderDraft.output === 'video' ? 'Render video' : 'Re-render audio'}
              </button>
            </div>
          </div>
        </div>
      )}
      {picked && session && (
        <AvatarModal
          session={session}
          avatar={picked}
          bookTitle={bookTitle ?? slug}
          saving={busy !== null}
          onClose={() => setPicked(null)}
          onSave={async (imageUrl) => {
            setBusy('avatar');
            setError(null);
            try {
              const r = await fetch(`${API}/api/books/${slug}/avatar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                  avatarId: picked.avatarId,
                  avatarOwnerUserId: picked.avatarOwnerUserId,
                  avatarImage: imageUrl,
                }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
              setAvatarImage(imageUrl);
              setPicked(null);
              setChoosingAvatar(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          }}
        />
      )}
    </section>
  );
}
