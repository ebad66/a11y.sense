# BUILD_NOTES

## 2026-03-15 — Branch bootstrap

- Branch created: `feat/a11ysense-next-corex`
- Baseline checks:
  - `git status -sb`
  - `git pull --ff-only`
  - `npm install`
  - `npm run build` ✅
- Parallel audit agents launched across product/UX, frontend, backend pipeline, accessibility credibility, performance/reliability, visual design, QA, and README/pitch.

## Audit synthesis (condensed)

### P0 foundations
- Harden URL validation and API error contracts.
- Improve scan pipeline resilience (timeouts, stage metadata, partial failure transparency).
- Guarantee browser cleanup and reduce fragile error handling.
- Bound in-memory session storage behavior.

### P1 product polish
- Improve landing page trust messaging and hierarchy.
- Rework report IA (summary + prioritized queue + clearer issue evidence).
- Add cleaner loading/error/retry UX.
- Add developer handoff output.

### P2 differentiators
- Add before/after re-scan comparison.
- Add confidence/effort framing for issue prioritization.
- Integrate persona simulation entry points in report flow.

## 2026-03-15 — Implementation pass

### API / backend hardening
- Added `lib/url.ts` for robust URL normalization + safety checks.
- Added `lib/api.ts` for structured API error payloads and client parsing.
- Reworked `POST /api/scan`:
  - stage timing capture
  - timeout wrappers
  - explicit partial/warning metadata in response + session
  - safer error mapping and retryable hints
  - guaranteed browser close in `finally`
- Updated `lib/claude.ts`:
  - stronger issue schema (confidence, effort, rationale, affected users)
  - retries for transient model failures
  - principle-level fallback always returned (no silent omission)
- Updated `lib/session.ts`:
  - bounded in-memory behavior (evict oldest session when over cap)
  - screenshot size guardrail
  - persisted scan metadata shape
- Hardened auxiliary routes:
  - `/api/session/[sessionId]`
  - `/api/screenshot/[sessionId]`
  - `/api/coords/[sessionId]` (input validation + caps)
  - `/api/simulate` (removed key preview logging)

### Frontend / product experience
- Rewrote landing page (`app/page.tsx`) with stronger product narrative, trust cues, and clearer scan UX.
- Reworked report page (`app/scan/[sessionId]/page.tsx`) to include:
  - executive scorecard
  - prioritized remediation queue
  - before/after comparison panel
  - structured warnings from scan metadata
  - improved tabbed IA (overview / problems / visualize / handoff)
  - inline re-scan error handling (no `alert` flow)
  - integrated persona simulation launcher
- Updated issue and principle components:
  - `components/IssueRow.tsx`
  - `components/ProfileCard.tsx`
  - `components/SimulationView.tsx`
- Theme and accessibility pass in `app/globals.css` + metadata refresh in `app/layout.tsx`.

### Quality and test tooling
- Added lint/typecheck/test scripts in `package.json`.
- Added ESLint flat config (`eslint.config.mjs`).
- Added Vitest setup (`vitest.config.ts`) + unit tests:
  - `tests/url.test.ts`
  - `tests/report.test.ts`

### Documentation
- Replaced boilerplate README with product-grade docs:
  - feature overview
  - architecture
  - setup/env
  - validation commands
  - demo flow
  - limitations

## Validation runs

- `npm run test` ✅
  - 2 files, 8 tests passing
- `npm run typecheck` ✅
- `npm run lint` ✅ (warnings only; no errors)
- `npm run build` ✅
  - Next.js production build completed

## Remaining follow-up (post-branch scope)

- Durable session persistence (Redis/object storage) for multi-instance reliability.
- Queue/concurrency control for high-volume scan workloads.
- Deeper deterministic corroboration layer for compliance-grade severity confidence.
