import { useEffect, useState } from 'react';
import type { MaskySession } from './lib/masky';
import AvatarModal, { type PickedAvatar } from './AvatarModal';
import RecordSpoken from './RecordSpoken';
import Inbox from './Inbox';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';

export interface Book {
  slug: string;
  title: string;
  author: string;
  units: number;
  visibility?: string;
  followed?: boolean;
  authorAvatarId?: string | null;
  avatarImage?: string | null;
  bookIcon?: string | null;
  ownerSub?: string | null;
}

// Cover used by the shelf and the /share embed. The Out of Focus JPEG ships
// in public/ so the share URL looks right even before the API field is saved.
export function bookCover(book: Book): string | null {
  if (book.bookIcon) return book.bookIcon;
  if (book.slug === 'out-of-focus') return '/book-icons/out-of-focus.jpg';
  return null;
}

interface MaskyAvatar {
  avatarId: string;
  avatarOwnerUserId: string;
  displayName: string;
  avatarImageUrl?: string;
  imageUrl?: string;
}

export function useBooks(token?: string) {
  const [books, setBooks] = useState<Book[]>([]);
  const reload = () =>
    fetch(`${API}/api/books`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((d) => setBooks(d.books ?? []))
      .catch(() => {});
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return { books, reload };
}

export default function Books({ session }: { session: MaskySession | null }) {
  const { books, reload } = useBooks(session?.accessToken);
  const [title, setTitle] = useState('');
  const [upload, setUpload] = useState({ slug: '', title: '', sourceType: 'book', text: '' });
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [avatars, setAvatars] = useState<MaskyAvatar[]>([]);
  const [avatarSlug, setAvatarSlug] = useState('');
  const [picked, setPicked] = useState<PickedAvatar | null>(null);
  const [shelf, setShelf] = useState<'mine' | 'public'>(session ? 'mine' : 'public');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editIcon, setEditIcon] = useState('');

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
      <nav className="tabs subtabs">
        <button className={shelf === 'mine' ? 'tab active' : 'tab'} onClick={() => setShelf('mine')}>
          Your books
        </button>
        <button className={shelf === 'public' ? 'tab active' : 'tab'} onClick={() => setShelf('public')}>
          Public books
        </button>
      </nav>
      {shelf === 'mine' && (
        <ul className="booklist">
          {books.filter((b) => session && b.ownerSub === session.sub).length === 0 && (
            <p className="sub">
              {session ? 'No books yet — add one below.' : 'Sign in with Masky to claim your books.'}
            </p>
          )}
          {books
            .filter((b) => session && b.ownerSub === session.sub)
            .map((b) => {
              const cover = bookCover(b);
              return (
              <li
                key={b.slug}
                className={editing === b.slug ? 'bookrow mine open' : 'bookrow mine'}
                onClick={() => {
                  setEditing(b.slug);
                  setEditTitle(b.title);
                  setEditAuthor(b.author);
                  setEditIcon(b.bookIcon ?? cover ?? '');
                  setUpload((u) => ({ ...u, slug: b.slug }));
                  setAvatarSlug(b.slug);
                }}
              >
                {cover ? (
                  <img className="bookcover" src={cover} alt="" />
                ) : (
                  b.avatarImage && <img className="avatar" src={b.avatarImage} alt="" />
                )}
                <span>
                  <strong>{b.title}</strong> — {b.author} · {b.units} verbatim units
                </span>
                <button
                  className="ghost small"
                  title="Copy this book's page link"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${window.location.origin}/b/${b.slug}`);
                    setMsg(`Link copied: /b/${b.slug}`);
                  }}
                >
                  🔗
                </button>
                <button
                  className="ghost small"
                  title="Copy share embed URL"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${window.location.origin}/b/${b.slug}/share`);
                    setMsg(`Share URL copied: /b/${b.slug}/share`);
                  }}
                >
                  ▤
                </button>
                <button
                  className="ghost small"
                  onClick={(e) => {
                    e.stopPropagation();
                    post(`/api/books/${b.slug}/visibility`, {
                      visibility: b.visibility === 'private' ? 'public' : 'private',
                    })
                      .then(() => reload())
                      .catch((err) => setMsg(err.message));
                  }}
                >
                  {b.visibility === 'private' ? '🔒 private' : '🌐 public'}
                </button>
              </li>
              );
            })}
        </ul>
      )}
      {shelf === 'public' && (
        <ul className="booklist">
          {books
            .filter((b) => b.visibility !== 'private' && (!session || b.ownerSub !== session.sub))
            .map((b) => {
              const cover = bookCover(b);
              return (
              <li key={b.slug} className="bookrow">
                <button
                  className="starbtn"
                  title={
                    session
                      ? b.followed
                        ? 'Unfollow'
                        : 'Follow this book'
                      : 'Sign in to follow books'
                  }
                  disabled={!session}
                  onClick={() =>
                    post(`/api/books/${b.slug}/follow`, {})
                      .then(() => reload())
                      .catch((err) => setMsg(err.message))
                  }
                >
                  {b.followed ? '★' : '☆'}
                </button>
                {cover ? (
                  <img className="bookcover" src={cover} alt="" />
                ) : (
                  b.avatarImage && <img className="avatar" src={b.avatarImage} alt="" />
                )}
                <span>
                  <strong>{b.title}</strong> — {b.author} · {b.units} verbatim units
                </span>
                <a className="ghost small" href={`/b/${b.slug}`}>
                  open
                </a>
              </li>
              );
            })}
        </ul>
      )}
      {session && shelf === 'mine' && editing && (
        <BookEditor
          book={books.find((b) => b.slug === editing)}
          title={editTitle}
          author={editAuthor}
          icon={editIcon}
          busy={busy}
          onTitle={setEditTitle}
          onAuthor={setEditAuthor}
          onIcon={setEditIcon}
          onClose={() => setEditing(null)}
          onSave={() =>
            post(`/api/books/${editing}`, {
              title: editTitle,
              author: editAuthor,
              bookIcon: editIcon.trim() || null,
            })
              .then(() => {
                setMsg('Book updated');
                reload();
              })
              .catch((err) => setMsg(err.message))
          }
        />
      )}
      {session && shelf === 'mine' && (
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
      {session && shelf === 'mine' && avatars.length > 0 && (
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
                  setPicked({
                    avatarId: av.avatarId,
                    avatarOwnerUserId: av.avatarOwnerUserId,
                    displayName: av.displayName,
                    imageUrl: av.avatarImageUrl ?? av.imageUrl ?? '',
                  })
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
      {picked && session && (
        <AvatarModal
          session={session}
          avatar={picked}
          bookTitle={books.find((bk) => bk.slug === avatarSlug)?.title ?? avatarSlug}
          saving={busy}
          onClose={() => setPicked(null)}
          onSave={(imageUrl) =>
            post(`/api/books/${avatarSlug}/avatar`, {
              avatarId: picked.avatarId,
              avatarOwnerUserId: picked.avatarOwnerUserId,
              avatarImage: imageUrl,
              avatarName: picked.displayName,
            })
              .then(() => {
                setMsg(`"${picked.displayName}" now represents that book`);
                setPicked(null);
                reload();
              })
              .catch((err) => setMsg(err.message))
          }
        />
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
      {session && shelf === 'mine' && <RecordSpoken session={session} books={books} />}
      {session && shelf === 'mine' && <Inbox session={session} />}
    </section>
  );
}

function BookEditor({
  book,
  title,
  author,
  icon,
  busy,
  onTitle,
  onAuthor,
  onIcon,
  onClose,
  onSave,
}: {
  book?: Book;
  title: string;
  author: string;
  icon: string;
  busy: boolean;
  onTitle: (v: string) => void;
  onAuthor: (v: string) => void;
  onIcon: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!book) return null;
  const shareUrl = `${window.location.origin}/b/${book.slug}/share`;
  const pageUrl = `${window.location.origin}/b/${book.slug}`;
  const embed = `<iframe src="${shareUrl}" width="360" height="640" style="border:0;border-radius:16px;max-width:100%" allow="clipboard-write" title="${book.title}"></iframe>`;

  return (
    <div className="bookeditor">
      <div className="bookeditor-head">
        <h3>Edit {book.title}</h3>
        <button type="button" className="ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="sub">
        Change the cover, title, or author. Upload more content in the form below.
        Readers who click the cover on the share embed land on this book&rsquo;s page.
      </p>
      <div className="bookeditor-grid">
        <label className="bookeditor-icon">
          {icon ? <img src={icon} alt="" /> : <span>📖</span>}
          <span>Book icon</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 900_000) {
                onIcon('');
                return;
              }
              const reader = new FileReader();
              reader.onload = () => onIcon(String(reader.result ?? ''));
              reader.readAsDataURL(f);
            }}
          />
        </label>
        <div className="uploadform">
          <input value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Title" />
          <input value={author} onChange={(e) => onAuthor(e.target.value)} placeholder="Author" />
          <input
            value={icon.startsWith('data:') ? '' : icon}
            onChange={(e) => onIcon(e.target.value)}
            placeholder="Or paste a cover image URL"
          />
          <button type="button" className="cta" disabled={busy || !title.trim()} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
      <div className="bookeditor-links">
        <p>
          Page: <a href={pageUrl}>{pageUrl}</a>
        </p>
        <p>
          Share embed: <a href={shareUrl}>{shareUrl}</a>
        </p>
        <textarea readOnly rows={3} value={embed} onFocus={(e) => e.currentTarget.select()} />
      </div>
    </div>
  );
}
