import { useEffect, useState } from 'react';
import {
  currentSession,
  handleCallback,
  isConfigured,
  login,
  logout,
  type MaskySession,
} from './lib/masky';
import './App.css';

export default function App() {
  const [session, setSession] = useState<MaskySession | null>(() => currentSession());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          LivingBook turns real authors&rsquo; books into living video agents. Ask a book a
          question and watch its narrator — or its characters — answer with the author&rsquo;s
          exact words, on video, ready to embed anywhere.
        </p>
        {!session && (
          <p className="sub">
            Authors: sign in with your Masky avatar to claim your books, upload podcasts and
            Q&amp;A transcripts, and let your readers meet your book face to face.
          </p>
        )}
        {session && (
          <p className="sub">
            Welcome, {session.name}. Your author dashboard is coming online — book uploads,
            knowledge base, and your marketing agent land here next.
          </p>
        )}
        {!isConfigured() && (
          <p className="notice">
            SSO not configured yet: set <code>VITE_MASKY_CLIENT_ID</code> in <code>web/.env.local</code>{' '}
            (run <code>scripts/register-oauth-client.sh</code>).
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </main>

      <footer className="foot">
        <span>Built on Masky · AWS · Actian — a Self-Evolving Agent Hackathon project</span>
      </footer>
    </div>
  );
}
