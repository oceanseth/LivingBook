import { useEffect, useState } from 'react';
import type { MaskySession } from './lib/masky';
import RecordSpoken from './RecordSpoken';
import Inbox from './Inbox';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

export interface Book {
  slug: string;
  title: string;
  author: string;
  units: number;
  authorAvatarId?: string | null;
  avatarImage?: string | null;
  ownerSub?: string | null;
}

interface MaskyAvatar {
  avatarId: string;
  avatarOwnerUserId: string;
  displayName: string;
  avatarImageUrl?: string;
  imageUrl?: string;
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const reload = () =>
    fetch(`${API}/api/books`)
      .then((r) => r.json())
      .then((d) => setBooks(d.books ?? []))
      .catch(() => {});
  useEffect(() => {
    reload();
  }, []);
  return { books, reload };
}

export default function Books({ session }: { session: MaskySession | null }) {
  const { books, reload } = useBooks();
  const [title, setTitle] = useState('');
  const [upload, setUpload] = useState({ slug: '', title: '', sourceType: 'podcast', text: '' });
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [avatars, setAvatars] = useState<MaskyAvatar[]>([]);
  const [avatarSlug, setAvatarSlug] = useState('');

  useEffect(() => {
    if (!session) return;
    fetch('https://masky.ai/api/avatars', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setAvatars(d.avatars ?? []))
      .catch(() => {});
  }, [session]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      return data;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Books</h2>
      <ul className="booklist">
        {books.map((b) => (
          <li key={b.slug} className="bookrow">
            {b.avatarImage && <img className="avatar" src={b.avatarImage} alt="" />}
            <span>
              <strong>{b.title}</strong> — {b.author} · {b.units} verbatim units
            </span>
          </li>
        ))}
      </ul>
      {!session && <p className="sub">Sign in with Masky to claim your books and upload content.</p>}
      {session && (
        <>
          <h3>Add a book</h3>
          <form
            className="askrow"
            onSubmit={(e) => {
              e.preventDefault();
              post('/api/books', { title })
                .then((d) => {
                  setMsg(`Created "${d.book.title}"`);
                  setTitle('');
                  reload();
                })
                .catch((err) => setMsg(err.message));
            }}
          >
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" />
            <button className="cta" disabled={busy || !title.trim()}>
              Create
            </button>
          </form>

          <h3>Upload content</h3>
          <div className="uploadform">
            <div className="askrow">
              <select value={upload.slug} onChange={(e) => setUpload({ ...upload, slug: e.target.value })}>
                <option value="">— pick your book —</option>
                {books.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.title}
                  </option>
                ))}
              </select>
              <select
                value={upload.sourceType}
                onChange={(e) => setUpload({ ...upload, sourceType: e.target.value })}
              >
                <option value="book">book text</option>
                <option value="podcast">podcast transcript</option>
                <option value="qa">fan Q&amp;A transcript</option>
              </select>
            </div>
            <input
              value={upload.title}
              onChange={(e) => setUpload({ ...upload, title: e.target.value })}
              placeholder="Source title (e.g. 'Ep 42 — The Focused Life podcast')"
            />
            <textarea
              rows={6}
              value={upload.text}
              onChange={(e) => setUpload({ ...upload, text: e.target.value })}
              placeholder="Paste the exact text/transcript — or upload a PDF below. Your book will only ever quote it word-for-word."
            />
            <label className="pdfrow">
              📄 Or upload a PDF:{' '}
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return setPdf(null);
                  const reader = new FileReader();
                  reader.onload = () =>
                    setPdf({ name: f.name, base64: String(reader.result).split(',')[1] ?? '' });
                  reader.readAsDataURL(f);
                }}
              />
              {pdf && <span className="notice">{pdf.name} ready</span>}
            </label>
            <button
              className="cta"
              disabled={busy || !upload.slug || (upload.text.length < 40 && !pdf)}
              onClick={() =>
                post(`/api/books/${upload.slug}/content`, {
                  ...upload,
                  title: upload.title || pdf?.name || 'untitled',
                  ...(pdf ? { pdfBase64: pdf.base64 } : {}),
                })
                  .then((d) => {
                    setMsg(`Ingested ${d.unitsAdded} unit(s) — ${d.totalUnits} total`);
                    setUpload({ ...upload, text: '', title: '' });
                    setPdf(null);
                    reload();
                  })
                  .catch((err) => setMsg(err.message))
              }
            >
              Ingest
            </button>
          </div>
        </>
      )}
      {session && avatars.length > 0 && (
        <>
          <h3>Book avatar</h3>
          <p className="sub">Pick which of your Masky avatars represents a book — it becomes the face and voice readers see.</p>
          <div className="askrow">
            <select value={avatarSlug} onChange={(e) => setAvatarSlug(e.target.value)}>
              <option value="">— pick your book —</option>
              {books
                .filter((b) => !b.ownerSub || b.ownerSub === session.sub)
                .map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.title}
                  </option>
                ))}
            </select>
          </div>
          <div className="avatargrid">
            {avatars.map((av) => (
              <button
                key={av.avatarId}
                className="avatarcard"
                disabled={busy || !avatarSlug}
                onClick={() =>
                  post(`/api/books/${avatarSlug}/avatar`, {
                    avatarId: av.avatarId,
                    avatarOwnerUserId: av.avatarOwnerUserId,
                    avatarImage: av.avatarImageUrl ?? av.imageUrl ?? null,
                    avatarName: av.displayName,
                  })
                    .then(() => {
                      setMsg(`"${av.displayName}" now represents that book`);
                      reload();
                    })
                    .catch((err) => setMsg(err.message))
                }
              >
                {(av.avatarImageUrl ?? av.imageUrl) && (
                  <img src={av.avatarImageUrl ?? av.imageUrl} alt={av.displayName} />
                )}
                <span>{av.displayName}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {msg && <p className="notice">{msg}</p>}
      {session && (
        <button
          className="ghost"
          onClick={() =>
            post('/api/pair/start', {})
              .then((d) => setMsg(`📱 Mobile pairing code: ${d.code} (valid 10 min)`))
              .catch((err) => setMsg(err.message))
          }
        >
          📱 Connect mobile app
        </button>
      )}
      {session && <RecordSpoken session={session} books={books} />}
      {session && <Inbox session={session} />}
    </section>
  );
}
