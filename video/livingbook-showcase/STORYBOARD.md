---
format: 1920x1080
duration: 90s
message: "Books that talk back — seven sponsor tools, one living stack, working today"
arc: Hook → Demo (ask → answer) → Product intro → Mobile demo ×2 → Core claim → Stack diagram ×2 → CTA
audience: hackathon judges, sponsors, and developers browsing the repo
mode: collaborative
music: warm cinematic editorial, restrained pulse, literary
---

## Video direction

- **Palette (frame.md roles):** `paper` #14122D is the universal ground; one violet
  `sun` bloom per frame (radial: sun → sun-soft → haze) as the sole depth layer;
  ALL type in `ink` #F2EFFA; `ember` #DC2626 rationed to two moments (Frame 3's
  "None." underline, Frame 7's "never"). No cards, no shadows, no rounded corners —
  paper, ink, bloom, 1px hairline rules only. Bottom-right pagenum on every frame.
- **Type roles:** Iowan Old Style display ramp for headlines and pull-quotes
  (display-it italic for the hook question); JetBrains Mono `mono-data` /
  `micro-label` for sponsor labels, stats, URLs, and diagram callouts. Text is
  always ink; contrast via size/weight, never color (violet/ember only as marks).
- **Motion grammar:** long-tail `power3` settles everywhere — no bouncy, no
  overshoot except the sanctioned spring-pop callouts in Frames 8–9 (kept smooth).
  Every frame reveals on its VO cue with reveals spread through the back ~50%;
  at t=0 only what the VO is speaking exists. Aliveness during holds: subtle jitter
  at most; live SVG internals allowed only for the diagram pulse. Internal seams are
  velocity-matched cuts (cut-the-curve between Frames 5→6).
- **Rhythm / held frames:** Frame 3 is footage-led (design stays quiet around the
  clip); Frame 7 is the deliberate stillness beat; Frame 10's final card holds
  longest. Frames 8–9 carry the video's peak kinetic energy (the pans).
- **Negative list:** no slideshow front-load-then-freeze; no screensaver float; no
  lazy breathing; no back-half camera drift; no pure #000/#fff; no invented sponsor
  logos (sponsor names set as mono-type stations); no browser chrome or scrollbars;
  no purple-blue "AI gradient" clichés beyond the frame.md bloom.
- **Caption band:** all content planned into the top ~83%; captions skinned by
  `.hyperframes/caption-skin.html`.

## Frame 1 — What if a book could talk back?
- src: compositions/frames/01-hook.html

- type: hook
- blueprint: kinetic-type-beats (Reproduce — sub-shape B statement build)
- scene: Serif type lands beat by beat on a violet bloom; "frozen on a shelf" is struck through and "talk back" takes the frame
- duration: 4.267s
- transition_in: cut
- status: animated
- voiceover: "Every book you love is frozen on a shelf. What if it could talk back?"
- asset_candidates: none (pure type on frame.md system)
- focal: the hook line itself
- sfx: impact-bass-2

Cold open in outcome language. The strike-through of "frozen on a shelf" and the
swap to the italic question is the joke.

Scene 1 (0.0–1.8s): paper field; sun-bloom ignites low-left (ambient-glow-bloom, slow). "Every book you love" enters via per-word staggered reveal (kinetic-beat-slam) on power3, centered upper-third, headline role — Centered, ~55% width, 3 depth layers (bloom / type / pagenum).
Scene 2 (1.8–3.2s): "is frozen on a shelf." completes the line on its spoken cue; an ink hairline strike-through draws left→right across "frozen on a shelf" (css-marker-patterns) exactly as the VO finishes the phrase.
Scene 3 (3.2–5.0s): hard-cut beat swap (discrete-text-sequence): the statement clears; "What if it could talk back?" lands centered in display-it italic via smooth scale-settle (spring-pop-entrance, long-tail, no overshoot); a violet gradient sweep passes once through "talk back" (gradient-text-sweep) and settles solid; hold still to cut.

## Frame 2 — A reader asks
- src: compositions/frames/02-reader-asks.html

