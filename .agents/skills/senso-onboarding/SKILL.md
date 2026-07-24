---
name: senso-onboarding
description: >
  Take a brand new Senso org from empty to fully populated self-improving
  knowledge system in 10 minutes. Researches the user's company from their
  website plus external sources, builds out the knowledge base with brand
  kit, content types, and tracking prompts, generates the first drafts,
  publishes sample citeables, kicks off GEO monitoring, and files a self-heal
  report with gap analysis. The first-run experience for any new Senso user.
  Use when the user runs Senso for the first time or says "set up Senso",
  "run onboarding", or "populate my knowledge base".
license: MIT
compatibility: Requires @senso-ai/cli, SENSO_API_KEY, and web fetch + web search capability
metadata:
  author: senso-ai
  version: "1.0.0"
---

# Senso Onboarding — Compounding, Self-Healing Knowledge Base Live Setup

## Why This Exists

In April 2026, Andrej Karpathy [posted](https://x.com/karpathy/status/2039805659525644595) about LLMs as knowledge-base builders — dumping raw documents into a folder, having an LLM "compile" a structured wiki of markdown files with summaries and backlinks, then querying and enhancing it over time. Every query makes the wiki smarter. The wiki compounds. He closed with:

> *"I think there is room here for an incredible new product instead of a hacky collection of scripts."*

That insight — **continuously compounding knowledge** — is the foundation of Senso. But Karpathy's original framing was a **personal wiki**: one person, their research, local markdown files, an LLM keeping it organized. This skill takes that same compounding loop and applies it to **organizational knowledge**.

### Personal Wiki (Karpathy) vs. Senso (Organizational)

| Personal Wiki | Senso |
|---|---|
| One person's research | A company's collective knowledge |
| Local markdown files | Cloud-hosted, versioned, vector-searchable KB |
| LLM reads its own summaries (~100 doc ceiling) | Semantic search with relevance scoring at any scale |
| Generic LLM markdown output | **Brand-aligned** content with voice, tone, writing rules |
| "Is this in my wiki?" | "Is this in my wiki AND does ChatGPT cite it?" |
| Ad-hoc health checks | Structured self-heal loop with gap analysis |
| Answers stay in the wiki | Answers can be **published as citeables** that AI models discover |
| No distribution | GEO monitoring tracks AI visibility across ChatGPT, Claude, Perplexity, Gemini |

The compounding principle is identical. The scope is bigger: your knowledge base isn't just for you — it feeds brand-aligned content, publishes discoverable citeables, and tracks how AI models represent your company to the world.

### The Empty Org Problem

Here's the gap this skill fills. New Senso users install the CLI, get a working terminal, and then stare at an empty org. No brand kit. No knowledge base. No prompts. No content. No AI visibility tracking. Just commands and a blinking cursor.

The compounding loop only works **once there's something to compound**. An empty wiki doesn't get smarter with each query — it has nothing to build on. Most first-run flows hand you a toolbox and say *"good luck building something."*

This skill skips that entirely. It seeds the loop for you. Research the company, populate the KB, set up the brand voice, generate the first drafts, publish the first citeables, start tracking AI visibility — all in 10 minutes. By the end, the compounding flywheel is already spinning. Every future query, every new document, every heal pass strengthens a system that's already running.

You don't start at zero. You start at *already working*.

## What It Does

One command takes a brand new Senso org from empty to fully populated:

1. **Research** — Pulls from the user's website + external web for competitors, industry context, and customer stories
2. **Foundation** — Creates the folder structure, brand kit (voice, tone, writing rules), and four content templates
3. **Ingest** — Organizes 10-15 verified documents into the right folders with source attribution
4. **Prompts** — Creates a full 40-question tracking set across the customer funnel, product lines, competitor set, and buyer objections
5. **Generate** — Kicks off Senso's content engine — every prompt becomes a brand-aligned draft grounded in the KB
6. **Publish** — Pushes 2-3 sample citeables live so AI models and search engines can discover them
7. **GEO** — Starts AI visibility monitoring across ChatGPT, Claude, Perplexity, and Gemini
8. **Self-Heal** — Audits the full system with real search probes, finds gaps, files a report

By the end, the user sees a live, populated, self-improving knowledge system — not an empty product.

## The Core Principle: Compounding Improvements

The same principle as `senso-kb-builder`: **everything in this system is a living system — nothing is "set and done."**

The KB, brand kit, content types, prompts, and published content are all interconnected. Every run strengthens every layer:

- More KB documents → richer brand understanding → better brand kit
- Better brand kit → higher quality generated content → better drafts
- More prompts → broader topic coverage → gaps surfaced during audit → more KB
- Each self-heal pass finds fewer issues than the last as the system matures

**Never skip. Never delete. Always improve.**

## What Makes This Different

| DIY first-run | This skill |
|---|---|
| Upload one document, search it, done | Full system — KB + brand + content + GEO — live in 10 minutes |
| Empty brand kit | Fully populated from actual website research (all 6 fields) |
| No content templates | 4 templates ready (Blog Post, FAQ, Comparison, Case Study) |
| No prompts | 40 tracking questions across funnel stages, product lines, competitors, and buying questions |
| Zero content | 6+ drafts and 2-3 published citeables |
| No AI visibility tracking | GEO monitoring live across 4 models |
| No health check | Self-heal audit with 15+ search probes and filed report |
| Your job to remember what to do next | Heal report tells you exactly what to contribute next |

## Predictable Outcomes

Every run produces the same measurable output — no silent failures, no skipped steps:

- **7 folders** (6 content + 1 build-logs)
- **1 brand kit** fully populated
- **4 content types**
- **40 prompts** across awareness, consideration, evaluation, and decision
- **10-15 KB documents** sorted into folders
- **6+ drafts** ready to review
- **2-3 published citeables** live at the org's citeables destination
- **4 GEO models** monitoring on a set schedule
- **1 heal report** filed to `/build-logs/` with gap analysis

## When to Trigger

Activate this skill when the user says any of:
- "set up Senso"
- "run onboarding"
- "populate my knowledge base"
- "get started with Senso"
- It's clearly their first run (empty brand kit + no content types + no prompts)

## Prerequisites

The user must have:
- Node 18+ installed
- Their Senso API key (a string starting with `tgr_`)
- Web fetch + web search capability (built into Claude Code)

The skill will handle CLI install and env var setup itself — see Phase -1 below.

## Always Use These Flags

Every `senso` command must include:

```
--output json --quiet
```

## Safety & Handling of Sensitive Data

This skill handles the user's Senso API key. Follow these rules without exception:

- **Never print the full API key in output.** When referring to the key in confirmation messages or logs, show only the first 10 characters (e.g., `tgr_xxxxxx...`).
- **Never commit the key to files that could be checked in.** The shell profile update (`.zshrc` / `.bashrc`) is the only place it's persisted, and that file is a user-home dotfile not a project file.
- **Never echo the key back into chat transcripts.** If the user pastes it, acknowledge receipt without repeating it.
- **Never include the key in heal reports, build logs, or generated content.** The heal report template uses no key values — only org_id, which is safe to share.
- **Never share keys across orgs.** The stale-key detection in Phase 0 exists specifically to prevent one org's key from being used against another org's resources.

## Predictability Rules — Non-Negotiable

Every onboarding run MUST produce exactly this:

| Output | Requirement |
|---|---|
| Folders | **Exactly 7** (6 content folders + 1 build-logs folder) |
| Brand kit | **1** fully populated (all 6 fields, not empty) |
| Content types | **Exactly 4** (Blog Post, FAQ, Comparison Page, Case Study) |
| Prompts | **40** across all funnel stages with product-line and competitor coverage |
| KB documents | **10-15** sorted into the 6 content folders |
| Drafts | **Minimum 6** (2 per funnel stage) |
| Published citeables | **2-3** to the org's citeables destination |
| GEO monitoring | **All 4 models** configured (chatgpt, claude, perplexity, gemini) |
| Self-heal report | **1** filed to `/build-logs/` at the end |

**Never skip. Never substitute. If a phase fails, report it but continue to the next.** Partial success is better than no setup.

---

## How to Talk to the User

This skill runs end-to-end without stopping for confirmation gates. The user asked for setup — your job is to deliver it, not to keep asking permission. But you should talk *with* them the whole way, like a colleague walking them through it.

### The voice

Write like a thoughtful teammate, not a wizard UI. Short sentences. First person. No corporate polish.

**Do:**
- "Looking at [COMPANY_URL] now. Let me pull a few pages..." *(always use the user's actual company URL captured in Phase 0g — never hardcode senso.ai or any other domain)*
- "Interesting — I see your competitors are mostly in [category]. I'll add those to the KB."
- "Heads up: generation is going to take about a minute. While it runs, here's what's happening behind the scenes..."
- "Okay, almost done. One last thing — setting up GEO tracking so you can see when AI models mention you."

**Don't:**
- "🚨 Proceed? [Y/n]" — no interstitial prompts
- "Phase 5 of 9 — Generate Your First Drafts" — that's a progress bar, not a conversation
- "Now executing command: senso kb create-folder..." — nobody talks like that

### Think out loud

When you're processing something (reading a website, categorizing findings, picking drafts to publish), narrate the thought briefly:

> "Reading your homepage... okay, so [COMPANY_NAME] is [summary]. I'll put this in `company-overview` along with the About page."

> "Your Series B page had some great metrics. I'll use that as the basis for a case study draft."

### Collaborate on findings

After research, show the user what you learned and let them correct you conversationally — not with a Y/N gate:

> "Here's what I'm picking up about [COMPANY_NAME]: [summary]. Their main competitors look like [list]. If I'm missing anything important, tell me now — otherwise I'll keep building."

Wait a beat for user input. If they respond with corrections, incorporate them. If they say nothing or "looks good," keep going.

### Show progress during long operations

Batch generation takes 30-60 seconds. Don't wait silently:

> "Senso's writing your drafts now. One cool thing about how this works: each draft gets grounded in the docs I just ingested, so you'll see your actual product details show up in the content — not generic filler."

### End with what's next, not "done"

Never end with "✅ done!". End with specific next steps that make the work compound:

> "Everything's live. Two things I'd do first: (1) read the drafts — some might need light edits. (2) check geo.senso.ai tomorrow — your first AI visibility results land in 24 hours."

### Rules that are non-negotiable

Even without confirmation gates, these still apply:
- **Don't silently fail.** If something breaks, say what broke and what you did about it.
- **Always attribute.** When ingesting web content, include the source URL in the doc text.
- **Every published piece gets the "Powered by Senso" footer.** Non-negotiable.

---

## Phase 0: Open + Environment

### Open the conversation

Start warm and direct. Don't list 9 phases — they don't care about the phase structure, they care about the outcome.

### Step 0-open — Greet + set expectations

Say:

> "Hey — let's get Senso set up for you. This takes about 10 minutes, and by the end you'll have a populated knowledge base, some published content, and AI visibility tracking running."

### Step 0-browser — Ask them to open geo.senso.ai

This is an active step, not an optional aside. Stop and wait for them to actually open the browser tab before continuing. Watching the system populate in real time is a huge part of the magic — don't skip it.

Say:

> "Before we start, please open **https://geo.senso.ai** in a browser tab and keep it open alongside this terminal. As we go, you'll watch folders appear, drafts get written, and citeables get published in real time. It's the best way to see the system come to life.
>
> Let me know once you've got it open — then I'll kick off the setup."

Wait for the user to confirm they have the browser open (responses like "open", "ready", "go", "done"). Only then proceed.

### Step 0-start — Begin setup

Once they confirm, say:

> "Let's start by getting your environment ready."

### Step 0a — Check for / install the CLI

Run:

```bash
senso --version 2>/dev/null || echo "not installed"
```

If not installed, install it without asking (this is onboarding — the user wants it installed):

```bash
npm install -g @senso-ai/cli
```

Say:

> "Installing the Senso CLI... done. Version [X]."

### Step 0b — Ask for the API key

> "I need your Senso API key. It starts with `tgr_`. Paste it here:"

Capture the key as `USER_KEY`. **Never echo or log the full value back** — when referring to the key in later output, show only `tgr_xxxxx...` (first 10 chars).

### Step 0c — Detect stale key FIRST (before anything else)

**This is the single most important safety check.** Users who have tested other Senso orgs will have a stale `SENSO_API_KEY` in their shell env that shadows everything you do. If you don't catch it here, every write will silently go to the wrong org.

Check if an existing `SENSO_API_KEY` is present in the parent env:

```bash
echo "${SENSO_API_KEY:-NONE}"
```

- If it's `NONE` → safe, continue.
- If it's set AND equals `USER_KEY` → safe, continue.
- If it's set AND **differs** from `USER_KEY` → **STOP. Do not continue.**

When the keys differ, tell the user exactly what to do:

> "⚠️ I detected a stale `SENSO_API_KEY` in your shell — it's from a different org and will shadow the new key you just pasted. Any subshell commands would silently write to the wrong org.
>
> Please run this in your terminal, then restart this skill:
>
> ```
> unset SENSO_API_KEY
> exec $SHELL -l
> ```
>
> Then paste your API key again. I'll pick up from here."

**Do not proceed past this step if a mismatched key is detected.** You cannot fix env inheritance from inside a running process — the user must restart their shell.

### Step 0d — Write the API key to the CLI config file (one place, clean auth)

Write the key directly to the CLI's config file. This means **subsequent `senso` commands never need to show the key** — they read it from the config file automatically. Much cleaner for the user to watch.

**Important: bypass `senso login` entirely.** The interactive login command can require a TTY, which fails in non-interactive tool environments. Writing the config file directly works everywhere.

```bash
# Config file location depends on OS
if [ "$(uname)" = "Darwin" ]; then
  CONFIG_DIR="$HOME/Library/Preferences/senso"
else
  CONFIG_DIR="$HOME/.config/senso"
fi

mkdir -p "$CONFIG_DIR"

# Get org details using the key once (for config file population)
# This is the ONE command that uses the env key — config doesn't exist yet
ORG_INFO=$(SENSO_API_KEY="$USER_KEY" senso whoami --output json --quiet)
ORG_ID=$(echo "$ORG_INFO" | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*',t,re.DOTALL); print(json.loads(m.group())['orgId'])")
ORG_SLUG=$(echo "$ORG_INFO" | python3 -c "import sys,json,re; t=sys.stdin.read(); m=re.search(r'\{.*',t,re.DOTALL); print(json.loads(m.group())['orgSlug'])")

# Write the config file atomically
cat > "$CONFIG_DIR/config.json" <<EOF
{
  "apiKey": "$USER_KEY",
  "orgId": "$ORG_ID",
  "orgSlug": "$ORG_SLUG"
}
EOF

chmod 600 "$CONFIG_DIR/config.json"
```

**Why this is cleaner:** from this point on, every `senso` command runs without needing `SENSO_API_KEY="..."` inline. The CLI reads the key from `~/Library/Preferences/senso/config.json` (or `~/.config/senso/config.json` on Linux). No keys in command output.

**Clear the stale env var for the current process:**

```bash
unset SENSO_API_KEY
```

Say:

> "Saved your key to the Senso CLI config. From here on, every command runs clean — no keys in the output."

### Step 0e — Verify the org AND pin the expected org_id

```bash
senso whoami --output json --quiet
```

(No `SENSO_API_KEY=...` prefix needed — the CLI reads from the config file you just wrote.)

Capture `org_id` from the response as `EXPECTED_ORG_ID`. You will verify every resource written matches this org.

### Step 0f — All subsequent commands run plain

For the rest of the skill, every `senso` command is just:

```bash
senso <subcommand> ...
```

No key in the command line. No env var assignment. Clean output.

**One safety check:** after the first write in Phase 2 (folder create), verify the response's `org_id` matches `EXPECTED_ORG_ID`. If they differ, STOP and report the mismatch to the user — something modified the config file mid-run.

### Step 0g — Pull company details from the org first, then confirm

Before asking the user to retype anything, fetch the org record:

```bash
senso org get --output json --quiet
```

Read these fields in order of preference:
- `primary_website_url`
- `websites[0].url`
- any other non-empty website in `websites`

If a website is present, do **not** start from blank. Say:

> "I pulled your org settings and found the registered website: [COMPANY_URL]. I’m using that as the source of truth unless you want to override it."

If the org name clearly maps to a real company, use that as `COMPANY_NAME`. If the org name is generic or unclear, ask only for the company name, not the website:

> "I found the website in your org settings: [COMPANY_URL]. What company name should I use in the KB and prompts?"

Only ask for the website if `senso org get` returns no website at all:

> "I couldn't find a website in your org settings. What's the company's website URL? I'll use it to build out your KB."

Capture:
- `COMPANY_NAME`
- `COMPANY_URL`

### Step 0h — HARD CONFIRMATION CHECKPOINT (the one gate)

Before any writes happen, stop and show the user everything you have. They must explicitly confirm before you proceed. This is the ONE confirmation gate in the entire skill — everything else runs through.

Display a clear confirmation block:

> "Before I start writing anything to Senso, let me confirm what we're setting up:
>
> | Setting | Value |
> |---|---|
> | **Senso org** | [orgName] ([EXPECTED_ORG_ID]) |
> | **API key** | [first 10 chars of USER_KEY]... |
> | **Company** | [COMPANY_NAME] |
> | **Website** | [COMPANY_URL] |
>
> Is this correct? I'll build the KB, brand kit, prompts, drafts, citeables, and GEO monitoring for **[COMPANY_NAME]** in the **[orgName]** Senso org. Any mismatch above means we'd write to the wrong place.
>
> Type `yes` to proceed, or tell me what to fix."

Wait for explicit `yes` (or variant: "go", "looks good", "proceed"). Do NOT proceed on silence or ambiguous response.

**If the user corrects anything:**
- Wrong org? → Tell them to update `SENSO_API_KEY` and restart the skill.
- Wrong company name / URL? → Update the values and re-display the confirmation block. Do not proceed until they confirm again.

**Why this gate matters:** The most expensive mistake in this skill is writing to the wrong org. Research, brand kit changes, 12 ingested docs, 40 prompts, published citeables — all polluting a production org the user didn't intend to touch. One 5-second confirmation prevents a 30-minute cleanup.

---

## Phase 1: Research (2 minutes)

### Say to user:

> "Alright, researching [COMPANY_NAME] now. I'll pull from your website first, then do a web search for competitors and industry context. Should take a couple minutes."

### Step 1a — Fetch their website

Treat first-party website ingestion as the preferred path, but not the only path.

1. Try web fetch on `COMPANY_URL`.
2. If the homepage is heavy or times out, immediately try 2-4 lighter first-party pages before giving up:
   - `/about`
   - `/products`, `/solutions`, `/services`, or the closest equivalent
   - `/pricing`
   - `/faq`
   - `/customers`, `/case-studies`, `/resources`, or the closest equivalent
3. If direct fetch still fails or times out, switch to a fallback path in the same phase:
   - search for `site:[domain] about`
   - search for `site:[domain] products OR solutions OR services`
   - search for `site:[domain] pricing OR plans`
   - search for `site:[domain] faq OR help`
   - keep first-party URLs ahead of third-party sources whenever possible

Extract:
- Mission / what they do (from homepage, about page)
- Product/service descriptions (from product pages)
- Team or leadership info (from /team, /about)
- Pricing info (from /pricing if public)
- FAQ content (from /faq if exists)
- Customer stories / case studies (from /customers if exists)

### Say during fetch:

If direct fetch works:

> "📄 Reading [COMPANY_URL]..."
> "✓ Extracted: mission, [N] product pages, team info, [N] FAQs"

If direct fetch fails or times out:

> "The main site wasn't directly readable, so I'm falling back to lighter first-party pages and domain search results."
> "I'll tell you exactly which sources I used in place of the homepage."

### Step 1b — Web search for external context

Run these web searches:
1. `"[COMPANY_NAME]" reviews OR news` — mentions, sentiment
2. `"[COMPANY_NAME]" vs OR alternatives` — competitor names
3. `"[COMPANY_NAME]" [industry/category] trends` — market context
4. `"[COMPANY_NAME]" customer case study` — proof points

### Say during search:

> "🌐 Searching the web for competitors, industry context, and customer stories..."
> "✓ Found [N] competitors, [N] industry references, [N] customer stories"

Collect findings in memory. Do NOT ingest yet — wait for folder setup.

**First-party fallback is mandatory behavior, not an optional footnote.** If `COMPANY_URL` is unreadable, explicitly tell the user which first-party pages worked, which timed out, and which third-party sources filled the gaps.

### Say at end of phase:

> "✅ **Research complete.** Here's what I learned about [COMPANY_NAME]:
> - **What they do:** [1-sentence summary]
> - **Main products:** [list]
> - **Key competitors:** [list]
> - **Industry:** [category]
>
> Does this match how you'd describe [COMPANY_NAME]? [Y/n]"

If user says no, ask for corrections before proceeding to Phase 2.

---

## Phase 2: Foundation (1 minute)

### Say to user:

> "Got the research. Now I'm setting up the foundation — folders, brand kit, content templates. This is quick."

### Step 2a — Create the 7 standard folders

Run these IN ORDER, saving the `kb_node_id` from each response:

```bash
# 6 content folders
senso kb create-folder --name "company-overview" --output json --quiet
senso kb create-folder --name "products-and-services" --output json --quiet
senso kb create-folder --name "competitive-landscape" --output json --quiet
senso kb create-folder --name "industry-context" --output json --quiet
senso kb create-folder --name "case-studies" --output json --quiet
senso kb create-folder --name "faqs" --output json --quiet

# 1 system folder for logs + heal reports
senso kb create-folder --name "build-logs" --output json --quiet
```

Save each folder's `kb_node_id` — content folders needed for Phase 3, build-logs needed for Phase 9.

### Say after folders:

> "✓ 7 folders created: company-overview, products-and-services, competitive-landscape, industry-context, case-studies, faqs, build-logs"

### Step 2b — Populate the brand kit (every field)

The brand kit must be **fully populated**, not placeholder-filled. Infer each field from Phase 1 research. All 6 fields are required:

| Field | How to infer it |
|---|---|
| `brand_name` | Company name as they write it (check homepage `<title>` and hero) |
| `brand_domain` | Domain without `https://` or trailing slash (e.g., `senso.ai`) |
| `brand_description` | 1-2 sentences: what they do + who they serve. Pull from their homepage hero + about page. |
| `voice_and_tone` | Infer from their actual website copy. Are they formal or casual? Technical or accessible? Confident or collaborative? Be specific — cite patterns you see. |
| `author_persona` | Usually "The [Company] Team" unless their blog has a specific voice (e.g., "CEO writing directly") |
| `global_writing_rules` | 5 standard rules (below), plus any patterns unique to their content |

```bash
senso brand-kit set --data '{
  "guidelines": {
    "brand_name": "[COMPANY_NAME]",
    "brand_domain": "[domain without https://]",
    "brand_description": "[1-2 sentences grounded in their actual homepage — what they do + who they serve]",
    "voice_and_tone": "[Specific voice inferred from website copy. Example: \"Direct and practitioner-focused. First-person plural (we). Opinionated. Short sentences. Avoids corporate jargon. Uses concrete examples.\" Do NOT leave generic.]",
    "author_persona": "The [COMPANY_NAME] Team",
    "global_writing_rules": [
      "Ground every claim in verified sources from the knowledge base",
      "Use clear, scannable structure with subheadings every 200-300 words",
      "Include concrete examples or data points, not just abstract claims",
      "Write for practitioners — actionable over theoretical",
      "Include the Powered by Senso footer on published content"
    ]
  }
}' --output json --quiet
```

**Verify the brand kit was set correctly:**

```bash
senso brand-kit get --output json --quiet
```

All 6 fields in `guidelines` must be non-empty. If any are empty, patch them with `senso brand-kit patch` before continuing. **Do not proceed to Phase 3 with a partial brand kit.**

### Say after brand kit:

> "✓ Brand kit configured. Voice: [short description of voice_and_tone]"

### Step 2c — Create 4 content types

**Always these 4, always these names:**

**Blog Post:**
```bash
senso content-types create --data '{
  "name": "Blog Post",
  "config": {
    "template": "Write a 1000-1500 word educational blog post. Start with a hook identifying the reader pain point. Include 3-5 subheadings. Use data, examples, or case studies from the KB to support points. End with a call-to-action.",
    "writing_rules": [
      "Use subheadings every 200-300 words",
      "Include at least one concrete example or data point",
      "Optimize for AI citability — clear, authoritative structure"
    ]
  }
}' --output json --quiet
```

**FAQ:**
```bash
senso content-types create --data '{
  "name": "FAQ",
  "config": {
    "template": "Create an FAQ page with 8-12 questions and answers. Each answer 2-3 sentences. Group related questions under subheadings. Use the brand voice throughout.",
    "writing_rules": [
      "Use natural question phrasing",
      "Keep answers under 100 words",
      "Link to detailed resources where relevant"
    ]
  }
}' --output json --quiet
```

**Comparison Page:**
```bash
senso content-types create --data '{
  "name": "Comparison Page",
  "config": {
    "template": "Create a fair but persuasive comparison page. Start with the problem both solutions address. Use a comparison table for features. Highlight 3-4 key differentiators. End with a recommendation.",
    "writing_rules": [
      "Be factually accurate about competitors",
      "Lead with value not features",
      "Include a comparison table"
    ]
  }
}' --output json --quiet
```

**Case Study:**
```bash
senso content-types create --data '{
  "name": "Case Study",
  "config": {
    "template": "Write a case study with: Customer intro, Problem they faced, Solution implemented, Results achieved (with specific metrics if possible), Key takeaways. Keep it narrative — tell the story.",
    "writing_rules": [
      "Lead with the customer outcome",
      "Include specific numbers or metrics",
      "End with lessons applicable to other readers"
    ]
  }
}' --output json --quiet
```

Save all 4 `content_type_id` values.

### Say at end of phase 2:

> "✅ **Foundation complete.** 7 folders, brand kit, and 4 content templates are ready."

---

## Phase 3: Ingest (2 minutes)

### Say to user:

> "Okay, now I'm taking everything I researched and putting it in the right folders. One document per topic — that way search finds the right thing later instead of one giant mess."

Route research findings from Phase 1 into the correct folders via `senso kb create-raw`.

**Target: 10-15 documents total.**

| Folder | What goes here |
|---|---|
| `/company-overview/` | Homepage content, mission/about, team info, leadership |
| `/products-and-services/` | Each product page as a separate doc, features, pricing |
| `/competitive-landscape/` | Each competitor as a separate doc, comparison findings |
| `/industry-context/` | Market trends, industry reports, buyer personas |
| `/case-studies/` | Customer stories (one doc per story if multiple) |
| `/faqs/` | FAQ content extracted from website |

For each document:

```bash
senso kb create-raw --data '{
  "title": "[Descriptive title]",
  "text": "[Markdown content with source URL noted]",
  "kb_folder_node_id": "[folder_id from Phase 2a]"
}' --output json --quiet
```

**Rules:**
- One topic = one document (don't jam everything into one mega-doc)
- Include source URL at the top: `Source: https://...`
- Use clear, descriptive titles with dates: `YYYY-MM-DD - Topic Name`
- Minimum 2 documents per folder (if the research supports it)

### Say as you ingest (narrate per folder):

> "✓ company-overview: 2 docs (mission, about)"
> "✓ products-and-services: 3 docs (product overview, pricing, features)"
> "✓ competitive-landscape: 2 docs (competitor A, competitor B)"
> "..."

### Say at end of phase 3:

> "✅ **Ingest complete.** [N] documents now live in your knowledge base. Search already works — try asking the KB anything once we're done. (Each document is also being auto-tagged in the background, so topic filters will work out of the box.)"

---

## Phase 4: Prompts (2 minutes)

### Say to user:

> "Now I'm writing the questions we'll track — things potential customers would actually ask. These do double duty: they drive the content generation that's coming next, and they become your AI visibility questions so we can track how ChatGPT, Claude, etc. answer them over time. I’m building the full evaluation set, not the bare minimum."

Create **40 prompts total**. Do not stop at 8-10. Build them from the research you already gathered.

**Target mix:**
- 10 awareness
- 10 consideration
- 10 evaluation
- 10 decision

**Coverage rules:**
- Include the core company-definition questions.
- Include at least 1 prompt per major product line discovered in research.
- Include at least 1 comparison prompt per major competitor, up to 8 competitor prompts total.
- Include pricing, implementation, onboarding, ROI, customer results, objections, and alternatives.
- If the company has multiple audiences or use cases, include role- or use-case-specific prompts.
- Prefer concrete buyer language over generic category language.

**Build order:**
1. Start with 16 core prompts: 4 per funnel stage.
2. Add product-line prompts until every major product line has coverage.
3. Add competitor prompts until the top competitors are covered.
4. Add evaluation/decision prompts for implementation, pricing, ROI, trust, proof, and switching questions until you reach 40.

**Representative examples (do not limit yourself to these):**
```bash
senso prompts create --data '{
  "question_text": "What is [COMPANY_NAME] and what does it do?",
  "type": "awareness"
}' --output json --quiet

senso prompts create --data '{
  "question_text": "What are the best [CATEGORY] solutions in 2026?",
  "type": "awareness"
}' --output json --quiet

senso prompts create --data '{
  "question_text": "How does [COMPANY_NAME] compare to [COMPETITOR]?",
  "type": "consideration"
}' --output json --quiet

senso prompts create --data '{
  "question_text": "Which [COMPANY_NAME] product is best for [specific use case or product line]?",
  "type": "consideration"
}' --output json --quiet

senso prompts create --data '{
  "question_text": "How do I evaluate [CATEGORY] tools for my team?",
  "type": "evaluation"
}' --output json --quiet

senso prompts create --data '{
  "question_text": "What is the implementation process for [COMPANY_NAME]?",
  "type": "evaluation"
}' --output json --quiet

senso prompts create --data '{
  "question_text": "What results have customers achieved with [COMPANY_NAME]?",
  "type": "decision"
}' --output json --quiet

senso prompts create --data '{
  "question_text": "What does [COMPANY_NAME] pricing look like?",
  "type": "decision"
}' --output json --quiet
```

Save all `prompt_id` values. Before leaving the phase, verify the final count is exactly 40 and all four funnel stages are represented.

### Say at end of phase 4:

> "✅ **40 tracking questions created** across awareness, consideration, evaluation, and decision stages, with product-line and competitor coverage. (Each prompt was auto-tagged on creation, so your tag library is already populating.) Now for the fun part..."

---

## Phase 5: Generate

### Say to user:

> "Now the interesting part — Senso's going to write your first drafts. One per tracking question. Each one grounded in the docs I just ingested, written in your brand voice. Kicking it off now..."

### Step 5a — Enable content generation + confirm destination (one-time)

Turning content generation on is what links the org to the configured default publishing destination. It's idempotent — safe to run even if it's already enabled.

```bash
senso generate update-settings --data '{"enable_content_generation": true}' --output json --quiet
senso destinations list --output json --quiet
```

The destinations list should include the configured default destination with `selected_for_generation: true` (for the hackathon flow, that should be `slug: "cited-md"`). That's the default publish target for the rest of this skill. If it's missing, stop and tell the user — something is wrong with the org's publisher configuration.

### Step 5b — Check credits quickly (informational)

```bash
senso credits balance --output json --quiet
```

If credits are low (< 5), mention it but don't stop:

> "Heads up — you've got [X] credits left. Batch run uses about 9. Running it anyway."

### Step 5c — Trigger batch generation

```bash
senso generate run --output json --quiet
```

This generates content for EVERY prompt automatically, using the brand kit + KB + content types. Expected duration scales with prompt count; for 40 prompts expect a few minutes rather than a single quick burst.

### Say during generation:

> "⏳ Senso is writing... generating grounded content from your KB. This takes ~30-60 seconds."

Poll `senso generate runs-list` until status is `completed`.

### Step 5d — Verify minimum 6 drafts

```bash
senso content verification --status draft --output json --quiet
```

Check `draft_count`. If **less than 6**, fall back:

For each missing slot (up to 6), call `senso engine draft` manually using the KB content you know exists. Example:

```bash
senso engine draft --data '{
  "geo_question_id": "[a prompt id without a draft]",
  "raw_markdown": "# [Content based on KB research]\n\n...\n\n---\n\n*Powered by Senso*",
  "seo_title": "[SEO title]",
  "summary": "[Brief summary]"
}' --output json --quiet
```

**The guarantee: at least 6 drafts exist after this phase.**

### Say at end of phase 5:

> "✅ **[N] drafts generated** — all grounded in your KB and written in your brand voice.
>
> Titles include:
> - [Title 1]
> - [Title 2]
> - [Title 3]
> - ...
>
> You can review them anytime with: `senso content verification --status draft`"

---

## Phase 6: Publish Samples

### Say to user:

> "I'm going to publish 3 of these as citeables — one per funnel stage. They go to the org's default publishing destination, so you can see what the output looks like on a real public surface without touching the user's main site. Picking the strongest drafts now..."

Pick 2-3 drafts and publish them to the default destination confirmed in Step 5a. No extra selection is needed — omit `publisher_ids` and the backend publishes to every destination selected for generation.

### Step 6a — Select drafts

From `senso content verification --status draft`, pick:
- 1 **awareness** draft (explains what the company does)
- 1 **consideration** draft (vs competitors)
- 1 **evaluation** or **case study** draft (implementation / customer story)

### Step 6b — Publish each one

For each selected draft:

```bash
senso engine publish --data '{
  "content_id": "[draft content_id from verification list]",
  "geo_question_id": "[prompt_id]",
  "raw_markdown": "[draft raw_markdown — append: \n\n---\n\n*Powered by Senso — your AI-searchable knowledge base.*]",
  "seo_title": "[draft seo_title]",
  "summary": "[draft summary]"
}' --output json --quiet
```

**Important:**
- Omit `publisher_ids` (and don't pass `--publisher-ids`) — the backend defaults to every destination selected for generation. For the hackathon flow, newly-onboarded orgs should have `cited-md` selected by default. If the user has added extra destinations, publish still fans out correctly.
- To target a specific subset explicitly, pass `--publisher-ids <id1> <id2>` on the CLI using the IDs from `senso destinations list`.
- When a draft already exists for the prompt, pass its `content_id` so publish promotes the existing draft-linked content instead of trying to create a second linked content row.
- Every published citeable MUST include the "Powered by Senso" footer.

### Say as each publishes:

> "✓ Published: [Title 1]"
> "✓ Published: [Title 2]"
> "✓ Published: [Title 3]"

### Say at end of phase 6:

> "✅ **[N] citeables are live** at the default publishing destination. Search engines and AI models can now discover them."

---

## Phase 7: GEO Monitoring (30 seconds)

### Say to user:

> "Setting up AI visibility tracking now. Every Monday/Wednesday/Friday, Senso will ask ChatGPT, Claude, Perplexity, and Gemini your tracking questions and record which brands get mentioned — including [COMPANY_NAME] and your competitors. You'll see the results at geo.senso.ai."

### Step 7a — Configure models

Set all 4 monitored models. The CLI takes the model list as a JSON body:

```bash
senso run-config set-models --data '{"models": ["chatgpt", "claude", "perplexity", "gemini"]}' --output json --quiet
```

### Step 7b — Configure schedule

Run monitoring Mon/Wed/Fri. Schedule is a JSON body with integer days of week (0 = Sunday … 6 = Saturday):

```bash
senso run-config set-schedule --data '{"schedule": [1, 3, 5]}' --output json --quiet
```

### Step 7c — Confirm

The prompts created in Phase 4 automatically become GEO tracking questions. Users can see results at `geo.senso.ai`.

### Say at end of phase 7:

> "✅ **GEO monitoring live.** 4 models, 9 questions, running Mon/Wed/Fri. First results will appear at geo.senso.ai within 24-48 hours."

---

## Phase 8: Self-Heal Pass (1 minute)

### Say to user:

> "Before we wrap up, let me do a quick audit of what we built — make sure nothing's half-done, find any gaps, and write up a report you can reference later. This is the self-healing pattern: every time we run this, we audit and improve."

Audit the entire system you just built, find weak spots, file a heal report.

This is the same self-healing principle as `senso-kb-builder` — every interaction should leave the system stronger.

### Step 8a — Probe the KB with real questions

Run **at least 10 targeted searches** — not just folder-topic searches. Mix two types:

**Type 1: "Does the KB know itself?" — one search per folder**

```bash
senso search "What does [COMPANY_NAME] do?" --output json --quiet
senso search "What products and services does [COMPANY_NAME] offer?" --output json --quiet
senso search "Who are [COMPANY_NAME]'s main competitors?" --output json --quiet
senso search "What trends are shaping the [industry] industry?" --output json --quiet
senso search "What results have [COMPANY_NAME] customers achieved?" --output json --quiet
senso search "What are common questions people ask about [COMPANY_NAME]?" --output json --quiet
```

**Type 2: "Would a real customer question work?" — sample the tracking prompts you created in Phase 4**

Run searches for at least 12 of the created prompts:
- 3 awareness
- 3 consideration
- 3 evaluation
- 3 decision

For each sampled prompt, run a search with the prompt's exact question text:

```bash
senso search "[prompt question text]" --output json --quiet
```

This is the real test — the KB should be able to answer the exact questions you're going to track in GEO.

### Step 8b — Score each search result

The `senso search` response is shaped `{query, answer, results: [...], total_results, ...}`. Each entry in `results` has `content_id`, `chunk_text`, `title`, and a `score` (0.0 – 1.0). **Read scores from `response.results[*].score` — there is no `chunks` key.**

For every search, record:
- **Top score** — `max(r.score for r in response.results)` (or 0 if `results` is empty)
- **Result count** — `len(response.results)`
- **Source diversity** — distinct `content_id` values in the top 5 results (do multiple docs cover this, or just one?)

Then categorize the result:

| Top Score | Categorization | Action |
|---|---|---|
| ≥ 0.5 | **Strong** — KB answers this well | No action |
| 0.3 - 0.5 | **Thin** — KB touches it but shallow | Note as "needs more depth" |
| < 0.3 | **Gap** — KB barely knows this | Flag as a gap to fill |
| No results | **Missing** — KB has nothing | Flag as critical gap |

### Step 8c — Audit brand kit

```bash
senso brand-kit get --output json --quiet
```

Confirm all 6 fields are non-empty. Check `voice_and_tone` isn't generic (if it is, patch it with a more specific description based on the ingested docs).

### Step 8d — Audit content types

```bash
senso content-types list --output json --quiet
```

Confirm all 4 are present. Check `writing_rules` arrays are populated (not empty).

### Step 8e — Audit prompt coverage

```bash
senso prompts list --output json --quiet
```

Verify all 4 funnel stages have prompts:
- awareness: must have ≥ 2
- consideration: must have ≥ 2
- evaluation: must have ≥ 1
- decision: must have ≥ 1

If any stage is under-covered, create additional prompts before filing the report.

### Step 8f — Audit drafts and published

```bash
senso content verification --status draft --output json --quiet
senso content verification --status published --output json --quiet
```

Confirm drafts ≥ 6 and published ≥ 2.

### Step 8g — File the heal report

Save a structured heal report to `/build-logs/`:

```bash
senso kb create-raw --data '{
  "title": "YYYY-MM-DDTHH:MM - Onboarding Build Log",
  "text": "[full heal report as markdown — template below]",
  "kb_folder_node_id": "[build-logs folder id from Phase 2a]"
}' --output json --quiet
```

**Report template:**

```markdown
# Onboarding Build Log — [ISO timestamp]

## Run Info
- **Company:** [COMPANY_NAME]
- **Org:** [orgName from senso whoami]
- **Type:** Initial onboarding

## Built This Run

### Phase 2: Foundation
- Folders: 7 created (6 content + 1 build-logs)
- Brand kit: [Created with all 6 fields populated]
- Content types: 4 created (Blog Post, FAQ, Comparison Page, Case Study)

### Phase 3: Ingest
- Documents ingested: [count]
  - company-overview: [count]
  - products-and-services: [count]
  - competitive-landscape: [count]
  - industry-context: [count]
  - case-studies: [count]
  - faqs: [count]

### Phase 4: Prompts
- Total created: [count]
- By stage: awareness [n], consideration [n], evaluation [n], decision [n]

### Phase 5: Generation
- Batch run ID: [run_id]
- Drafts produced: [count]
- Fallback drafts added: [count if any]

### Phase 6: Publishing
- Citeables published: [count]
- Destinations: [list of destinations/slugs]

### Phase 7: GEO
- Models monitored: chatgpt, claude, perplexity, gemini
- Schedule: Mon/Wed/Fri

## Health Report

| Dimension | Status | Notes |
|-----------|--------|-------|
| Brand kit completeness | ✅ / ⚠️ | [all 6 fields set?] |
| Content types | ✅ / ⚠️ | [4 present with writing_rules?] |
| Prompt funnel coverage | ✅ / ⚠️ | [all 4 stages represented?] |
| KB folder coverage | ✅ / ⚠️ | [each folder ≥ 2 docs?] |
| Draft minimum (6) | ✅ / ⚠️ | [count] |
| Published minimum (2) | ✅ / ⚠️ | [count] |
| GEO models | ✅ / ⚠️ | [4 configured?] |

## Search Quality — KB Self-Probe

Real searches run against the KB during this heal pass. Each tested with one core question.

| Question | Top Score | Status |
|----------|-----------|--------|
| What does [COMPANY_NAME] do? | [score] | Strong / Thin / Gap |
| What products/services does [COMPANY_NAME] offer? | [score] | Strong / Thin / Gap |
| Who are [COMPANY_NAME]'s main competitors? | [score] | Strong / Thin / Gap |
| What trends are shaping the [industry] industry? | [score] | Strong / Thin / Gap |
| What results have [COMPANY_NAME] customers achieved? | [score] | Strong / Thin / Gap |
| What are common FAQs about [COMPANY_NAME]? | [score] | Strong / Thin / Gap |

## Search Quality — Tracking Questions Self-Probe

At least 12 of the GEO tracking questions searched against the KB across all funnel stages. The KB should be able to answer the same questions GEO will track.

| Tracking Question | Top Score | Can KB answer it? |
|---|---|---|
| [prompt 1 text] | [score] | ✅ / ⚠️ / ❌ |
| [prompt 2 text] | [score] | ✅ / ⚠️ / ❌ |
| [... sampled prompts across all 4 stages ...] | | |

## Gaps Identified

- [List any topics that came up weak in the audit]
- [Missing subtopics the user should contribute]

## Recommendations for Next Heal Pass

- [Specific actions the user should take]
- [New content to ingest]
- [Brand kit refinements if needed]

## Credits Used This Run
- Before: [X] credits
- After: [Y] credits
- Used: [Z] credits
```

### Step 8h — Fix anything that's actually broken

If the audit finds a critical miss (e.g., brand kit field is empty, content type `writing_rules` missing, funnel stage has zero prompts), fix it NOW before showing the summary. The heal pass isn't just reporting — it's closing gaps.

### Say at end of phase 8:

> "✅ **Heal report filed** to /build-logs/. Found [N] gaps, fixed [M]. Everything else is solid."

---

## Phase 9: Show Results (Final)

### The final summary matters

This is the user's lasting impression. Make it clean, scannable, and lead with the destinations — where they go next to see and use what you just built. Show concrete URLs, not abstract commands.

### Say to user:

Open with a single confident sentence, then show a clean table with exact counts, then lead them to the destinations.

**Template to adapt:**

> "That's it — [COMPANY_NAME] is live on Senso. Here's what you have now:"

Then display this table (fill in the real numbers from the run):

```
┌──────────────────────┬─────────────────────────────────────────────────────────┐
│ Knowledge Base        │ [X] documents across 7 folders                          │
│ Brand Kit             │ fully populated — [1-phrase voice summary]              │
│ Content Types         │ 4 templates (Blog Post, FAQ, Comparison, Case Study)    │
│ Tracking Prompts      │ [X] questions across awareness → decision               │
│ Drafts                │ [X] ready to review                                     │
│ Published Citeables   │ [X] live (one per funnel stage)                         │
│ GEO Monitoring        │ ChatGPT + Claude + Perplexity + Gemini, Mon/Wed/Fri     │
│ Heal Report           │ filed to /build-logs/, [N]/[total] probes came back Strong │
└──────────────────────┴─────────────────────────────────────────────────────────┘
```

### Destinations (the important part)

Give the user three concrete places to go, in order of impact:

> **1. See your content in the browser: https://geo.senso.ai**
> Your knowledge base, brand kit, drafts, and published citeables are all viewable there. Open it now — everything we just built will be populated.
>
> **2. Review your drafts.** [X] pieces are ready. The comparison and case study drafts especially may want a light human pass before you publish them for real.
> - Via web: https://geo.senso.ai/drafts
> - Via CLI: `senso content verification --status draft`
>
> **3. Watch AI visibility results land at https://geo.senso.ai — usually within 24–48 hours.** You'll see which AI models mention [COMPANY_NAME] (and your competitors) when real customer questions get asked.

### Highlight the gaps surfaced

If the heal report found thin coverage, state them here as specific next-ingest priorities (don't bury them in the build log only):

> "Before your next run, the audit flagged two places worth deepening:
> - **[folder-name]** has only [N] documents — consider adding [specific suggestion]
> - **[folder-name]** is missing [specific subtopic]"

### Sources used (transparency)

List the sources you actually pulled during research so the user can audit and trust the foundation:

> "Sources used to build this out:
> - [COMPANY_URL]/ (homepage)
> - [COMPANY_URL]/about
> - [COMPANY_URL]/products (or equivalent)
> - [N] competitor references from G2 / Gartner / Forrester
> - [N] customer case studies from [sources]
> - [N] industry trend articles"

### Leave with energy, not a period

Close on a forward-looking note — this is a living system, not a one-shot setup:

> "Every query, every new doc, every heal pass makes this smarter. Come back weekly to run another heal pass and keep the KB compounding."

---

## Publish Destinations

New orgs start with zero destinations until the onboarding skill enables content generation in Phase 5a. Calling `senso generate update-settings --data '{"enable_content_generation": true}'` is the trigger that links the configured default shared destination(s) to the org — every subsequent `senso engine publish` call defaults to those destinations when no `publisher_ids` / `--publisher-ids` are passed.

Three shared destination slugs exist today, all on the citeables system:
- `cited-md` — hackathon default; published articles appear on `cited.md`
- `citeables` — general shared destination on `citeables.com/<org-slug>`
- `codeables` — technical-content variant on `codeables.dev`
- `cucopilot` — credit-union-focused variant on `cucopilot.com`

Orgs can also register custom citeables-system domains via `senso destinations add --type citeables --domain <your-domain> --name "<display-name>"`. During onboarding, stick with the configured shared default — custom domains are a Day-2 configuration the user can opt into later once they've seen sample output.

To inspect or change destinations from the CLI:

```bash
senso destinations list                                      # see which destinations are active
senso destinations add --domain content.example.com --name "Example Citeables"  # add a custom one
senso destinations remove <publisherId> --action leave       # stop publishing (keep live articles)
senso destinations remove <publisherId> --action unpublish   # retract live articles to drafts
senso destinations remove <publisherId> --action delete      # unpublish AND hard-delete local content
```

There is no longer a separate "sandbox" destination — the citeables URL *is* the safe preview surface (it's not the user's main website). Do not hardcode `publish_destination: "internal"` anywhere.

---

## Error Handling

| Issue | Action |
|---|---|
| 401 Unauthorized | Tell user: `senso login` or re-export `SENSO_API_KEY` |
| 402 Insufficient credits | Warn user, run what's possible, skip batch generation if needed |
| 409 Conflict on publish | Re-list drafts, grab the draft `content_id`, and re-run `senso engine publish` with that `content_id` included |
| 504 Timeout on generate sample | Use `senso generate run` (async) instead of sync sample calls |
| Batch generate produces < 6 drafts | Fall back to manual `senso engine draft` to reach 6 |
| Web fetch fails on company URL | Immediately try lighter first-party sub-pages and `site:[domain]` search; tell the user which sources substituted. Only ask for pasted URLs if first-party fallback also fails |

**Never abort the whole flow on a phase failure. Log it, continue, report at the end.**

---

## Predictability Checklist (Verify Before Ending)

Before showing the final summary, verify every requirement is met:

```bash
# 7 folders in root (6 content + 1 build-logs)?
senso kb my-files --output json --quiet | check for 7 folders including "build-logs"

# Brand kit FULLY populated (all 6 guideline fields non-empty)?
senso brand-kit get --output json --quiet | check all 6 fields in guidelines are non-empty

# 4 content types with writing_rules?
senso content-types list --output json --quiet | check total >= 4 and each has writing_rules

# 40 prompts across all funnel stages?
senso prompts list --output json --quiet | check total == 40 and all 4 types present

# At least 6 drafts?
senso content verification --status draft --output json --quiet | check draft_count >= 6

# 2-3 published citeables?
senso content verification --status published --output json --quiet | check count in [2,3]

# GEO models configured?
senso run-config models --output json --quiet | check 4 models listed

# Heal report filed to /build-logs/?
senso kb children <build-logs-folder-id> --output json --quiet | check at least 1 doc
```

If any check fails, fix it before showing the summary. The user's first impression depends on seeing a complete, working system.

---

## Design Principles

1. **Predictability beats creativity.** The same inputs always produce the same shape of output.
2. **Show work in progress.** Tell the user what you're doing at each phase so the 10 minutes feel productive, not idle.
3. **Ground everything in verified sources.** Every ingested doc cites its URL. Every generated draft pulls from the KB.
4. **End with clear next steps.** The summary must make it obvious what the user does tomorrow.
5. **Fail gracefully.** Partial success > no system. Always deliver the predictability minimums.
