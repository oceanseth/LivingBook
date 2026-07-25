import { useEffect, useRef, useState } from 'react';
import type { MaskySession } from './lib/masky';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';

interface Alert {
  id: string;
  kind?: string;
  bookTitle: string;
  signal: { title: string; url: string; source: string };
  suggestedReply: string;
  status: string;
  finalReply?: string;
  turnLiveUrl?: string;
}

// Header bell: the user's avatar carries a pending-alert badge; clicking opens
// a dropdown of scout notifications (mentions + related signals), with inline
// approve that renders the book's turn and produces the shareable reply.
export default function NotificationMenu({ session }: { session: MaskySession }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const reload = () =>
    fetch(`${API}/api/alerts`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => {});

  useEffect(() => {
    reload();
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pending = alerts.filter((a) => a.status === 'pending').length;

  async function dismiss(id: string) {
    setBusy(id);
    try {
      await fetch(`${API}/api/alerts/${id}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      reload();
    } finally {
      setBusy(null);
    }
  }


  return (
    <div className="notifwrap" ref={ref}>
      <button className="notifbtn" onClick={() => setOpen(!open)} title="Notifications">
        {session.picture ? (
          <img className="avatar" src={session.picture} alt={session.name} />
        ) : (
          <span className="avatar placeholder">👤</span>
        )}
        {pending > 0 && <span className="notifbadge">{pending}</span>}
      </button>
      {open && (
        <div className="notifmenu">
          <p className="notifhead">
            Your books are watching — {pending > 0 ? `${pending} waiting` : 'all clear'}
          </p>
          {alerts.length === 0 && <p className="sub">No signals yet. The scout runs hourly.</p>}
          {alerts.slice(0, 8).map((a) => (
            <div key={a.id} className="notifitem">
              <div className="notifrow">
                <p className="notifkind">
                  {a.kind === 'mention' ? '🗣 Mention' : '🔭 Related'} · {a.bookTitle}
                </p>
                <button
                  className="notifdismiss"
                  title="Dismiss"
                  disabled={busy === a.id}
                  onClick={() => dismiss(a.id)}
                >
                  ✕
                </button>
              </div>
              <a href={a.signal.url} target="_blank" rel="noreferrer" className="notiftitle">
                {a.signal.title}
              </a>
              {a.status === 'pending' ? (
                <>
                  <a className="notifreply" href={`/alerts/${a.id}`} title="Open full outreach page">
                    “{a.suggestedReply.slice(0, 140)}…”
                  </a>
                  <a className="ghost small" href={`/alerts/${a.id}`}>
                    ✎ Review &amp; approve
                  </a>
                </>
              ) : (
                a.turnLiveUrl && (
                  <a href={a.turnLiveUrl} target="_blank" rel="noreferrer" className="sharelink">
                    ▶ rendered turn
                  </a>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
