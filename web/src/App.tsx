import { useEffect, useRef, useState } from 'react';
import {
  currentSession,
  handleCallback,
  isConfigured,
  login,
  logout,
  type MaskySession,
} from './lib/masky';
import NotificationMenu from './NotificationMenu';
import TalkToBook from './TalkToBook';
import Books from './Books';
import News from './News';
import BookPage from './BookPage';
import About from './About';
import './App.css';

type Tab = 'talk' | 'news' | 'books' | 'about';

const TABS: { id: Tab; label: string }[] = [
  { id: 'talk', label: 'Talk to a book or author' },
  { id: 'news', label: 'News' },
  { id: 'books', label: 'Books' },
  { id: 'about', label: 'About' },
];

export default function App() {
  const [session, setSession] = useState<MaskySession | null>(() => currentSession());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('talk');
  const [stuck, setStuck] = useState(false);
  // Intro: the hero starts fullscreen, then flies into the top-left logo slot.
  // Clicking the hero holds it fullscreen until clicked again; clicking the
  // landed logo expands it back to fullscreen.
  const logoRef = useRef<HTMLImageElement>(null);
  const heldRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const [heroRect, setHeroRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [heroFull, setHeroFull] = useState(true);
  const [overlayOn, setOverlayOn] = useState(() => window.location.pathname === '/');

  const clearHeroTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };
  const measureLogo = () => {
    const r = logoRef.current?.getBoundingClientRect();
    return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
  };

  useEffect(() => {
    if (!overlayOn) return;
    const start = window.setTimeout(() => {
      const r = measureLogo();
      if (!r) return setOverlayOn(false);
      setHeroRect(r);
      timersRef.current.push(
        window.setTimeout(() => {
          if (!heldRef.current) setHeroFull(false);
        }, 200),
        window.setTimeout(() => {
          if (!heldRef.current) setOverlayOn(false);
        }, 4900),
      );
    }, 500);
    timersRef.current.push(start);
    return clearHeroTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onHeroClick = () => {
    if (heroFull && !heldRef.current) {
      // hold fullscreen until the next click
      clearHeroTimers();
      heldRef.current = true;
      setHeroFull(true);
    } else if (heroFull && heldRef.current) {
      // release: fly to the header, then hand off to the real logo
      heldRef.current = false;
      const r = measureLogo();
      if (r) setHeroRect(r);
      setHeroFull(false);
      timersRef.current.push(window.setTimeout(() => setOverlayOn(false), 4100));
    } else {
      // mid-flight or landed: expand back and hold
      clearHeroTimers();
      heldRef.current = true;
      setHeroFull(true);
    }
  };

  const onLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const r = measureLogo();
    if (!r) return;
    clearHeroTimers();
    setHeroRect(r);
    setHeroFull(false);
    setOverlayOn(true);
    heldRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => setHeroFull(true)));
  };

  const introDone = !overlayOn;

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

  const bookMatch = window.location.pathname.match(/^\/b\/([a-z0-9-]+)\/?$/);
  if (bookMatch) return <BookPage slug={bookMatch[1]} session={session} />;

  return (
    <div className="page">
      {overlayOn && (
        <div
          className={heroFull || !heroRect ? 'intro-overlay full' : 'intro-overlay'}
          onClick={onHeroClick}
          style={
            heroFull || !heroRect
              ? { top: 0, left: 0, width: '100vw', height: '100vh', borderRadius: 0 }
              : { ...heroRect, borderRadius: 10 }
          }
        >
          <img src="/hero.jpg" alt="LivingBook — real authors, real news, real connection" />
        </div>
      )}
      <header className={stuck ? 'nav stuck' : 'nav'}>
        <div className="wrap nav-inner">
          <a href="/" className="logolink" onClick={onLogoClick} title="Expand">
            <img
              ref={logoRef}
              className="logo-img"
              src="/hero.jpg"
              alt="LivingBook"
              style={{ opacity: introDone ? 1 : 0 }}
            />
          </a>
          {session ? (
            <div className="account">
              <NotificationMenu session={session} />
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
        {tab === 'news' && <News session={session} />}
        {tab === 'books' && <Books session={session} />}
        {tab === 'about' && <About />}

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
