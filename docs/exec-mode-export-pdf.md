# Exec Mode Export (Board-Ready PDF) - MVP

## What shipped

- One-click **Exec PDF** action in `/scan/[sessionId]` header.
- Deterministic input contract and metric engine in `lib/exec-report.ts`.
- Server pipeline:
  1. Build `ExecReportInput` from session findings + baseline
  2. Compute deterministic `ExecMetrics`
  3. Render locked HTML template with required board sections
  4. Convert HTML -> PDF (Playwright)
  5. Save artifact in in-memory run history and expose download URL
- Download endpoint for current and retained artifacts.

## API

### Generate

`POST /api/exec-export/:sessionId`

Body:

```json
{ "includeComparison": true }
```

Response:

```json
{
  "artifactId": "abc123",
  "fileName": "exec-report-....pdf",
  "downloadUrl": "/api/exec-export/:sessionId/:artifactId",
  "metrics": { "riskTier": "High", "...": "..." }
}
```

### Download

`GET /api/exec-export/:sessionId/:artifactId`

Returns PDF bytes with `Content-Disposition: attachment`.

## Required sections included

- Title block (org/project/environment/date/scan version)
- Risk tier + rationale
- Compliance exposure snapshot
- Customer impact summary
- Velocity impact summary
- Top 10 ROI fixes
- Progress delta vs last scan
- Projected risk reduction
- Methodology/disclaimer + confidence caveat
- Embedded metadata line: run ID + commit SHA + generated timestamp

## Notes / constraints

- Artifact retention is in-memory per session (up to 10 exec PDF artifacts per session).
- Baseline for delta is the previous scan for the same URL while server memory remains warm.
- This is MVP and intentionally deterministic; no generative narrative text is required for section generation.
