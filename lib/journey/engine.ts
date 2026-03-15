import { randomUUID } from 'node:crypto';
import {
  JourneyControlState,
  JourneyDefinition,
  JourneyFailureTaxonomy,
  JourneyRun,
  JourneyScenario,
  JourneySeverity,
  JourneyStep,
  JourneyStepOutcome,
} from '@/lib/journey/types';

interface RunnerState {
  currentUrl: string;
  focusedIndex: number;
}

export function runJourney(definition: JourneyDefinition, scenario: JourneyScenario, commitSha = 'local-dev'): JourneyRun {
  const startedAt = Date.now();
  const state: RunnerState = {
    currentUrl: scenario.url,
    focusedIndex: -1,
  };

  const stepOutcomes = definition.steps.map((step) => executeStep(step, definition, scenario, state));
  const blockers = stepOutcomes
    .filter((step) => step.status === 'fail')
    .map((step, index) => ({
      stepId: step.stepId,
      message: humanizeFailure(step),
      severity: step.severity,
      rank: index + 1,
    }));

  const criticalWeight = definition.steps.reduce((acc, step) => acc + (step.criticalPath ? 2 : 1), 0);
  const earnedWeight = definition.steps.reduce((acc, step, index) => {
    const weight = step.criticalPath ? 2 : 1;
    return stepOutcomes[index].status === 'pass' ? acc + weight : acc;
  }, 0);

  const successScore = Math.round((earnedWeight / criticalWeight) * 100);

  return {
    runId: randomUUID(),
    journeyId: definition.id,
    mode: 'keyboard-only',
    status: blockers.length === 0 ? 'pass' : 'fail',
    confidence: blockers.length === 0 ? 0.96 : 0.84,
    successScore,
    metadata: {
      timestamp: new Date(startedAt).toISOString(),
      commitSha,
      env: process.env.CI ? 'ci' : 'local',
    },
    blockers,
    stepOutcomes,
    totalDurationMs: Date.now() - startedAt,
  };
}

function executeStep(
  step: JourneyStep,
  definition: JourneyDefinition,
  scenario: JourneyScenario,
  state: RunnerState
): JourneyStepOutcome {
  const startedAt = Date.now();
  const focusBefore = currentFocus(scenario.controlsInTabOrder, state.focusedIndex)?.selector ?? null;
  const urlBefore = state.currentUrl;

  const maybeFailure = performAction(step, scenario.controlsInTabOrder, state);

  const focusAfter = currentFocus(scenario.controlsInTabOrder, state.focusedIndex)?.selector ?? null;
  const urlAfter = state.currentUrl;

  if (maybeFailure) {
    return {
      stepId: step.id,
      stepName: step.name,
      expectedCriterion: step.goal,
      observedBehavior: maybeFailure.message,
      severity: maybeFailure.severity,
      suggestedFix: suggestedFixFor(maybeFailure.taxonomy),
      status: 'fail',
      taxonomy: maybeFailure.taxonomy,
      durationMs: Date.now() - startedAt,
      evidence: {
        domSnapshot: `<main data-journey="${definition.id}" data-step="${step.id}" />`,
        focusBefore,
        focusAfter,
        urlBefore,
        urlAfter,
      },
    };
  }

  for (const assertion of step.assertions) {
    if (assertion.type === 'focus-on' && focusAfter !== assertion.value) {
      return fail(
        step,
        `Keyboard-only user failed at ${step.name}: ${step.selectorRef} is unreachable by ${step.action}.`,
        'unreachable-control',
        focusBefore,
        focusAfter,
        urlBefore,
        urlAfter,
        startedAt,
        definition.id
      );
    }

    if (
      assertion.type === 'focus-visible' &&
      !scenario.controlsInTabOrder.some((control) => control.selector === assertion.value && control.focusVisible)
    ) {
      return fail(step, assertion.message, 'missing-visible-focus', focusBefore, focusAfter, urlBefore, urlAfter, startedAt, definition.id);
    }

    if (assertion.type === 'url-contains' && !urlAfter.includes(assertion.value)) {
      return fail(step, assertion.message, 'unexpected-navigation', focusBefore, focusAfter, urlBefore, urlAfter, startedAt, definition.id);
    }
  }

  return {
    stepId: step.id,
    stepName: step.name,
    expectedCriterion: step.goal,
    observedBehavior: `Action ${step.action} succeeded and assertions passed.`,
    severity: 'info',
    suggestedFix: 'No fix needed.',
    status: 'pass',
    durationMs: Date.now() - startedAt,
    evidence: {
      domSnapshot: `<main data-journey="${definition.id}" data-step="${step.id}" data-status="pass" />`,
      focusBefore,
      focusAfter,
      urlBefore,
      urlAfter,
    },
  };
}

