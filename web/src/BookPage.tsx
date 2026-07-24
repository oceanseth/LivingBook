import type { MaskySession } from './lib/masky';
import { useBooks } from './Books';
import TalkToBook from './TalkToBook';

// The standalone living book at /b/{slug}: the book itself, front and center,
// with its avatar and an ask interface. Authors link this (or embed it) from
// anywhere. Answers draw on every source the author attached to this book —
// the text itself, podcasts, interviews, Q&A, attested spoken sessions.
export default function BookPage({ slug, session }: { slug: string; session: MaskySession | null }) {
  const { books } = useBooks(session?.accessToken);
  const book = books.find((b) => b.slug === slug);

  return (
    <div className="bookpage">
      <a className="bookpage-home" href="/">
        📖 LivingBook
      </a>
      {!book ? (
        <div className="bookpage-center">
          <h1>…</h1>
          <p className="sub">Looking for this living book — it may be private or not exist.</p>
        </div>
      ) : (
        <div className="bookpage-center">
          {book.avatarImage && <img className="bookpage-avatar" src={book.avatarImage} alt={book.author} />}
          <h1>{book.title}</h1>
          <p className="bookpage-author">by {book.author}</p>
          <p className="sub">
            A living book. Ask it anything — it answers only with its author&rsquo;s exact words,
            drawn from the book and everything the author has attached to it.
          </p>
          <TalkToBook session={session} fixedSlug={slug} />
          <p className="bookpage-soon">
            Coming for authors: render the whole book and play it as an audio or video book.
          </p>
        </div>
      )}
    </div>
  );
}
