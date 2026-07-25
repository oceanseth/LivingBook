import { useEffect, useState } from 'react';
import { login, type MaskySession } from './lib/masky';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';

interface Alert {
  id: string;
  kind?: string;
  slug: string;
  bookTitle: string;
  signal: { title: string; url: string; source: string; phrase?: string };
  passage: { ref: string; text: string };
  score: number;
  suggestedReply: string;
  suggestedVia: string;
  status: string;
  finalReply?: string;
  turnLiveUrl?: string;
}

// Full-page management for one scout alert: the social-outreach opportunity in
// context — the signal, your matched words, the editable draft, exactly where
// it posts, and the choice of a spoken-video reply or text only.
export default function AlertPage({ id, session }: { id: string; session: MaskySession | null }) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    fetch(`${API}/api/alerts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setAlert(d.alert ?? null);
        if (d.alert && !reply) setReply(d.alert.suggestedReply);
      })
      .catch(() => {});
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function approve(mode: 'video' | 'text') {
    if (!session) return login();
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`${API}/api/alerts/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ reply, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!alert) {
    return (
      <div className="bookpage">
        <div className="bookpage-top">
          <a className="bookpage-home" href="/">📖 LivingBook</a>
        </div>
        <div className="bookpage-center">
          <p className="sub">Loading alert…</p>
        </div>
      </div>
    );
  }

  const postText = alert.finalReply ?? `${reply.trim()} — ask my book anything: https://livingbook.masky.ai/b/${alert.slug}`;
  const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(postText)}`;

  return (
    <div className="bookpage">
      <div className="bookpage-top">
        <a className="bookpage-home" href="/">📖 LivingBook</a>
        {!session && (
          <button className="cta" onClick={() => login()}>
            Login with Masky
          </button>
        )}
      </div>
      <div className="alertpage">
        <p className="notifkind">
          {alert.kind === 'mention' ? '🗣 Mention' : '🔭 Related signal'} · {alert.bookTitle} ·{' '}
          {Math.round(alert.score * 100)}% match · drafted via {alert.suggestedVia}
        </p>
        <h1 className="alerttitle">
          <a href={alert.signal.url} target="_blank" rel="noreferrer">
            {alert.signal.title}
          </a>
        </h1>
        <p className="sub">
          Source: {alert.signal.source} —{' '}
          <a href={alert.signal.url} target="_blank" rel="noreferrer">
            {alert.signal.url.slice(0, 80)}…
          </a>
        </p>

        {alert.passage.text && (
          <blockquote className="take">
            <p>“{alert.passage.text}”</p>
            <cite>— your words, {alert.passage.ref}</cite>
          </blockquote>
        )}

        <h3>Your reply</h3>
        {alert.status === 'pending' ? (
          <textarea rows={5} value={reply} onChange={(e) => setReply(e.target.value)} />
        ) : (
          <blockquote className="take">
            <p>{alert.finalReply}</p>
          </blockquote>
        )}

        <h3>Where this posts</h3>
        <ul className="postwhere">
          <li>
            <strong>X (Twitter)</strong> — opens a pre-filled post via x.com/intent; you press
            Post there. (Direct API posting arrives when you connect your X account.)
          </li>
          <li>
            <strong>In the reply</strong> — a link to your living book
            (livingbook.masky.ai/b/{alert.slug}) so readers can ask follow-ups
            {alert.status !== 'pending' && alert.turnLiveUrl
              ? ', plus the rendered video turn'
              : ''}
            .
          </li>
        </ul>

        {alert.status === 'pending' ? (
          <div className="alertactions">
            <button className="cta" disabled={busy !== null} onClick={() => approve('video')}>
              {busy === 'video' ? 'Rendering…' : '🎬 Approve + render avatar video'}
            </button>
            <button className="ghost" disabled={busy !== null} onClick={() => approve('text')}>
              {busy === 'text' ? 'Approving…' : '💬 Approve message only'}
            </button>
          </div>
        ) : (
          <div className="alertactions">
            <a className="cta" href={intentUrl} target="_blank" rel="noreferrer">
              🐦 Post on X
            </a>
            <button
              className="ghost"
              onClick={() => navigator.clipboard.writeText(postText)}
            >
              📋 Copy final reply
            </button>
            {alert.turnLiveUrl && (
              <a className="ghost" href={alert.turnLiveUrl} target="_blank" rel="noreferrer">
                ▶ Watch the rendered turn
              </a>
            )}
          </div>
        )}
        {alert.turnLiveUrl && alert.status !== 'pending' && (
          <iframe className="player" src={`${alert.turnLiveUrl}?autoplay=0`} title="Rendered turn" allowFullScreen />
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
