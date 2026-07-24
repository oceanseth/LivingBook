import { useEffect, useState } from 'react';
import {
  currentSession,
  handleCallback,
  isConfigured,
  login,
  logout,
  type MaskySession,
} from './lib/masky';
import AskBible from './AskBible';
import Books from './Books';
import News from './News';
import Talk from './Talk';
import './App.css';

type Tab = 'ask' | 'news' | 'talk' | 'books';

export default function App() {
  const [session, setSession] = useState<MaskySession | null>(() => currentSession());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');

  useEffect(() => {
    handleCallback()
      .then((s) => s && setSession(s))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="page">
      <header className="nav">
        <span className="logo">📖 LivingBook</span>
        {session ? (
          <div className="account">
            {session.picture && <img className="avatar" src={session.picture} alt={session.name} />}
            <span>{session.name}</span>
            <button
              className="ghost"
              onClick={() => {
                logout();
                setSession(null);
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            className="cta"
            disabled={busy || !isConfigured()}
            onClick={() => {
              setBusy(true);
              login().catch((e) => {
                setBusy(false);
                setError(e instanceof Error ? e.message : String(e));
              });
            }}
          >
            Login with Masky
          </button>
        )}
      </header>

      <main className="hero">
        <h1>Books that talk back.</h1>
        <p className="tagline">
          Real authors&rsquo; books, alive as talking video agents. Ask a book a question and it
          answers with the author&rsquo;s exact words — on video, ready to share.
        </p>
        {error && <p className="error">{error}</p>}

        <nav className="tabs">
          {(['ask', 'news', 'talk', 'books'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
              {t === 'ask' ? 'Ask the Bible' : t === 'news' ? 'News' : t === 'talk' ? 'Talk' : 'Books'}
            </button>
          ))}
        </nav>

        {tab === 'ask' && <AskBible session={session} />}
        {tab === 'news' && <News />}
        {tab === 'talk' && <Talk session={session} />}
        {tab === 'books' && <Books session={session} />}

        <section className="panel showcase">
          <h2>Fresh from the living books</h2>
          <p className="sub">
            Real renders from today: the Bible answering a trending courtroom question, the
            self-evolving marketing agent&rsquo;s take on the Red Sea chokepoint, and a generated
            podcast — the LivingBook Host interviewing the Bible itself.
          </p>
          <div className="clips">
            <iframe className="clip" src="https://masky.ai/live/t-26-07-wdej" title="Bible on today's lawsuit" allowFullScreen />
            <iframe className="clip" src="https://masky.ai/live/t-26-07-angu" title="Marketing agent: Red Sea chokepoint" allowFullScreen />
            <iframe
              className="clip"
              src="https://masky.ai/live/c-26-07-icn4?token=2f6ea719864ecdab7cae0af20dc0dc99353aebb900b1194c"
              title="Generated podcast episode"
              allowFullScreen
            />
          </div>
        </section>
      </main>

      <footer className="foot">
        <span>
          Built on Masky · Actian VectorAI · Senso · Guild.ai · Band · AWS — a Self-Evolving
          Agents Hackathon project
        </span>
      </footer>
    </div>
  );
}
