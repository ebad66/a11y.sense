# a11y.sense

a11y.sense is an AI-assisted accessibility scan-and-visualize app for fast WCAG 2.1 triage.

Paste a URL, run a scan, and get:
- findings grouped by **POUR** principles (Perceivable, Operable, Understandable, Robust)
- issue-level WCAG criterion tags (e.g. `1.1.1 Non-text Content`)
- screenshot-linked element coordinates for visual debugging
- simulation views that help teams feel the impact of accessibility failures

---

## Why this exists

Most accessibility reports are hard to prioritize and hard to explain. a11y.sense focuses on two outcomes:

1. **Evidence-backed WCAG findings** tied to page structure and element snippets
2. **Visual communication** (pinpoint overlays + simulation outputs) that make issues understandable to non-specialists

---

## Key features

- **Single-URL scan workflow**
  - Home page submits URL to `POST /api/scan`
  - Scans typically complete in ~20–40s (UI guidance)

- **WCAG 2.1 structure by principle (POUR)**
  - Audits run for all four principles in parallel
  - Results are grouped by principle and include severity (`Critical`, `Warning`, `Pass`)

- **Evidence-backed issue objects**
  - Each issue can include:
    - `wcag` success criterion reference
    - affected `element` HTML snippet
    - machine-usable `selector`
    - actionable `fix`

- **Rendered-page capture + coordinate mapping**
  - Playwright captures full-page screenshot and rendered HTML
  - Issues are mapped to coordinates (`xPct`, `yPct`, `wPct`, `hPct`) for report visualization

- **Simulation endpoint for accessibility impact storytelling**
  - `POST /api/simulate` supports profile-based transformations
  - Includes a special HTML simulation path for blind profile

- **Session-backed report sharing**
  - Scan sessions are stored in-memory and retrievable via `/api/session/:sessionId`
  - Share links point to `/scan/:sessionId` (TTL-based)

---

## Architecture overview

```text
[Client: app/page.tsx]
  -> POST /api/scan
      -> Playwright capture (lib/screenshot.ts)
      -> HTML parsing + extraction (lib/scraper.ts)
      -> Parallel WCAG-principle audit via Gemini (lib/claude.ts)
      -> Element coordinate resolution (same Playwright page)
      -> In-memory session store (lib/session.ts)
  <- sessionId + summary

[Client: app/scan/[sessionId]/page.tsx]
  -> GET /api/session/[sessionId]
  -> GET /api/screenshot/[sessionId]
  -> POST /api/simulate (on-demand)
```

### Core modules

- `app/api/scan/route.ts`: end-to-end scan orchestration
- `lib/screenshot.ts`: browser launch, page stabilization, screenshot, coordinate matching
- `lib/scraper.ts`: structured extraction + condensed HTML + summary
- `lib/claude.ts`: principle-level prompting and normalized issue output
- `lib/session.ts`: in-memory session persistence (24h TTL)
- `app/scan/[sessionId]/page.tsx`: report UI with problems + visualize tabs

---

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create `.env.local` in the project root:

```bash
GEMINI_API_KEY=your_google_gemini_key_here
# Optional fallback key used by simulation client
# GOOGLE_API_KEY=your_google_api_key_here
```

### 3) Run development server

```bash
npm run dev
```

Open: `http://localhost:3000`

---

## Commands

### Development

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Start production server (after build)

```bash
npm run start
```

### Tests

There is currently **no test script** in `package.json`.

---

## API surface (current)

- `POST /api/scan` — create a scan session from URL
- `GET /api/session/[sessionId]` — fetch session metadata + issues
- `GET /api/screenshot/[sessionId]` — fetch stored screenshot bytes
- `POST /api/simulate` — generate profile simulation for a session
- `POST /api/coords/[sessionId]` — resolve element coordinates (utility route)

---

## Demo flow (recommended)

1. Start app with `npm run dev`
2. Scan one of:
   - `https://gov.uk`
   - `https://bbc.com`
   - `https://github.com`
   - `https://wikipedia.org`
3. Wait for redirect to `/scan/:sessionId`
4. In report view:
   - switch between POUR principles in sidebar
   - inspect `Critical` vs `Warning` findings
   - open **Visualize** to see mapped issue pins on screenshot
5. Use **Share** to copy report link
6. Click **Re-scan** to generate a fresh session and compare issue patterns manually

---

## Known limitations

- **In-memory sessions only**: session data is not persisted across server restarts.
- **Single-page snapshot model**: scan is based on one captured page state, not full user journeys.
- **AI output variance**: issue wording and count can vary between scans.
- **Validation hardening is still in progress**: URL and error contract hardening work is tracked in `TODO_SHIP.md`.
- **No automated tests configured yet**.

---

## Tech stack

- Next.js (App Router) + React
- Playwright (rendered capture + coordinate lookup)
- Cheerio (HTML extraction)
- Google Gemini APIs (text audit + image simulation)
- TypeScript + Tailwind

---

## Branch context

Current shipping branch target: `feat/a11ysense-next-corex`
