# Checklist: Exec Mode Export (Board-Ready PDF)

## 1) Objective + Audience
- [ ] Produce an executive-ready 1-page PDF summarizing accessibility risk and progress.
- [ ] Audience: leadership, compliance, procurement, and customer-facing stakeholders.

## 2) Required Output Sections (MVP)
- [ ] Title block (org/project/environment/date/scan version).
- [ ] Risk tier (Critical/High/Medium/Low) with short rationale.
- [ ] Compliance exposure snapshot (WCAG/ADA-like mapping language).
- [ ] Customer impact summary (journey completion risk).
- [ ] Delivery/velocity impact summary (dev effort + regression trend).
- [ ] Top 10 fixes by ROI table/list:
  - [ ] issue
  - [ ] impact
  - [ ] effort estimate
  - [ ] owner suggestion
- [ ] Progress delta vs last scan:
  - [ ] score movement
  - [ ] blocker count movement
  - [ ] risk movement
- [ ] Projected risk reduction if top fixes are completed.

## 3) Data Contracts
- [ ] Define `ExecReportInput` schema combining:
  - [ ] journey outcomes
  - [ ] transcript confusion flags
  - [ ] rule-level findings
  - [ ] historical baseline
- [ ] Define `ExecMetrics` calculations and confidence rules.
- [ ] Build deterministic ranking formula for ROI ordering.

## 4) Rendering Pipeline
- [ ] Choose rendering method (HTML-to-PDF or PDF library) and lock template.
- [ ] Implement consistent pagination and typography.
- [ ] Ensure charts/indicators render identically in CI and local.
- [ ] Embed metadata (run ID, commit SHA, generated-at timestamp).

## 5) Narrative Layer
- [ ] Generate concise “what changed and why it matters” text.
- [ ] Avoid jargon; use board-friendly wording.
- [ ] Provide caveats/confidence statement when data quality is partial.

## 6) UX / Product Flow
- [ ] Add “Generate Exec PDF” action in report UI.
- [ ] Add download link + artifact retention in run history.
- [ ] Add optional “include previous period comparison” toggle (MVP default: on).

## 7) Integrity + Governance
- [ ] Include disclaimer and methodology footnote.
- [ ] Preserve traceability from each top fix to underlying evidence.
- [ ] Protect sensitive identifiers (redaction for customer names/PII where needed).

## 8) Testing Strategy
- [ ] Snapshot tests for PDF template sections.
- [ ] Metric calculation tests with fixture data.
- [ ] End-to-end generation test from sample run to downloadable PDF.
- [ ] Backward compatibility test for missing optional fields.

## 9) Definition of Done
- [ ] One-click PDF generated from latest run.
- [ ] Contains all required executive sections.
- [ ] Top 10 ROI list + delta + projection validated.
- [ ] Output is stable, shareable, and understandable by non-technical stakeholders.