function performAction(
  step: JourneyStep,
  controls: JourneyControlState[],
  state: RunnerState
): { message: string; taxonomy: JourneyFailureTaxonomy; severity: JourneySeverity } | null {
  if (step.action === 'Tab' || step.action === 'Shift+Tab') {
    const direction = step.action === 'Tab' ? 1 : -1;
    let nextIndex = state.focusedIndex + direction;

    while (nextIndex >= 0 && nextIndex < controls.length) {
      if (controls[nextIndex].reachable) {
        state.focusedIndex = nextIndex;
        return null;
      }
      nextIndex += direction;
    }

    return {
      message: `Keyboard-only user failed at ${step.name}: ${step.selectorRef} is unreachable by ${step.action}.`,
      taxonomy: 'unreachable-control',
      severity: 'critical',
    };
  }

  let focused = currentFocus(controls, state.focusedIndex);
  if (!focused) {
    return {
      message: `Keyboard-only user failed at ${step.name}: no focused element before ${step.action}.`,
      taxonomy: 'focus-trap',
      severity: 'critical',
    };
  }

  if (!focused.reachable) {
    return {
      message: `Keyboard-only user failed at ${step.name}: focused control is unreachable.`,
      taxonomy: 'unreachable-control',
      severity: 'critical',
    };
  }

  if (focused.selector !== step.selectorRef) {
    const targetIndex = controls.findIndex((control) => control.selector === step.selectorRef && control.reachable);
    if (targetIndex >= 0) {
      state.focusedIndex = targetIndex;
      focused = controls[targetIndex];
    }
  }

  if (step.action.startsWith('Arrow') && focused.selector !== step.selectorRef) {
    return {
      message: `Keyboard-only user failed at ${step.name}: context moved away from ${step.selectorRef}.`,
      taxonomy: 'context-loss',
      severity: 'warning',
    };
  }

  if (step.action === 'Enter' || step.action === 'Space' || step.action.startsWith('Arrow')) {
    if (focused.nextUrl) {
      state.currentUrl = toAbsoluteUrl(state.currentUrl, focused.nextUrl);
    }
  }

  return null;
}

function toAbsoluteUrl(currentUrl: string, maybeRelative: string): string {
  if (maybeRelative.startsWith('http')) {
    return maybeRelative;
  }

  const current = new URL(currentUrl);
  return `${current.origin}${maybeRelative}`;
}

function currentFocus(controls: JourneyControlState[], index: number): JourneyControlState | null {
  if (index < 0 || index >= controls.length) {
    return null;
  }

  return controls[index];
}

function suggestedFixFor(taxonomy: JourneyFailureTaxonomy): string {
  switch (taxonomy) {
    case 'focus-trap':
      return 'Ensure keyboard users can move focus in and out of modal/dialog containers.';
    case 'unreachable-control':
      return 'Add the control to logical tab order and ensure it is not disabled for keyboard input.';
    case 'missing-visible-focus':
      return 'Restore visible :focus styles with high contrast outlines.';
    case 'context-loss':
      return 'Preserve focus context between related widgets and announce dynamic updates.';
    case 'unexpected-navigation':
      return 'Keep navigation predictable and route users to expected confirmation destinations.';
    default:
      return 'Review keyboard flow for this step.';
  }
}

function humanizeFailure(step: JourneyStepOutcome): string {
  if (step.taxonomy === 'unreachable-control') {
    return `Keyboard-only user failed at ${step.stepName}: ${step.expectedCriterion.toLowerCase()}.`;
  }

  return step.observedBehavior;
}

function fail(
  step: JourneyStep,
  observedBehavior: string,
  taxonomy: JourneyFailureTaxonomy,
  focusBefore: string | null,
  focusAfter: string | null,
  urlBefore: string,
  urlAfter: string,
  startedAt: number,
  journeyId: string
): JourneyStepOutcome {
  return {
    stepId: step.id,
    stepName: step.name,
    expectedCriterion: step.goal,
    observedBehavior,
    severity: taxonomy === 'missing-visible-focus' ? 'warning' : 'critical',
    suggestedFix: suggestedFixFor(taxonomy),
    status: 'fail',
    taxonomy,
    durationMs: Date.now() - startedAt,
    evidence: {
      domSnapshot: `<main data-journey="${journeyId}" data-step="${step.id}" data-status="fail" />`,
      focusBefore,
      focusAfter,
      urlBefore,
      urlAfter,
    },
  };
}
