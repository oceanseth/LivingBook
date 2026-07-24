import { useEffect, useState } from 'react';

// Masky embeds can take several seconds to hand back a first frame — and a
// render that is still generating stays blank for longer than that. A bare
// iframe is an empty box for the whole wait, which reads as broken, so a
// skeleton sits BEHIND the iframe and the embed covers it as soon as it paints.
// The iframe's own load event fires much later (after its player JS and video),
// so it is only used to stop the animation, never to reveal the video.
const SLOW_AFTER_MS = 10000;

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
      <iframe className="frame" src={src} title={title} allow="autoplay" onLoad={() => setLoaded(true)} />
      {/* Behind the iframe, so no link here — it would not be clickable. */}
      <div className={loaded ? 'frameload gone' : 'frameload'} aria-hidden={loaded}>
        <span className="spinner" />
        <small>{slow ? 'Still loading — the render may still be generating.' : 'Loading video…'}</small>
      </div>
    </div>
  );
}
