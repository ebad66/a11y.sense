# Task-based Journey Testing (MVP)

This feature adds a deterministic, keyboard-only journey runner for three starter templates:

- `checkout`
- `signup`
- `book-appointment`

## API

### Start a run

`POST /api/journey/run`

```json
{
  "templateId": "checkout",
  "mode": "keyboard-only",
  "targetUrl": "https://shop.example/unreachable-payment"
}
```

`targetUrl` is optional. In this MVP, specific keywords in `targetUrl` can trigger deterministic failure fixtures:

- `unreachable-payment`
- `missing-focus`
- `context-loss`
- `unexpected-nav`

### Run history

`GET /api/journey/run`

Returns the latest journey runs in reverse chronological order.

### Run status/details

`GET /api/journey/run/:runId`

Returns full run payload including step outcomes and evidence snapshots.

## Data model

Core types are in `lib/journey/types.ts`:

- `JourneyDefinition`
- `JourneyRun`
- `JourneyFailureTaxonomy`
- `JourneyStepOutcome`

## UI

A new section on the home page (`JourneyTester`) lets you:

1. Choose a template
2. Run in keyboard-only mode
3. Review run history and timeline
4. See blockers with business-outcome framing

## Troubleshooting

- **400 Invalid templateId**: use `checkout`, `signup`, or `book-appointment`.
- **400 keyboard-only mode**: `mode` must be exactly `keyboard-only` for MVP.
- **No runs in history**: run data is stored in-memory and resets on server restart.
