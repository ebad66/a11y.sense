# Checklist: Task-Based Journey Testing

## 1) Objective + Non-Goals
- [ ] Define a **journey-first** evaluation layer focused on user outcomes (checkout/signup/booking completion), not only static violations.
- [ ] Produce deterministic pass/fail per journey step and a final journey verdict.
- [ ] Non-goals (MVP): multi-device matrix, visual regression, autonomous self-healing scripts.

## 2) Product Scope (MVP)
- [ ] Support 3 starter journey templates:
  - [ ] Checkout
  - [ ] Signup
  - [ ] Book appointment
- [ ] Support keyboard-only mode as first-class execution profile.
- [ ] Render per-step result cards with:
  - [ ] step name
  - [ ] expected criterion
  - [ ] observed behavior
  - [ ] severity
  - [ ] suggested fix
- [ ] Show human-readable failure copy (example):
  - [ ] `Keyboard-only user failed at Step 3: payment method radio group unreachable.`

## 3) Data + Schema
- [ ] Create `JourneyDefinition` schema (JSON/TS):
  - [ ] `id`, `name`, `version`, `entryUrl`
  - [ ] ordered `steps[]`
  - [ ] step `goal`, `selector/ref`, `action`, `assertions[]`
  - [ ] fallback/wait strategy
- [ ] Create `JourneyRun` schema:
  - [ ] metadata (timestamp, commit SHA, env)
  - [ ] step outcomes, artifacts, logs, timing
  - [ ] final status + confidence
- [ ] Create `JourneyFailureTaxonomy`:
  - [ ] focus trap
  - [ ] unreachable control
  - [ ] missing visible focus
  - [ ] context loss
  - [ ] unexpected navigation

## 4) Execution Engine
- [ ] Implement keyboard action DSL (`Tab`, `Shift+Tab`, `Enter`, `Space`, arrows, escape).
- [ ] Enforce deterministic timing:
  - [ ] bounded waits
  - [ ] retry policy with max attempts
  - [ ] action timeouts
- [ ] Capture evidence per step:
  - [ ] DOM snapshot
  - [ ] focus target before/after
  - [ ] URL + route changes
  - [ ] screenshot (optional MVP if cheap)
- [ ] Add interruption handling:
  - [ ] modal/dialog appearance
  - [ ] cookie banner interception
  - [ ] dead-end state detection

## 5) Scoring + Prioritization
- [ ] Compute **Journey Success Score** (0–100).
- [ ] Weight critical path steps higher (payment, submit, confirmation).
- [ ] Assign severity from business impact, not only WCAG mapping.
- [ ] Emit top blockers list with “fix first” ranking.

## 6) UX / Reporting
- [ ] Add Journey tab/UI section with:
  - [ ] template picker
  - [ ] run history
  - [ ] step timeline
  - [ ] blockers summary
- [ ] Include “business outcome framing”:
  - [ ] can/cannot complete journey
  - [ ] completion time delta
  - [ ] confidence level

## 7) API / Integrations
- [ ] Add backend route for journey run start/stop/status.
- [ ] Store run artifacts for comparison against previous runs.
- [ ] Add CI mode to fail on:
  - [ ] new critical blocker
  - [ ] journey score drop over threshold

## 8) Testing Strategy
- [ ] Unit tests for parser/schema/step executor.
- [ ] Contract tests for runner I/O shapes.
- [ ] E2E happy-path + failure-path fixtures.
- [ ] Determinism test: same fixture run should match expected output in >=95% of runs.

## 9) Security + Reliability
- [ ] Redact PII in logs/artifacts.
- [ ] Sandbox script execution; disallow arbitrary code in journey JSON.
- [ ] Add kill-switch and max-runtime guardrails.

## 10) Definition of Done
- [ ] One-click run for 3 templates from UI.
- [ ] Step-level failures with actionable copy and evidence.
- [ ] CI gate option working.
- [ ] Docs: schema + sample journey files + troubleshooting guide.
