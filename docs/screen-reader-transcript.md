# Screen-reader Simulation Transcript (MVP)

This feature adds a journey-linked screen-reader transcript for each scan session.

## What is generated

For each journey run (currently `single-page-discovery`):

- Ordered `TranscriptEvent` timeline containing:
  - role
  - accessible name
  - state/value (with light redaction)
  - landmark context
  - live region announcements
- `ConfusionFlag` list with remediation tips:
  - duplicate labels
  - context loss after route change
  - focus jump without explanation
  - non-descriptive control names
- Two views:
  - Plain-English (stakeholder-friendly)
  - Technical (raw accessibility semantics)
- Export payloads:
  - JSON (`transcript.export.json`)
  - text (`transcript.export.text`)

## Data model

- `lib/journey.ts`: `JourneyRun`, `JourneyStepResult`
- `lib/sr-transcript.ts`: `TranscriptEvent`, `ConfusionFlag`, `JourneyTranscript`
- `lib/session.ts`: stores `journeyRun` and `transcript` per scan session

## UI integration

On `/scan/[sessionId]`, a new transcript panel appears below the visualizer:

- Plain/Technical toggle
- Top confusion moments summary
- Step-linked timeline cards (`journeyStepId` shown on each event)
- Export buttons for JSON and text downloads

## Notes / limits

- MVP uses DOM snapshot heuristics, not full native AT parity.
- Transcript is generated from the captured rendered HTML at scan time.
- Journey support is currently one-step (`single-page-discovery`) and can be expanded for full task journeys.
