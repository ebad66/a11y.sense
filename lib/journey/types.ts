export type JourneyTemplateId = 'checkout' | 'signup' | 'book-appointment';

export type KeyboardAction =
  | 'Tab'
  | 'Shift+Tab'
  | 'Enter'
  | 'Space'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Escape';

export type JourneyFailureTaxonomy =
  | 'focus-trap'
  | 'unreachable-control'
  | 'missing-visible-focus'
  | 'context-loss'
  | 'unexpected-navigation';

export type JourneySeverity = 'critical' | 'warning' | 'info';

export interface JourneyAssertion {
  type: 'focus-on' | 'focus-visible' | 'url-contains' | 'no-context-loss';
  value: string;
  message: string;
}

export interface JourneyStep {
  id: string;
  name: string;
  goal: string;
  selectorRef: string;
  action: KeyboardAction;
  criticalPath?: boolean;
  assertions: JourneyAssertion[];
  maxAttempts?: number;
  timeoutMs?: number;
}

export interface JourneyDefinition {
  id: JourneyTemplateId;
  name: string;
  version: string;
  entryUrl: string;
  fallbackWaitMs: number;
  steps: JourneyStep[];
}

export interface JourneyStepOutcome {
  stepId: string;
  stepName: string;
  expectedCriterion: string;
  observedBehavior: string;
  severity: JourneySeverity;
  suggestedFix: string;
  status: 'pass' | 'fail';
  taxonomy?: JourneyFailureTaxonomy;
  durationMs: number;
  evidence: {
    domSnapshot: string;
    focusBefore: string | null;
    focusAfter: string | null;
    urlBefore: string;
    urlAfter: string;
  };
}

export interface JourneyRun {
  runId: string;
  journeyId: JourneyTemplateId;
  mode: 'keyboard-only';
  status: 'pass' | 'fail';
  confidence: number;
  successScore: number;
  metadata: {
    timestamp: string;
    commitSha: string;
    env: 'local' | 'ci';
  };
  blockers: Array<{
    stepId: string;
    message: string;
    severity: JourneySeverity;
    rank: number;
  }>;
  stepOutcomes: JourneyStepOutcome[];
  totalDurationMs: number;
}

export interface JourneyRunRequest {
  templateId: JourneyTemplateId;
  mode: 'keyboard-only';
  targetUrl?: string;
}

export interface JourneyControlState {
  id: string;
  selector: string;
  reachable: boolean;
  focusVisible: boolean;
  nextUrl?: string;
}

export interface JourneyScenario {
  templateId: JourneyTemplateId;
  url: string;
  controlsInTabOrder: JourneyControlState[];
}
