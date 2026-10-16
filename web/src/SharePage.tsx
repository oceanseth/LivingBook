import { useRef, useState } from 'react';
import { bookCover, useBooks } from './Books';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';

// Compact iframe embed at /b/{slug}/share: the book's cover, an invitation
// to ask, and a flashing Ask button. The cover opens the full book page
// in a new tab so the host site keeps the visitor while we get the click.
export default function SharePage({ slug }: { slug: string }) {
  const { books } = useBooks();
  const book = books.find((b) => b.slug === slug);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; ref?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cover = book ? bookCover(book) : null;
  const bookUrl = `${window.location.origin}/b/${slug}`;

  async function ask() {
    if (busy) return;
    if (!input.trim()) {
      inputRef.current?.focus();
      return;
    }
    const question = input.trim();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/books/${slug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAnswer({ text: data.spoken, ref: data.passages?.[0]?.ref });
      setInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sharepage">
      <a
        className="sharepage-cover"
        href={bookUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={book ? `Open ${book.title} on LivingBook` : 'Open this book'}
      >
        {cover ? (
          <img src={cover} alt={book?.title ?? slug} />
        ) : (
          <span className="sharepage-fallback" aria-hidden>
            📖
          </span>
        )}
      </a>
      {!book ? (
        <p className="sharepage-invite">Looking for this living book…</p>
      ) : (
        <>
          <h1>{book.title}</h1>
          <p className="sharepage-by">by {book.author}</p>
          <p className="sharepage-invite">Ask this book a question — it answers in the author&rsquo;s own words.</p>
        </>
      )}
      {answer && (
        <blockquote className="sharepage-answer">
          <p>{answer.text}</p>
          {answer.ref && <cite>— {answer.ref}</cite>}
        </blockquote>
      )}
      <form
        className="sharepage-ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={book ? `Ask ${book.title}…` : 'Ask the book…'}
          disabled={!book}
          aria-label="Question for the book"
        />
        <button className={busy ? 'cta' : 'cta askflash'} disabled={busy || !book}>
          {busy ? '…' : 'Ask'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
