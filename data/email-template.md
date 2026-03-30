# Fundraising Outreach Command Center — Build Spec

## What
A single-page Cloudflare Pages site at `outreach.tycho.sh` (or deployed to `cloudnc-outreach` Pages project). Protected by CF Access (same config as review.tycho.sh — theo@openclaw.ai only).

## Architecture  
- Single HTML file with embedded CSS/JS
- Data embedded directly in the HTML (no API calls, no backend, no KV)
- Static site — deploy to Cloudflare Pages
- Light theme: white background, #FD384E accent, system fonts (Inter/system-ui)

## Data Source
Read the investor list from `fundraising/research/comprehensive-us-vc-list.md` and parse it into a JSON array. Each entry needs:
- `rank` (priority number)
- `firm` (name)
- `tier` (A/B/C)
- `hq` (city)
- `fundSize` (string)
- `thesis` (short string)
- `portfolio` (1-2 relevant cos)
- `contact` (name + title of PRIMARY contact only — one person, no CC)
- `email` (pattern if known, e.g. "greg@eclipse.capital")
- `why` (one sentence on CloudNC fit)
- `emailDraft` (personalized cold email — see template below)
- `sent` (boolean, default false — tracked in localStorage)

Skip any entry marked "SKIP" or "ALREADY IN PIPELINE".

## Email Template
Each firm gets a personalized email. The template:

```
Subject: CloudNC — AI for CNC machining, $5.4M ARR, [SPECIFIC_HOOK]

Hi [FIRST_NAME],

I'm Theo, co-founder of CloudNC. We've built an AI that automates CNC machining programming — the cognitive bottleneck in every machine shop worldwide.

[ONE_SENTENCE_PERSONALIZATION based on their thesis/portfolio]

Quick numbers: $5.4M ARR (2x YoY), 915 factories, backed by Autodesk ($45M Series B), Lockheed Martin, and In-Q-Tel. Raising $15M to scale US go-to-market.

I'm running a structured process — 30-minute intros this week, follow-ups next week for firms that want in. Happy to send the deck if there's interest.

Best,
Theo Saville
CEO & Co-Founder, CloudNC
theo@cloudnc.com
```

The ONE_SENTENCE_PERSONALIZATION should reference their specific portfolio company or thesis. Examples:
- Eclipse: "You backed Bright Machines and VulcanForms — we're solving the software layer those factories need."
- DCVC: "You've already invested in Sight Machine, Paperless Parts, and Instrumental — we're the missing piece in that stack."
- Emergence: "You pioneered vertical SaaS investing with ServiceMax and Veeva — CAM Assist is vertical SaaS for the $29B machining market."

The SPECIFIC_HOOK in subject line should be the most compelling thing for that firm (e.g. "Lockheed Martin customer" for defense firms, "2x ARR growth" for growth firms, "$29B vertical" for vertical SaaS firms).

## UI Layout

### Header
- "CloudNC — Fundraising Outreach" title
- Stats bar: "X of Y sent" | "Tier A: X/Y" | "Tier B: X/Y" | "Tier C: X/Y"
- Filter buttons: All | Tier A | Tier B | Tier C | Not Sent | Sent

### Main Content — Card List (NOT kanban, NOT grid — a simple scrollable list)
Each card is a row/card showing:
- Priority rank (#1, #2, etc.)
- Firm name (bold, large)
- Tier badge (A=red, B=orange, C=blue)
- HQ city
- Fund size
- Contact name + title
- "Why they'd care" one-liner
- **"Copy Email" button** — copies the full personalized email to clipboard
- **"Copy Address" button** — copies the email address
- **"Mark Sent" checkbox** — persists to localStorage, greys out the card
- Expandable section (click to expand): full firm details, portfolio, thesis, email draft preview

### Design
- Clean, minimal, fast
- Cards should be scannable — Theo needs to blast through 100+ emails
- Sent cards should be visually dimmed but not hidden (unless filter active)
- Mobile-friendly (Theo checks on phone)
- Copy buttons should show a brief "Copied!" toast
- Sort: default by priority rank. Toggle to sort by tier, by sent status

## Constraints
- NO backend, NO API calls, NO database — everything is in the HTML
- localStorage for sent tracking only
- Must work offline after first load
- Total file should be under 200KB
- No external dependencies (no React, no frameworks, no CDN imports)

## Build Output
Write the complete HTML file to: `/Users/theclaw/.openclaw/workspace/projects/outreach-blitz/index.html`

## Data Parsing Instructions
The investor list at `fundraising/research/comprehensive-us-vc-list.md` is markdown with ### headers per firm. Parse each firm entry. Skip entries with "ALREADY IN PIPELINE — SKIP" or "SKIP — Low fit". Extract all fields mentioned above. Generate personalized emails for each.
