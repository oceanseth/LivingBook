import { useEffect, useState } from 'react';

// Masky embeds can take several seconds to hand back a first frame — and a
// render that is still generating stays blank for longer than that. A bare
// iframe is an empty box for the whole wait, which reads as broken. This keeps
// a skeleton + spinner in place until the frame actually loads, and offers an
// escape hatch once the wait stops looking normal.
const SLOW_AFTER_MS = 15000;

export default function VideoFrame({
  src,
  title,
  className = 'clip',
}: {
  src: string;
  title: string;
  className?: 'clip' | 'player';
}) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  // A new src is a new wait: drop back to the loading state so a swapped
  // player doesn't show the previous clip's "ready" frame.
  useEffect(() => {
    setLoaded(false);
    setSlow(false);
  }, [src]);

  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [loaded, src]);

  return (
    <div className={className}>
      <iframe
        className={loaded ? 'frame ready' : 'frame'}
        src={src}
        title={title}
        allow="autoplay"
        onLoad={() => setLoaded(true)}
      />
      <div className={loaded ? 'frameload gone' : 'frameload'} aria-hidden={loaded}>
        <span className="spinner" />
        {slow ? (
          <small>
            Still loading —{' '}
            <a href={src} target="_blank" rel="noreferrer">
              open directly
            </a>
          </small>
        ) : (
          <small>Loading video…</small>
        )}
      </div>
    </div>
  );
}
