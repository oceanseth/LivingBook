import { useEffect, useState } from 'react';
import type { MaskySession } from './lib/masky';
import VideoFrame from './VideoFrame';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

interface Convo {
  id: string;
  fromName: string;
  fromPicture?: string | null;
  bookTitle: string;
  turns: { who: string; text: string; ref?: string | null }[];
  renderedUrl: string | null;
}

// The author's inbox: conversations readers had with their books. Text-only
// until the author renders one as two-avatar video on their own Masky credits.
export default function Inbox({ session }: { session: MaskySession }) {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () =>
    fetch(`${API}/api/inbox`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((r) => r.json())
      .then((d) => setConvos(d.conversations ?? []))
      .catch(() => {});
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function renderConvo(id: string) {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch(`${API}/api/inbox/${encodeURIComponent(id)}/render`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMsg('Rendering started — the player fills in as each turn finishes.');
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (convos.length === 0) return null;
  return (
    <div className="inbox">
      <h3>Inbox — readers talking to your books</h3>
      {convos.map((c) => (
        <div className="convo" key={c.id}>
          <p className="convohead">
            {c.fromPicture && <img className="avatar" src={c.fromPicture} alt="" />}
            <strong>{c.fromName}</strong> × <em>{c.bookTitle}</em> · {Math.floor(c.turns.length / 2)}{' '}
            exchange(s)
          </p>
          <blockquote className="take">
            <p>{c.turns[c.turns.length - 2]?.text}</p>
            <p>{c.turns[c.turns.length - 1]?.text.slice(0, 160)}…</p>
          </blockquote>
          {c.renderedUrl ? (
            <VideoFrame src={c.renderedUrl} title={c.id} />
          ) : (
            <button className="ghost" disabled={busy === c.id} onClick={() => renderConvo(c.id)}>
              {busy === c.id ? 'Rendering…' : '🎬 Render as video (your credits)'}
            </button>
          )}
        </div>
      ))}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
