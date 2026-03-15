# a11y.sense

Evidence-backed accessibility analysis for live websites.

`a11y.sense` scans a URL, runs AI-assisted WCAG analysis grouped by POUR principles, maps findings to rendered page coordinates, and outputs a prioritized remediation report teams can actually act on.

---

## Why this exists

Most accessibility demos stop at generic issue lists. `a11y.sense` focuses on **developer handoff quality**:

- clear severity framing
- evidence clues (selector/snippet + screenshot mapping)
- "fix this first" prioritization
- shareable, session-based report links
- markdown export for engineering tickets

It is designed to be useful for:

- **Developers** (specific fixes and issue context)
- **Product/Judges** (summary scorecard + before/after re-scan comparison)
- **Non-experts** (structured explanations without drowning in standards jargon)

---

## Core features

- **Live URL scan pipeline**
  - captures rendered HTML + screenshot using Playwright
  - analyzes across all four WCAG 2.1 POUR principles in parallel
- **Structured issue model**
  - severity (`Critical` / `Warning` / `Pass`)
  - WCAG reference
  - confidence + effort metadata
  - rationale + affected-user hints
- **Visual evidence workflow**
  - issue pins mapped onto page screenshot
  - selector/snippet-based coordinate resolution with fallback
- **Executive report UX**
  - scorecard
  - prioritized remediation queue
  - grouped findings panel
  - developer handoff markdown output
- **Differentiators**
  - profile simulation entry points (blind, low vision, dyslexia, deaf, motor)
  - before/after comparison when re-scanning from an existing report

---

## Architecture (high level)

### Frontend (Next.js App Router)

- `app/page.tsx` — landing + scan trigger
- `app/scan/[sessionId]/page.tsx` — report experience
- `components/VisualizeTab.tsx` — screenshot evidence view
- `components/IssueRow.tsx` — expandable issue details
- `components/SimulationView.tsx` — persona simulation modal

### API routes

- `POST /api/scan`
  - URL validation
  - render capture
  - WCAG analysis
  - coordinate mapping
  - session creation
- `GET /api/session/[sessionId]` — report retrieval
- `GET /api/screenshot/[sessionId]` — screenshot bytes
- `POST /api/coords/[sessionId]` — coordinate fallback resolver
- `POST /api/simulate` — profile simulation generation

### Core libraries

- `lib/claude.ts` — Gemini-powered WCAG analysis + retries/fallbacks
- `lib/screenshot.ts` — Playwright capture + element mapping
- `lib/session.ts` — in-memory session store with TTL + bounds
- `lib/report.ts` — scoring, prioritization, markdown handoff builder
- `lib/url.ts` — URL normalization + safety checks
- `lib/api.ts` — structured API error helpers

---

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create `.env.local` in repo root:

```bash
GEMINI_API_KEY=your_key_here
# Optional fallback name supported by some tooling:
# GOOGLE_API_KEY=your_key_here
```

### 3) Run development server

```bash
npm run dev
```

Open <http://localhost:3000>

---

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## Recommended demo flow

1. Start at landing page and scan a public URL.
2. In report:
   - show scorecard
   - show "Fix this first" queue
   - open Problems tab for concrete issue details
   - open Visualize tab for screenshot evidence
3. Trigger **Re-scan** from the report to demonstrate before/after deltas.
4. Open **Developer handoff** tab and copy/download markdown output.
5. Optionally run a persona simulation from Overview.

---

## Current limitations

- Sessions are currently **in-memory** (24h TTL), not durable across restarts/scale-out.
- Findings are AI-assisted and should be validated with deterministic tools (axe-core, Lighthouse, manual QA) for compliance sign-off.
- Coordinate fallback route launches a new browser process when needed (functional but not yet queue-optimized).
- No background job queue yet for high concurrency workloads.

---

## Quality and contribution notes

This branch prioritizes:

- safer URL validation + clearer API errors
- stronger scan resilience + partial-failure transparency
- report IA improvements and remediation-first UX
- test/lint/typecheck/build validation scripts

If you contribute, keep changes small, reviewable, and validated with the commands above.
