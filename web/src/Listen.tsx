import { useEffect, useRef, useState } from 'react';
import { login, type MaskySession } from './lib/masky';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';

interface Chapter {
  idx: number;
  id: string;
  title: string;
  preview: string;
  previewStatus: string;
  fullStatus: string;
  estSeconds: number;
}
interface Audiobook {
  slug: string;
  status: string;
  test: boolean;
  release: 'free' | 'tribe' | 'donation';
  tribeUrl: string | null;
  estimate?: { chars: number; seconds: number; hours: number; credits: number; creditsPerSecond: number; note: string };
  access: { ok: boolean; why: string };
  chapters: Chapter[];
}

// The Listen section of a living book: free chapter previews (the avatar
// reading each chapter's opening), gated full-chapter audio, and — for the
// author — the render/settings panel (estimate, release criteria, download).
export default function Listen({ slug, session, isOwner }: { slug: string; session: MaskySession | null; isOwner: boolean }) {
  const [ab, setAb] = useState<Audiobook | null | 'loading'>('loading');
  const [playing, setPlaying] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const authHeaders: Record<string, string> = session ? { Authorization: `Bearer ${session.accessToken}` } : {};

  const reload = () =>
    fetch(`${API}/api/books/${slug}/audiobook`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => setAb(d.audiobook ?? null))
      .catch(() => setAb(null));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Keep polling while previews are still rendering.
  useEffect(() => {
    if (ab === 'loading' || !ab || ab.status === 'ready') return;
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ab && typeof ab === 'object' ? ab.status : ab]);

  async function play(idx: number, scope: 'preview' | 'full') {
    setError(null);
    setBusy(`play-${idx}-${scope}`);
    try {
      const r = await fetch(`${API}/api/books/${slug}/audiobook/chapter/${idx}/audio?scope=${scope}`, {
        headers: authHeaders,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      if (!d.audioUrl) throw new Error('audio not available yet');
      if (audioRef.current) audioRef.current.pause();
      const el = new Audio(d.audioUrl);
      audioRef.current = el;
      setPlaying(idx);
      el.onended = () => setPlaying(null);
      await el.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function stop() {
    audioRef.current?.pause();
    setPlaying(null);
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

  if (ab === 'loading') return null;

  // No audiobook yet: show the author entry point; readers see nothing.
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

  const gate = (why: string) =>
    why === 'tribe' ? (
      <span className="listen-gate">
        🔒 Full chapters are for the author&rsquo;s tribe —{' '}
        <a href={ab.tribeUrl ?? 'https://masky.ai'} target="_blank" rel="noreferrer">
          join the tribe on Masky
        </a>{' '}
        to unlock the whole book.
      </span>
    ) : (
      <span className="listen-gate">
        🔒 Full chapters unlock with a donation to the author on Masky.{' '}
        {session ? 'Donate from your Masky account, then ask the author to grant access.' : (
          <button className="linklike" onClick={() => login()}>Login with Masky to get started.</button>
        )}
      </span>
    );

  return (
    <section className="panel listen">
      <h2>🎧 Listen{ab.test ? ' — chapter previews' : ''}</h2>
      <p className="sub">
        Every chapter&rsquo;s opening, read by the book&rsquo;s own voice — free. {ab.release === 'free'
          ? 'Full chapters are free too.'
          : ab.release === 'tribe'
            ? 'Full chapters are for tribe members.'
            : 'Full chapters unlock with a donation to the author.'}
        {ab.status !== 'ready' && ' Previews are still rendering — refresh in a minute for the rest.'}
      </p>

      {isOwner && (
        <div className="listen-owner">
          <h3>Author settings</h3>
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
                  onChange={() => authorPost('/settings', { release: r })}
                />
                {r === 'free' ? 'Everyone, free' : r === 'tribe' ? 'My Masky tribe' : 'Donation required'}
              </label>
            ))}
          </div>
          {ab.release === 'tribe' && (
            <input
              className="listen-tribeurl"
              placeholder="Your tribe join URL (masky.ai/…)"
              defaultValue={ab.tribeUrl ?? ''}
              onBlur={(e) => authorPost('/settings', { tribeUrl: e.target.value })}
            />
          )}
          <div className="alertactions">
            <a className="ghost" href={`${API}/api/books/${slug}/audiobook/download`} target="_blank" rel="noreferrer">
              ⬇ Download render manifest
            </a>
          </div>
        </div>
      )}

      <ol className="listen-chapters">
        {ab.chapters.map((ch) => (
          <li key={ch.id} className={open ? '' : ch.idx > 9 ? 'listen-hidden' : ''}>
            <div className="listen-row">
              <strong>{ch.title}</strong>
              {ch.previewStatus === 'ready' ? (
                playing === ch.idx ? (
                  <button className="ghost" onClick={stop}>⏸ Stop</button>
                ) : (
                  <button className="ghost" disabled={busy !== null} onClick={() => play(ch.idx, 'preview')}>
                    ▶ Preview
                  </button>
                )
              ) : (
                <span className="sub">{ch.previewStatus === 'error' ? 'preview failed' : 'rendering…'}</span>
              )}
              {!ab.test && ch.fullStatus === 'ready' && ab.access.ok && (
                <button className="ghost" disabled={busy !== null} onClick={() => play(ch.idx, 'full')}>
                  ▶ Full chapter
                </button>
              )}
            </div>
            <p className="listen-preview">{ch.preview}</p>
            {!ab.access.ok && gate(ab.access.why)}
          </li>
        ))}
      </ol>
      {ab.chapters.length > 10 && (
        <button className="ghost" onClick={() => setOpen(!open)}>
          {open ? 'Show fewer chapters' : `Show all ${ab.chapters.length} chapters`}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
