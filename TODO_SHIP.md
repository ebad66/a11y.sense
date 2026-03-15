# TODO_SHIP

## P0 — Must ship
- [ ] URL validation hardening (protocol, localhost/private host blocking, length limits)
- [ ] Structured API errors with stable codes + retryability hints
- [ ] Scan pipeline stage metadata + partial failure visibility
- [ ] Browser lifecycle safety improvements in scan route
- [ ] Remove sensitive key-preview logging from simulation route
- [ ] Replace `alert()`-based failures with inline report UX messaging

## P1 — High impact polish
- [ ] Landing page rewrite (clear value prop + trust signals + better hierarchy)
- [ ] Report executive summary scorecard
- [ ] Prioritized "Fix this first" remediation queue
- [ ] Issue evidence framing (selector/snippet/confidence/rationale)
- [ ] Developer handoff output (copy/download markdown)
- [ ] Better tab semantics + accessible heading structure

## P2 — Differentiators
- [ ] Before/after re-scan comparison panel
- [ ] Severity calibration helper + confidence rating
- [ ] Smarter issue dedupe/grouping strategy
- [ ] Report share UX improvements

## QA / Release
- [ ] Add lint + typecheck + test scripts
- [ ] Add targeted unit tests for validation + prioritization utilities
- [ ] Run build/lint/typecheck/test and capture exact outputs
- [ ] Rewrite README to match shipped product
- [ ] Final PR handoff summary (changes, risks, run commands, PR copy)
