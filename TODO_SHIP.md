# TODO_SHIP

## P0 — Must ship
- [x] URL validation hardening (protocol, localhost/private host blocking, length limits)
- [x] Structured API errors with stable codes + retryability hints
- [x] Scan pipeline stage metadata + partial failure visibility
- [x] Browser lifecycle safety improvements in scan route
- [x] Remove sensitive key-preview logging from simulation route
- [x] Replace `alert()`-based failures with inline report UX messaging

## P1 — High impact polish
- [x] Landing page rewrite (clear value prop + trust signals + better hierarchy)
- [x] Report executive summary scorecard
- [x] Prioritized "Fix this first" remediation queue
- [x] Issue evidence framing (selector/snippet/confidence/rationale)
- [x] Developer handoff output (copy/download markdown)
- [x] Better tab semantics + accessible heading structure

## P2 — Differentiators
- [x] Before/after re-scan comparison panel
- [x] Severity calibration helper + confidence rating
- [x] Smarter issue dedupe/grouping strategy
- [x] Report share UX improvements

## QA / Release
- [x] Add lint + typecheck + test scripts
- [x] Add targeted unit tests for validation + prioritization utilities
- [x] Run build/lint/typecheck/test and capture exact outputs
- [x] Rewrite README to match shipped product
- [ ] Final PR handoff summary (changes, risks, run commands, PR copy)
