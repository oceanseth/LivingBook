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

interface Settings {
  authorName?: string;
  phoneNumber?: string;
}

// Account settings editor (author name + incoming phone number). The phone
// number is where call-center flows text unanswered reader questions; it is
// stored server-side and never exposed publicly.
function SettingsModal({ session, onClose }: { session: MaskySession; onClose: () => void }) {
  const [authorName, setAuthorName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/me/settings`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((r) => r.json())
      .then((d: { settings?: Settings }) => {
        setAuthorName(d.settings?.authorName ?? '');
        setPhoneNumber(d.settings?.phoneNumber ?? '');
        setState('ready');
      })
      .catch(() => setState('ready'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setState('saving');
    setError(null);
    try {
      const r = await fetch(`${API}/api/me/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName, phoneNumber }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Save failed');
      setAuthorName(d.settings?.authorName ?? '');
      setPhoneNumber(d.settings?.phoneNumber ?? '');
      setState('saved');
      setTimeout(onClose, 700);
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>⚙ Account settings</h3>
          <button className="ghost small" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="settingsform">
          <label>
            Author name
            <input
              value={authorName}
              maxLength={80}
              placeholder="Shown on your books"
              onChange={(e) => setAuthorName(e.target.value)}
              disabled={state === 'loading' || state === 'saving'}
            />
          </label>
          <label>
            Incoming phone number
            <input
              value={phoneNumber}
              maxLength={20}
              type="tel"
              placeholder="+1 805 555 1234"
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={state === 'loading' || state === 'saving'}
            />
          </label>
          <p className="sub">
            When a call-center caller asks something your book doesn’t cover, their question is texted
            to this number — reply by SMS and your digital twin reads it to them. Never shown publicly.
          </p>
          {error && <p className="sub settingserror">{error}</p>}
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="ghost deep" onClick={save} disabled={state === 'loading' || state === 'saving'}>
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Header bell: the user's avatar carries a pending-alert badge; clicking opens
// a dropdown with account settings on top, then scout notifications (mentions
// + related signals), with inline approve that renders the book's turn and
// produces the shareable reply.
export default function NotificationMenu({ session }: { session: MaskySession }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
          <button
            className="notifsettings"
            onClick={() => {
              setSettingsOpen(true);
              setOpen(false);
            }}
          >
            <span className="notifgear" aria-hidden>
              ⚙
            </span>
            Settings
          </button>
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
      {settingsOpen && <SettingsModal session={session} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
