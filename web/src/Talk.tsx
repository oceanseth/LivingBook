import { useState } from 'react';
import type { MaskySession } from './lib/masky';
import { useBooks } from './Books';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';

interface Msg {
  who: 'visitor' | 'agent';
  text: string;
  ref?: string | null;
}

// Talk to any book as yourself (your Masky avatar is your identity). The whole
// conversation lands in the book owner's inbox — text-only until THEY choose to
// render it as two-avatar video on their credits and share it.
export default function Talk({ session }: { session: MaskySession | null }) {
  const { books } = useBooks();
  const [slug, setSlug] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!session || !slug || !input.trim()) return;
    const question = input.trim();
    setMsgs((m) => [...m, { who: 'visitor', text: question }]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ slug, question }),
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

  if (!session) {
    return (
      <section className="panel">
        <h2>Talk to a book</h2>
        <p className="sub">Sign in with Masky first — your avatar is who the book sees.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Talk to a book</h2>
      <p className="sub">
        You&rsquo;re talking as <strong>{session.name}</strong>. The author sees this conversation
        in their inbox and can render it as a video of your avatars talking.
      </p>
      <div className="askrow">
        <select value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">— choose a book —</option>
          {books.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.title}
            </option>
          ))}
        </select>
      </div>
      <div className="chat">
        {msgs.map((m, i) => (
          <div key={i} className={m.who === 'visitor' ? 'msg mine' : 'msg theirs'}>
            <p>{m.text}</p>
            {m.ref && <cite>— {m.ref}</cite>}
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
          placeholder="Ask the book anything…"
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
