import { useEffect, useState } from 'react';
import {
  currentSession,
  handleCallback,
  isConfigured,
  login,
  logout,
  type MaskySession,
} from './lib/masky';
import TalkToBook from './TalkToBook';
import Books from './Books';
import News from './News';
import './App.css';

type Tab = 'talk' | 'news' | 'books';

const TABS: { id: Tab; label: string }[] = [
  { id: 'talk', label: 'Talk to a book or author' },
  { id: 'news', label: 'News' },
  { id: 'books', label: 'Books' },
];

export default function App() {
  const [session, setSession] = useState<MaskySession | null>(() => currentSession());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('talk');
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    handleCallback()
      .then((s) => s && setSession(s))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // The header is transparent over the hero glow and only grows its blurred
  // backdrop once content scrolls under it.
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="page">
      <header className={stuck ? 'nav stuck' : 'nav'}>
        <div className="wrap nav-inner">
          <span className="logo">📖 LivingBook</span>
          {session ? (
            <div className="account">
              {session.picture && (
                <img className="avatar" src={session.picture} alt={session.name} />
              )}
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
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>Books that talk back.</h1>
          <p className="tagline">
            Real authors&rsquo; books, alive as talking video agents. Ask a book a question and it
            answers with the author&rsquo;s exact words — on video, ready to share.
          </p>
          {error && <p className="error">{error}</p>}
        </section>

        <div className="tabsrow">
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'tab active' : 'tab'}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'talk' && <TalkToBook session={session} />}
        {tab === 'news' && <News />}
        {tab === 'books' && <Books session={session} />}

        <section className="panel showcase">
          <h2>Fresh from the living books</h2>
          <p className="sub">
            Real renders from today: the Bible answering a trending courtroom question, the
            self-evolving marketing agent&rsquo;s take on the Red Sea chokepoint, and a generated
            podcast — the LivingBook Host interviewing the Bible itself.
          </p>
          <div className="clips">
            <iframe className="clip" src="https://masky.ai/live/t-26-07-wdej?autoplay=0" title="Bible on today's lawsuit" allowFullScreen />
            <iframe className="clip" src="https://masky.ai/live/t-26-07-angu?autoplay=0" title="Marketing agent: Red Sea chokepoint" allowFullScreen />
            <iframe
              className="clip"
              src="https://masky.ai/live/c-26-07-3b36?token=4c16e00ee98cb2cdb0e9a5374bd8d7947e04d8e3ba9b6abf&autoplay=0"
              title="Generated podcast episode"
              allowFullScreen
            />
          </div>
        </section>
      </main>

      <footer className="foot wrap">
        <span>
          Built on Masky · Actian VectorAI · Senso · Guild.ai · Band · AWS — a Self-Evolving
          Agents Hackathon project
        </span>
      </footer>
    </div>
  );
}
