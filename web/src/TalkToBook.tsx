import { useEffect, useMemo, useState } from 'react';
import type { MaskySession } from './lib/masky';
import { useBooks } from './Books';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

interface Msg {
  who: 'visitor' | 'agent';
  text: string;
  ref?: string | null;
  renderUrl?: string | null;
}

// One place to talk to any public book or author. Signed-in users keep their
// history and can render the conversation as shareable video on THEIR credits.
export default function TalkToBook({ session }: { session: MaskySession | null }) {
  const { books } = useBooks();
  const [query, setQuery] = useState('');
  const [slug, setSlug] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [renderingIdx, setRenderingIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => books.map((b) => ({ label: `${b.title} — ${b.author}`, slug: b.slug })),
    [books],
  );

  // Resolve typed text to a book; support exact label match or unique prefix.
  useEffect(() => {
    const exact = options.find((o) => o.label === query);
    if (exact) return setSlug(exact.slug);
    const matches = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
    setSlug(query.length > 1 && matches.length === 1 ? matches[0].slug : '');
  }, [query, options]);

  // Load saved history when a book is picked (signed-in users only).
  useEffect(() => {
    setMsgs([]);
    if (!slug || !session) return;
    fetch(`${API}/api/talk/history?slug=${slug}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setMsgs(
          (d.turns ?? []).map((t: { who: string; text: string; ref?: string; renderUrl?: string }) => ({
            who: t.who === 'visitor' ? 'visitor' : 'agent',
            text: t.text,
            ref: t.ref,
            renderUrl: t.renderUrl ?? null,
          })),
        );
      })
      .catch(() => {});
  }, [slug, session]);

  async function send() {
    if (!slug || !input.trim() || busy) return;
    const question = input.trim();
    setMsgs((m) => [...m, { who: 'visitor', text: question }]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = session
        ? await fetch(`${API}/api/talk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.accessToken}`,
            },
            body: JSON.stringify({ slug, question }),
          })
        : await fetch(`${API}/api/books/${slug}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMsgs((m) => [...m, { who: 'agent', text: data.spoken, ref: data.passages?.[0]?.ref }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function renderTurn(index: number) {
    if (!session || !slug) return;
    setRenderingIdx(index);
    setError(null);
    try {
      const res = await fetch(`${API}/api/talk/render-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ slug, index }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMsgs((m) => m.map((msg, i) => (i === index ? { ...msg, renderUrl: data.liveUrl } : msg)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRenderingIdx(null);
    }
  }

  function copyTurn(index: number, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(index);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }

  const book = books.find((b) => b.slug === slug);

  return (
    <section className="panel">
      <h2>Talk to a book or author</h2>
      <div className="askrow">
        <input
          list="livingbooks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by book title or author…"
        />
        <datalist id="livingbooks">
          {options.map((o) => (
            <option key={o.slug} value={o.label} />
          ))}
        </datalist>
      </div>
      {book && (
        <p className="sub">
          {book.avatarImage && <img className="avatar" src={book.avatarImage} alt="" />} Talking to{' '}
          <strong>{book.title}</strong>
          {session
            ? ` as ${session.name} — your conversation is saved.`
            : ' — sign in with Masky to save your conversation and render video.'}
        </p>
      )}
      <div className="chat">
        {msgs.map((m, i) => (
          <div key={i} className={m.who === 'visitor' ? 'msg mine' : 'msg theirs'}>
            <p>{m.text}</p>
            {m.ref && <cite>— {m.ref}</cite>}
            {m.who === 'agent' && (
              <span className="turnactions">
                <button
                  type="button"
                  className="iconbtn"
                  title="Copy to clipboard"
                  onClick={() => copyTurn(i, m.text)}
                >
                  {copiedIdx === i ? '✓' : '📋'}
                </button>
                {session && !m.renderUrl && (
                  <button
                    type="button"
                    className="iconbtn"
                    title="Render this turn as video (your credits)"
                    disabled={renderingIdx === i}
                    onClick={() => renderTurn(i)}
                  >
                    {renderingIdx === i ? '⏳' : '🎬'}
                  </button>
                )}
                {m.renderUrl && (
                  <a className="sharelink" href={m.renderUrl} target="_blank" rel="noreferrer">
                    ▶ share link
                  </a>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
      <form
        className="askrow"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={slug ? 'Say something…' : 'Pick a book first'}
          disabled={!slug}
        />
        <button className="cta" disabled={busy || !slug || !input.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
