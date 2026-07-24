import { useEffect, useState } from 'react';
import { useBooks } from './Books';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

interface Story {
  title: string;
  link: string;
}

interface Take {
  covered: boolean;
  spoken: string;
  passages: { ref: string; text: string; score: number }[];
}

export default function News() {
  const { books } = useBooks();
  const [stories, setStories] = useState<Story[]>([]);
  const [takes, setTakes] = useState<Record<string, Record<string, Take>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/news`)
      .then((r) => r.json())
      .then((d) => setStories(d.stories ?? []))
      .catch(() => {});
  }, []);

  async function getTake(story: Story, slug: string) {
    setBusy(story.title + slug);
    try {
      const r = await fetch(`${API}/api/books/${slug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `What does this book say about: ${story.title}` }),
      });
      const take = await r.json();
      setTakes((t) => ({ ...t, [story.title]: { ...(t[story.title] ?? {}), [slug]: take } }));
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
                className="ghost"
                disabled={busy === s.title + b.slug}
                onClick={() => getTake(s, b.slug)}
              >
                {busy === s.title + b.slug ? 'Asking…' : `Ask ${b.title.split('(')[0].trim()}`}
              </button>
            ))}
          </div>
          {Object.entries(takes[s.title] ?? {}).map(([slug, take]) => (
            <blockquote className="take" key={slug}>
              <p>{take.spoken}</p>
              {take.passages?.[0] && <cite>— {take.passages[0].ref}</cite>}
            </blockquote>
          ))}
        </div>
      ))}
    </section>
  );
}
