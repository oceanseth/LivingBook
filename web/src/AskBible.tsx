import { useState } from 'react';
import type { MaskySession } from './lib/masky';

// Default to the app's own origin: the ask server is proxied under /api (see
// vite.config.ts). An absolute http:// default would be blocked as mixed
// content the moment the app is served over HTTPS. Override only when the API
// genuinely lives on another host.
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface Passage {
  ref: string;
  text: string;
  score: number;
}

interface AskResult {
  covered: boolean;
  spoken: string;
  passages: Passage[];
  turn?: { id: string; liveUrl?: string; shareUrl?: string };
  conversation?: { liveUrl: string };
}

export default function AskBible({ session }: { session: MaskySession | null }) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState<'ask' | 'render' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRender = Boolean(session && session.scope.includes('generate') && session.avatarId);

  async function run(mode: 'ask' | 'render') {
    if (!question.trim()) return;
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`${API}/api/${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(mode === 'render' && session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        },
        body: JSON.stringify(
          mode === 'render'
            ? { question, avatarId: session?.avatarId, output: 'video' }
            : { question },
        ),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="askbible">
      <h2>Ask the Bible</h2>
      <p className="sub">
        Every answer is a verbatim passage retrieved from the King James text — never invented.
      </p>
      <form
        className="askrow"
        onSubmit={(e) => {
          e.preventDefault();
          run('ask');
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does the Bible say about forgiveness?"
        />
        <button className="cta" disabled={busy !== null}>
          {busy === 'ask' ? 'Searching…' : 'Ask'}
        </button>
        {canRender && (
          <button type="button" className="ghost" disabled={busy !== null} onClick={() => run('render')}>
            {busy === 'render' ? 'Rendering…' : 'Ask on video'}
          </button>
        )}
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="answer">
          <p className="spoken">{result.spoken}</p>
          {result.conversation?.liveUrl && (
            <iframe
              className="player"
              src={result.conversation.liveUrl}
              title="Narrator"
              allow="autoplay"
            />
          )}
          {result.passages.length > 0 && (
            <ul className="passages">
              {result.passages.map((p) => (
                <li key={p.ref}>
                  <strong>{p.ref}</strong> — {p.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