- type: feature_showcase
- blueprint: prompt-type-submit-generate (Adapt — sub-shape A, prompt-as-hook)
- scene: The real reader question types into an ask-a-book input beneath the book's title
- duration: 6.101s
- transition_in: cut
- status: animated
- voiceover: "A reader asks Aly Vredenburgh's book, Out of Focus, about America's mental-health shortage."
- asset_candidates: assets/media/aly-poster.png (avatar still), assets/media/site-hero.png (site ask UI reference)
- focal: the typed question in the ask input
- roles: turn1 poster = supporting (small avatar portrait beside the title) · scroll-000 = reference only (worker mimics the ask-input look, does not place the screenshot)
- sfx: none

Adapt: keep the type-and-submit signature; the "product surface" is a minimal
LivingBook book page (title + hairline ask input), not a captured window. Ends at
the submit — the answer is the next frame.

Scene 1 (0.0–1.6s): micro-label "LIVINGBOOK · /b/out-of-focus" reveals top-center; beneath it the book title "OUT OF FOCUS" (strand-title serif) + "Aly Vredenburgh" (body) reveal per-word as the VO names her; her small square avatar portrait (turn1 poster frame) fades in beside the title, hairline-ruled — asymmetric 60/40, upper-third title block, 3 depth layers (bloom low-right / title block / pagenum).
Scene 2 (1.6–5.2s): an ask-input rule (1px ink hairline box, mono placeholder) reveals mid-frame on the VO's "asks"; the question types character-by-character behind a blinking caret (discrete-text-sequence + context-sensitive-cursor): "What does OUT OF FOCUS say about the psychiatrist shortage?" — one slow eased push-in toward the input (multi-phase-camera) decelerating to near-hold.
Scene 3 (5.2–6.0s): the submit control (violet yellow-panel square, ink arrow glyph) fills solid on the cue and is pressed (press-release-spring); the frame dims 20% at the cut — sub-shape A cliffhanger.

## Frame 3 — The book answers, on video
- src: compositions/frames/03-book-answers.html

