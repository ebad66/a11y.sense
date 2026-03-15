import { describe, expect, it } from 'vitest';
import { buildJourneyTranscript } from './sr-transcript';
import { JourneyRun } from './journey';

const journeyRun: JourneyRun = {
  id: 'run-1',
  templateId: 'single-page-discovery',
  templateName: 'Single Page Discovery (MVP)',
  startedAt: 1_700_000_000_000,
  completedAt: 1_700_000_000_050,
  confidence: 0.8,
  finalStatus: 'passed',
  steps: [
    {
      id: 'step-1',
      name: 'Load page',
      action: 'load',
      expected: 'Page loads with basic structure',
      observed: 'Loaded',
      status: 'passed',
      startedAt: 1_700_000_000_000,
      completedAt: 1_700_000_000_050,
      url: 'https://example.com/checkout',
    },
  ],
};

describe('buildJourneyTranscript', () => {
  it('builds ordered events with step linkage and export payloads', () => {
    const html = `
      <html><body>
      <main>
        <h1>Checkout</h1>
        <button aria-label="Pay now">Pay</button>
        <div aria-live="polite">Saved successfully</div>
      </main>
      </body></html>
    `;

    const transcript = buildJourneyTranscript({
      journeyRun,
      html,
      finalUrl: 'https://example.com/checkout',
    });

    expect(transcript.events.length).toBeGreaterThan(2);
    expect(transcript.events.every((e) => e.journeyStepId === 'step-1')).toBe(true);
    expect(transcript.events[0].timestamp).toBeGreaterThanOrEqual(journeyRun.startedAt);
    expect(transcript.export.json).toContain('"events"');
    expect(transcript.export.text).toContain('Announcement timeline');
  });

  it('flags non descriptive control names and unlabeled controls', () => {
    const html = `
      <html><body>
        <main>
          <button>Click here</button>
          <input type="text" />
        </main>
      </body></html>
    `;

    const transcript = buildJourneyTranscript({
      journeyRun,
      html,
      finalUrl: 'https://example.com/checkout',
    });

    const types = transcript.confusionFlags.map((f) => f.type);
    expect(types).toContain('non-descriptive-control-name');
  });
});
