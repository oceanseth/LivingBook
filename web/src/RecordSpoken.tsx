import { useEffect, useRef, useState } from 'react';
import type { MaskySession } from './lib/masky';
import type { Book } from './Books';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';
const VOICECERT_SITE_KEY = 'vcs_7b153be16b2f05fdb9427281';

interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    VoiceCert?: {
      captcha: (
        el: HTMLElement,
        opts: { siteKey: string; success: (token: string) => void; fail: (reason: string) => void },
      ) => void;
    };
  }
}

// Record truly-spoken words: VoiceCert proves a live human is speaking, the
// browser transcribes, the author approves the transcript, and it lands in the
// knowledge base as `spoken` ground truth their agent can quote forever.
export default function RecordSpoken({ session, books }: { session: MaskySession; books: Book[] }) {
  const [vcSession, setVcSession] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [slug, setSlug] = useState('');
  const widgetRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    if (vcSession || !widgetRef.current) return;
    const boot = () => {
      if (!window.VoiceCert || !widgetRef.current) return false;
      window.VoiceCert.captcha(widgetRef.current, {
        siteKey: VOICECERT_SITE_KEY,
        success: async (token) => {
          setStatus('Verifying with VoiceCert…');
          const res = await fetch(`${API}/api/voicecert/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.accessToken}`,
            },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (!res.ok) return setStatus(`VoiceCert failed: ${data.error}`);
          setVcSession(data.session.sessionId);
          setStatus('✓ VoiceCert-attested — you may record');
        },
        fail: (reason) => setStatus(`voicecert: ${reason}`),
      });
      return true;
    };
    if (!boot()) {
      const s = document.createElement('script');
      s.src = 'https://www.voicecert.com/widget/v1.js';
      s.async = true;
      s.onload = () => boot();
      document.head.appendChild(s);
    }
  }, [session, vcSession]);

  function toggleRecording() {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    const w = window as unknown as Record<string, (new () => SpeechRec) | undefined>;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return setStatus('SpeechRecognition unsupported in this browser — use Chrome.');
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = '';
      for (const r of Array.from(e.results)) text += r[0].transcript + ' ';
      setTranscript((t) => (t + ' ' + text).replace(/\s+/g, ' ').trim());
    };
    rec.onerror = (e: Event & { error?: string }) => setStatus(`mic: ${e.error ?? 'error'}`);
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setStatus('🔴 Recording — speak your words');
  }

  async function ingest() {
    const res = await fetch(`${API}/api/books/${slug}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({
        title: `Live spoken session — ${new Date().toLocaleDateString()}`,
        sourceType: 'spoken',
        text: transcript,
        voicecertSessionId: vcSession,
      }),
    });
    const data = await res.json();
    setStatus(res.ok ? `✓ Ingested ${data.unitsAdded} spoken unit(s) — your agent can now quote your actual words` : data.error);
    if (res.ok) setTranscript('');
  }

  return (
    <div className="recordbox">
      <h3>Record spoken truth</h3>
      <p className="sub">
        Prove you&rsquo;re a live human with VoiceCert, then speak. Your transcribed words become
        attested ground truth your agent quotes verbatim — readers know it&rsquo;s really you.
      </p>
      {!vcSession && <div ref={widgetRef} className="vcwidget" />}
      {vcSession && (
        <>
          <div className="askrow">
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              <option value="">— which book is this for? —</option>
              {books.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.title}
                </option>
              ))}
            </select>
            <button className={recording ? 'cta rec' : 'cta'} onClick={toggleRecording}>
              {recording ? '■ Stop' : '● Record'}
            </button>
          </div>
          <textarea
            rows={4}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your spoken words appear here — review before ingesting."
          />
          <button className="cta" disabled={!slug || transcript.length < 40} onClick={ingest}>
            Ingest as attested spoken words
          </button>
        </>
      )}
      {status && <p className="notice">{status}</p>}
    </div>
  );
}