- type: feature_showcase
- blueprint: video-text-pivot (Adapt)
- scene: The real rendered Masky clip plays as hero; her exact words land as serif pull-quotes beside it
- duration: 12s
- transition_in: crossfade
- status: animated
- voiceover: (silent — the clip's own audio plays)
- asset_candidates: assets/media/masky-turn1.mp4 (master 17.9s; play 0–11.5s, cut on the "None." beat), assets/media/aly-poster.png (poster)
- clip_audio: keep (duck BGM to ~15%, no VO)
- focal: assets/media/masky-turn1.mp4
- roles: turn1 clip = hero (portrait video, hairline-framed) · everything else subordinate
- sfx: riser

Adapt: keep the weight-transfer signature — but the video never clears (it IS the
proof); it slides from center to the left column and the pull-quotes take the
vacated weight. No stat beat, no pill stamp.

Scene 1 (0.0–2.0s): the portrait clip (896x1024, hairline-ruled edge, no rounding) scales in centered (~46% height) on paper with the sun-bloom behind it; clip audio begins at once — Centered hero, 3 depth layers (bloom / clip / pagenum). Design stays quiet: nothing else enters.
Scene 2 (2.0–4.0s): weight-transfer (signature): the clip slides left + scales slightly down into a left 40% column (gsap-effects, power3) while micro-label "RENDERED BY MASKY — HER EXACT WORDS, ON VIDEO" reveals top-right on the vacated side.
Scene 3 (4.0–9.5s): serif pull-quotes reveal in the right column, each on the cue where she speaks it (discrete-text-sequence, timed to the clip transcript): "…over half of US counties" / "had no practicing psychiatrist." / "None." — ledger-title size, generous leading; earlier lines dim to 60% as the next lands.
Scene 4 (9.5–12.0s): clip reaches the cut point and holds its final frame; an ember hairline underline draws beneath "None." (css-marker-patterns — ember moment 1 of 2); the frame reads still.

## Frame 4 — Introducing LivingBook
- src: compositions/frames/04-introducing.html

- type: product_intro
- blueprint: kinetic-type-beats (Reproduce — Product_Intro name-drop)
- scene: "Introducing" beat-cuts resolve on the LivingBook wordmark + claim
- duration: 7.509s
- transition_in: cut
- status: animated
- voiceover: "This is LivingBook. Real books become living agents that answer only in the author's exact words — on video."
- asset_candidates: assets/media/brand-favicon.svg (brand mark), assets/media/site-hero.png (hero cameo)
- focal: the LivingBook wordmark
- roles: brand-favicon.svg = supporting (mark beside wordmark) · site-hero.png = background (faint, dim ~35%, lower-right, revealed late)
- sfx: impact-bass-2

Scene 1 (0.0–1.4s): hard cut to clean paper, bloom center-low; "This is" micro-label flashes centered (discrete-text-sequence) on the VO cue.
Scene 2 (1.4–3.2s): "LivingBook" lands dead-center in display serif via smooth scale-settle (spring-pop-entrance, long-tail); the favicon mark pops in to its left completing a lockup; bloom brightens once behind (ambient-glow-bloom, single pass).
Scene 3 (3.2–7.0s): the claim line reveals beneath in three phrase-groups on their spoken cues (dynamic-content-sequencing): "living agents" / "only in the author's exact words" / "— on video." — body-lede, ~60% width; on the final cue the site hero screenshot fades in faint lower-right (background role, dim) grounding the claim in the real product; settle and hold.

## Frame 5 — Authors give their book a voice
- src: compositions/frames/05-authors.html

- type: feature_showcase
- blueprint: device-surface-showcase (Reproduce — static-tour)
- scene: iPhone hero right-of-center; Books-tab screens advance through claim → upload → attach as the VO names each
- duration: 8.683s
- transition_in: wipe
- status: animated
- voiceover: "Authors sign in with Masky, claim their books, and upload everything around them — the text, podcasts, even live spoken sessions."
- asset_candidates: assets/media/sim-author-pairing.png (sign in with Masky pairing screen), assets/media/sim-books-shelf.png (claimed books shelf — Out of Focus 808 units, KJV 2,769 units)
- focal: the device screens (author flow)
- roles: sim-author-pairing.png = hero screen 1 · sim-books-shelf.png = hero screens 2 and 3 (screen 3 is a zoomed crop onto the Out of Focus shelf entry with its unit count) · violet panel underprint = background
- sfx: click-soft

Scene 1 (0.0–1.5s): a device mockup (hairline-stroked, square-cornered per frame.md phone treatment) slides in from the right edge and settles right-of-center — asymmetric 40/60 text|device; a violet yellow-panel band underprints behind it; screen 1 (sim-author-pairing.png — the Masky sign-in) visible; micro-label "FOR AUTHORS" reveals top-left.
Scene 2 (1.5–7.0s): screen advances on the VO cues (discrete-text-sequence inside the device; old screen pushes out, new pulls up — 3d-page-scroll register): "sign in with Masky" → hold on the pairing screen; "claim their books" → sim-books-shelf.png; "upload everything" → the device's view zooms to the Out of Focus shelf entry (coordinate-target-zoom inside the screen viewport) so "808 units" reads — the evidence of ingested text + sources. The left column swaps a short serif side-headline per screen (out-up / in-up), one at a time.
Scene 3 (7.0–9.0s): final screen (sources attached) holds; mono micro-label "VOICECERT-ATTESTED SPOKEN SESSIONS" reveals under the side-headline on its cue; still to the seam.

## Frame 6 — Readers ask anything
- src: compositions/frames/06-readers.html

- type: feature_showcase
- blueprint: device-surface-showcase (Reproduce — static-tour, mirrored)
- scene: iPhone hero left-of-center; Talk-tab screens advance question → exact passage → rendered answer
- duration: 8.192s
- transition_in: cut
- status: animated
- voiceover: "Readers ask anything. The exact passage comes back — retrieved, never invented — and rendered as the author on video."
- asset_candidates: assets/media/sim-talk-ask.mp4 (10.1s real screen recording — typing a question, submitting, verbatim answer appearing), assets/media/sim-talk-author-answer.png (Out of Focus §440 verbatim unit answer)
- focal: the live screen recording inside the device
- roles: sim-talk-ask.mp4 = hero screen (plays 0–6.8s inside the device viewport, framework-owned muted clip) · sim-talk-author-answer.png = final screen swap · violet panel underprint = background
- sfx: click-soft

Cut-the-curve seam from Frame 5: the device crosses to the mirrored position at
matched velocity, so 5→6 reads as one continuous product pass. The hero screen is
a REAL recording — the app being used, not stills.

Scene 1 (0.0–1.2s): mirrored composition lands — device left-of-center (60/40), micro-label "FOR READERS" top-right; the screen recording is already playing inside the device viewport (a question being typed live).
Scene 2 (1.2–6.8s): the recording runs — typing, submit, the verbatim answer appearing — while right-column serif side-headlines land on the VO cues: "asks anything" / "the exact passage comes back" / "never invented" (its own short line, mono). No camera motion; the living screen is the motion.
Scene 3 (6.8–9.0s): on "rendered as the author on video", the screen swaps (scale-swap seam) to sim-talk-author-answer.png — the Out of Focus §440 verbatim unit, tying back to the Frame 3 author; hold still.

## Frame 7 — The rule
- src: compositions/frames/07-the-rule.html

- type: benefit_highlight
- blueprint: kinetic-type-beats (Adapt — statement relay, slow)
- scene: Bare canvas; two statements land alone; a mono footnote grounds them
- duration: 6.805s
- transition_in: cut
- status: animated
- voiceover: "The rule, enforced in code: LLMs select and reason. They never generate an author's words."
- asset_candidates: none
- focal: the second statement
- sfx: none

Adapt: keep the beats-replace-in-place engine at the relay's slow tempo; both
statements share one canvas (the second replaces the first) — the video's
designated stillness beat.

Scene 1 (0.0–2.6s): near-bare paper (haze bloom at 30%, upper-right — dimmest frame of the video); "LLMs select and reason." lands centered, headline-sm, per-word stagger, quick then still.
Scene 2 (2.6–4.8s): hard cut swap: "They never generate an author's words." — same anchor, same size; "never" set in ember (ember moment 2 of 2, color not underline).
Scene 3 (4.8–6.0s): mono-data footnote reveals below on its cue: "byte-identical substring check · ungrounded quotes auto-rejected" — then everything holds dead still.

## Frame 8 — The stack: how an answer is made
- src: compositions/frames/08-stack-answer-path.html

- type: feature_showcase
- blueprint: spatial-pan-stations (Reproduce — Hook-timeline variant, re-aimed)
- scene: Oversized architecture canvas, act one — the camera pans the ask path: Question → Actian → Pioneer → Masky → video
- duration: 15.019s
- transition_in: wipe
- status: animated
- voiceover: "Under the hood: Actian VectorAI stores every verbatim passage with provenance. Pioneer reasons over what's retrieved — under a no-quote contract. And Masky renders the author's avatar speaking her own words."
- asset_candidates: none (diagram drawn in the frame system)
- focal: the sponsor stations, one per pan stop
- sfx: whoosh, pop

One oversized world canvas shared with Frame 9: stations are mono-labeled nodes
(1px hairline boxes, no fills) on hairline connectors; a violet pulse (live SVG
internal) travels the pipe. Sponsor names as type — no invented logos.

Scene 1 (0.0–2.0s): camera opens on station 1 — a small chip reading the Frame-2 question (mono, ink) with "READER" micro-label; on "Under the hood" a violet pulse leaves the chip along a hairline connector (svg-path-draw draws the line just ahead of the pulse); the pan begins following it — full-width strip composition, stations on the horizontal midline, bloom parallax behind.
Scene 2 (2.0–5.2s): pan centers the ACTIAN VECTORAI DB station on its cue; its callout spring-pops from the node edge (spring-pop-entrance, restrained): "ACTIAN VECTORAI — 2,769 verbatim units · provenance on every unit"; the pulse passes through and the node's hairline turns violet.
Scene 3 (5.2–8.4s): pan to PIONEER on its cue; callout: "PIONEER — grounded reasoning · no-quote contract · refs only"; a tiny ink "✕ quote-from-memory" tick appears struck-through beneath (the live rejection, one line).
Scene 4 (8.4–10.6s): pan to MASKY on its cue; callout: "MASKY — identity + avatar render"; the pulse exits the node into a last connector.
Scene 5 (10.6–12.0s): the connector terminates in a small video tile (a 9:10 hairline rectangle with a play glyph) that lights violet as the pulse arrives — the answer exists; camera settles, brief hold to the seam.

## Frame 9 — The stack: how it stays alive
- src: compositions/frames/09-stack-alive.html

- type: feature_showcase
- blueprint: spatial-pan-stations (Reproduce — Problem-web variant, re-aimed to a loop)
- scene: Same canvas, act two — VoiceCert → Senso feed the knowledge base; Band AI rooms; the Guild version ring closes the self-evolving loop; zoom out to all seven
- duration: 20.992s
- transition_in: cut
- status: animated
- voiceover: "VoiceCert proves a real human spoke every recorded word. Senso ingests it as verified ground truth. Band AI stages real agent-to-agent podcasts. And Guild ships each new version of the marketing agent — with rollback. Seven sponsor tools. All live. Built in one hackathon."
- asset_candidates: none (same diagram canvas, second region)
- focal: the closing full-map wide shot
- sfx: whoosh, impact-bass-1

Scene 1 (0.0–2.6s): the pan dives diagonally (Problem-web register: diagonal, steered by a hairline that draws ahead) to the VOICECERT station below the main pipe on its cue; callout: "VOICECERT — live human verification"; a small ✓ stroke draws in its node (svg-path-draw).
Scene 2 (2.6–5.2s): pan to SENSO on its cue; callout: "SENSO — verified ground truth · 15-doc KB"; a hairline loop-arrow draws from Senso back into the Actian/knowledge-base node — the first "it feeds itself" stroke.
Scene 3 (5.2–7.8s): pan to BAND AI on its cue; callout: "BAND AI — agent-to-agent podcast rooms"; two tiny avatar circles pulse alternately inside the node (live SVG internal — a conversation).
Scene 4 (7.8–10.2s): pan to GUILD.AI on its cue; callout: "GUILD.AI — versioned self-evolution"; a small ring draws with ticks "v1 → v2" and a counter-clockwise rollback arrow (svg-path-draw).
Scene 5 (10.2–13.0s): one decelerating zoom-out (viewport-change) reveals the whole seven-node map — the loop reads as a circuit; micro-label "SEVEN SPONSOR TOOLS — ALL LIVE" reveals top-center on "Seven sponsor tools", then "BUILT AT THE SELF-EVOLVING AGENTS HACKATHON · JUL 2026" in pagenum-size mono on "one hackathon"; hold the full map still.

## Frame 10 — Ask a book anything
- src: compositions/frames/10-cta.html

- type: cta
- blueprint: logo-assemble-lockup (Reproduce — CTA text-clear bloom)
- scene: Tagline clears itself; the mark blooms from zero; lockup + URLs hold
- duration: 7s
- transition_in: crossfade
- status: animated
- voiceover: "Ask a book anything — at livingbook dot masky dot A I."
- asset_candidates: assets/media/brand-favicon.svg, assets/media/site-hero.png (faint backdrop)
- focal: the final lockup + URL
- roles: brand-favicon.svg = hero mark · site-hero.png = background (dim ~30%, fades in only for the final hold)
- sfx: sparkle

Scene 1 (0.0–2.2s): on paper + center bloom, the serif tagline "Ask a book anything." finishes a left→right word-staggered fade-through-grey reveal on its VO cue and holds a beat.
Scene 2 (2.2–3.8s): the clear (signature): the tagline shrinks-toward-center and fades to a blank frame; then the favicon mark spring-blooms from zero at dead center (spring-pop-entrance — the one sanctioned smooth bloom), slight rotation settling flat.
Scene 3 (3.8–5.6s): the mark slides a short distance left as "LivingBook" reveals to its right with a visible partial-state wipe; the balanced lockup centers.
Scene 4 (5.6–8.0s): mono-data lines fade up beneath on the URL cue: "livingbook.masky.ai" then "github.com/oceanseth/LivingBook"; the site screenshot fades in very faint behind (background, 30%); the card holds dead still to the final frame — longest hold of the video.
