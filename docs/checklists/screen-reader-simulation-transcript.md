# Checklist: Screen-Reader Simulation Transcript

## 1) Objective + Non-Goals
- [ ] Simulate what assistive tech users are likely to hear, in sequence, during journey execution.
- [ ] Convert technical accessibility state into plain-English narrative stakeholders can understand.
- [ ] Non-goals (MVP): full AT emulator parity across all readers/OS combinations.

## 2) Product Scope (MVP)
- [ ] Generate transcript from journey replay (reuse Journey engine outputs).
- [ ] Include announcement atoms per interaction:
  - [ ] role
  - [ ] accessible name
  - [ ] state/value
  - [ ] landmark/context
  - [ ] live region updates
- [ ] Add confusion flags:
  - [ ] duplicate labels
  - [ ] context loss after route change
  - [ ] focus jump without explanation
  - [ ] non-descriptive control names ("click here", "button")

## 3) Transcript Data Model
- [ ] Create `TranscriptEvent` schema:
  - [ ] timestamp + journeyStepId
  - [ ] trigger action
  - [ ] announced string
  - [ ] source node metadata
  - [ ] confidence score
- [ ] Create `ConfusionFlag` schema:
  - [ ] type
  - [ ] severity
  - [ ] rationale
  - [ ] suggested remediation
- [ ] Support export formats:
  - [ ] JSON (machine)
  - [ ] plain text (human)

## 4) Simulation Logic
- [ ] Build accessible tree extraction utility from DOM snapshots.
- [ ] Compute effective accessible name/description (ARIA + native semantics).
- [ ] Track focus transitions and detect abrupt context switches.
- [ ] Observe live regions and append announcement events in order.
- [ ] Annotate hidden/disabled semantics correctly.

## 5) Quality Heuristics
- [ ] Flag repeated identical announcements over threshold.
- [ ] Flag missing heading/landmark context on page transitions.
- [ ] Flag role/name mismatches (e.g., div as fake button without semantics).
- [ ] Flag unlabeled form controls and ambiguous grouped inputs.

## 6) UX / Presentation
- [ ] Add “Transcript” view:
  - [ ] chronological timeline
  - [ ] filter by step / severity / flag type
  - [ ] click-through to DOM evidence
- [ ] Add dual view toggle:
  - [ ] Technical (raw event details)
  - [ ] Plain English (stakeholder narrative)
- [ ] Add summary box:
  - [ ] "What users likely experience"
  - [ ] "Top confusion moments"

## 7) Integration with Journey Testing
- [ ] Link each transcript event to exact journey step.
- [ ] Surface transcript snippets in journey failure cards.
- [ ] Include transcript confidence in final run summary.

## 8) Testing Strategy
- [ ] Unit tests for accessible name/role/state computation.
- [ ] Golden-file tests for known page fixtures (expected transcript text).
- [ ] Regression tests for confusion flag triggering.
- [ ] Cross-browser sanity checks (at least Chromium baseline in MVP).

## 9) Reliability + Safety
- [ ] Cap transcript size and chunk large runs.
- [ ] Redact user-entered sensitive values from transcript output.
- [ ] Add fallback behavior when accessibility tree extraction is partial.

## 10) Definition of Done
- [ ] Transcript generated for all MVP journey templates.
- [ ] Confusion flags visible and tied to remediation guidance.
- [ ] Plain-English stakeholder view available.
- [ ] Export works (JSON + text) and is referenced in run artifacts.
