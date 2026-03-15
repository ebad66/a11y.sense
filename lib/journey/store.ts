import { JourneyRun } from '@/lib/journey/types';

const g = global as typeof global & {
  _journeyRuns?: Map<string, JourneyRun>;
};

if (!g._journeyRuns) {
  g._journeyRuns = new Map<string, JourneyRun>();
}

const journeyRuns = g._journeyRuns;

export function saveJourneyRun(run: JourneyRun) {
  journeyRuns.set(run.runId, run);
}

export function getJourneyRun(runId: string): JourneyRun | null {
  return journeyRuns.get(runId) ?? null;
}

export function listJourneyRuns(limit = 20): JourneyRun[] {
  return Array.from(journeyRuns.values())
    .sort((a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime())
    .slice(0, limit);
}
