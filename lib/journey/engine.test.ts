import { describe, expect, it } from 'vitest';
import { runJourney } from '@/lib/journey/engine';
import { JOURNEY_DEFINITIONS, buildScenario } from '@/lib/journey/templates';

describe('runJourney', () => {
  it('passes checkout template in keyboard-only mode for healthy scenario', () => {
    const definition = JOURNEY_DEFINITIONS.checkout;
    const scenario = buildScenario('checkout');

    const run = runJourney(definition, scenario, 'test-sha');

    expect(run.status).toBe('pass');
    expect(run.successScore).toBe(100);
    expect(run.stepOutcomes.every((step) => step.status === 'pass')).toBe(true);
  });

  it('surfaces human-readable unreachable-control failure', () => {
    const definition = JOURNEY_DEFINITIONS.checkout;
    const scenario = buildScenario('checkout', 'https://shop.example/unreachable-payment');

    const run = runJourney(definition, scenario, 'test-sha');
    const failedStep = run.stepOutcomes.find((step) => step.status === 'fail');

    expect(run.status).toBe('fail');
    expect(failedStep?.taxonomy).toBe('unreachable-control');
    expect(failedStep?.observedBehavior).toContain('Keyboard-only user failed');
    expect(run.blockers[0]?.message).toContain('Keyboard-only user failed');
  });
});
