export type JourneyStepStatus = 'passed' | 'failed';

export interface JourneyStepResult {
  id: string;
  name: string;
  action: string;
  expected: string;
  observed: string;
  status: JourneyStepStatus;
  startedAt: number;
  completedAt: number;
  url: string;
}

export interface JourneyRun {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: number;
  completedAt: number;
  confidence: number;
  finalStatus: JourneyStepStatus;
  steps: JourneyStepResult[];
}
