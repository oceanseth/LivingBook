---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "Books that talk back — seven sponsor tools, one living stack, working today"
destination: github-readme + site-about-section
aspect: 1920x1080
language: en
length: 90s
angle: showcase
audience: hackathon judges, sponsors, and developers browsing the repo
---

## Intent

A ~90s showcase of LivingBook (livingbook.masky.ai · github.com/oceanseth/LivingBook)
for the Self-Evolving Agents Hackathon (SF, Jul 24 2026). Show-it-as-is: feature the
product's real captured screens and real rendered footage, not invented marketing
imagery. Structure: hook with the rendered Masky demo clip (author AlyVredenburgh's
book answering a reader's question on video, in the author's exact words) → iOS app
simulator captures (author uploads a book; reader talks to it; verbatim rendered
sections appear for their questions) → the centerpiece: an animated architecture/stack
diagram walking through how each of the seven sponsor tools is used live → close on
the site + repo. The user's stated priority: "mainly we want to feature how we used
each sponsor, what the stack looks like in some kind of animated diagram."

## Assets

- (to fetch) Masky rendered author-answer clip from
  https://masky.ai/live/c-26-07-ppup?token=eb510ddde3125754dd78cec3ebf18793c2863e31105802dd
  — the hook footage; feature with its own audio during that segment.
- (to capture) iOS simulator screenshots/recordings from /Users/seth/LivingBook/app
  (Expo) — author book upload flow, talk-to-a-book flow, rendered relevant sections.
- /Users/seth/LivingBook/hackathon-progress-images/ — 13 progress screenshots,
  fallback b-roll only.

## Customizations

- Animated stack/sponsor diagram is the centerpiece: Actian VectorAI DB (verbatim KB,
  2,769 Bible units, hybrid retrieval + provenance), Pioneer (grounded reasoning,
  no-quote contract, auto-reject), Guild.ai (governed marketing-agent runtime,
  versioned self-evolution v1→v2), Band AI (agent-to-agent podcast rooms), Senso
  (ingestion/verified ground truth, 15-doc KB), VoiceCert (human verification gating
  spoken ground truth), Masky (identity + all avatar video rendering) on AWS.
- TTS voiceover + background music; the Masky demo clip's own audio plays during its
  segment (duck or pause VO/music there).
- Core claim to land verbatim: "LLMs select and reason — they never generate an
  author's words."

## Notes

- Sponsor facts sourced from SUBMISSION.md — use those exact claims, don't embellish.
- After render: embed the video + the Masky clip in the GitHub README and a new About
  section on livingbook.masky.ai, then deploy.
