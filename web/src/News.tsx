import { useEffect, useState } from 'react';
import type { MaskySession } from './lib/masky';
import { useBooks } from './Books';

const API =
  ((window as unknown as { __API__?: string }).__API__ ??
    (import.meta.env.VITE_API_URL as string | undefined)) ??
  'http://localhost:8787';

interface Story {
  title: string;
  link: string;
}

interface Take {
  covered: boolean;
  spoken: string;
  passages: { ref: string; text: string; score?: number }[];
  reasoning?: string;
  references?: { title: string; link: string }[];
  model?: string;
}

export default function News({ session }: { session: MaskySession | null }) {
  const { books: allBooks } = useBooks(session?.accessToken);
  // Default to the reader's world: their own books + followed books. Fall back
  // to all public books when signed out or nothing followed yet.
  const mine = allBooks.filter((b) => (session && b.ownerSub === session.sub) || b.followed);
  const books = mine.length > 0 ? mine : allBooks;
  const [stories, setStories] = useState<Story[]>([]);
  const [takes, setTakes] = useState<Record<string, Record<string, Take>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/news`)
      .then((r) => r.json())
      .then((d) => setStories(d.stories ?? []))
      .catch(() => {});
  }, []);

  async function getTake(story: Story, slug: string, deep = false) {
    setBusy(story.title + slug + (deep ? 'deep' : ''));
    try {
      const r = deep
        ? await fetch(`${API}/api/news/reason`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, story: story.title }),
          })
        : await fetch(`${API}/api/books/${slug}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: `What does this book say about: ${story.title}` }),
          });
      const take = await r.json();
      setTakes((t) => ({ ...t, [story.title]: { ...(t[story.title] ?? {}), [slug + (deep ? '~deep' : '')]: take } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <h2>News</h2>
      <p className="sub">
        Today's stories — ask any book you follow what it has to say. Answers quote the book's
        exact words, never inventions.
      </p>
      {stories.map((s) => (
        <div className="story" key={s.title}>
          <p className="storytitle">
            <a href={s.link} target="_blank" rel="noreferrer">
              {s.title}
            </a>
          </p>
          <div className="takebtns">
            {books.map((b) => (
              <button
                key={b.slug}
                className="ghost deep"
                disabled={busy === s.title + b.slug + 'deep'}
                onClick={() => getTake(s, b.slug, true)}
              >
                {busy === s.title + b.slug + 'deep'
                  ? 'Reasoning…'
                  : `💭 ${b.title.split('(')[0].trim()}`}
              </button>
            ))}
          </div>
          {Object.entries(takes[s.title] ?? {}).map(([slug, take]) => (
            <blockquote className="take" key={slug}>
              {take.reasoning ? (
                <>
                  <p>{take.reasoning}</p>
                  {take.passages?.map((p) => (
                    <p className="verbatim" key={p.ref}>
                      <strong>{p.ref}:</strong> &ldquo;{p.text}&rdquo;
                    </p>
                  ))}
                  {take.references?.map((r) => (
                    <cite key={r.link}>
                      <a href={r.link} target="_blank" rel="noreferrer">
                        {r.title}
                      </a>
                    </cite>
                  ))}
                  {take.model && <cite>reasoned by Pioneer ({take.model})</cite>}
                </>
              ) : (
                <>
                  <p>{take.spoken}</p>
                  {take.passages?.[0] && <cite>— {take.passages[0].ref}</cite>}
                </>
              )}
            </blockquote>
          ))}
        </div>
      ))}
    </section>
  );
}
