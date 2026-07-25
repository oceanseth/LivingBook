// About — the hackathon showcase video, the real author-answer render, and the stack.
export default function About() {
  return (
    <>
      <section className="panel">
        <h2>LivingBook in 90 seconds</h2>
        <p className="sub">
          Books that talk back: real authors&rsquo; books become living video agents that
          answer only in the author&rsquo;s exact words. Built at the Self-Evolving Agents
          Hackathon on seven sponsor tools — all live.
        </p>
        <video
          controls
          preload="metadata"
          poster="/media/showcase-poster.jpg"
          style={{ width: '100%', display: 'block', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
        >
          <source src="/media/livingbook-showcase.mp4" type="video/mp4" />
        </video>
      </section>

      <section className="panel">
        <h2>A book answering, for real</h2>
        <p className="sub">
          A reader asked <em>Out of Focus</em> about America&rsquo;s psychiatrist shortage.
          This is Aly Vredenburgh&rsquo;s book answering — rendered by Masky, verbatim from
          the text. No script, no actor, no invented words.
        </p>
        <video
          controls
          preload="metadata"
          style={{ maxHeight: 480, display: 'block', margin: '0 auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
        >
          <source src="/media/author-answer-demo.mp4" type="video/mp4" />
        </video>
      </section>

      <section className="panel">
        <h2>The stack</h2>
        <p className="sub">
          <strong>Actian VectorAI DB</strong> stores every verbatim passage with provenance ·{' '}
          <strong>Pioneer</strong> reasons over what&rsquo;s retrieved under a no-quote
          contract · <strong>Masky</strong> is every identity and every avatar render ·{' '}
          <strong>VoiceCert</strong> proves a live human spoke each recorded word ·{' '}
          <strong>Senso</strong> ingests it as verified ground truth ·{' '}
          <strong>Band&nbsp;AI</strong> stages agent-to-agent podcast rooms ·{' '}
          <strong>Guild.ai</strong> ships each new version of the marketing agent, with
          rollback. Source, session log, and the full build history:{' '}
          <a href="https://github.com/oceanseth/LivingBook" target="_blank" rel="noreferrer">
            github.com/oceanseth/LivingBook
          </a>{' '}
          (Open Session License).
        </p>
      </section>
    </>
  );
}
