import { NextRequest, NextResponse } from 'next/server';
import { JOURNEY_DEFINITIONS, buildScenario } from '@/lib/journey/templates';
import { runJourney } from '@/lib/journey/engine';
import { JourneyRunRequest } from '@/lib/journey/types';
import { listJourneyRuns, saveJourneyRun } from '@/lib/journey/store';

function getCommitSha(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'local-dev';
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<JourneyRunRequest>;

    if (!body.templateId || !JOURNEY_DEFINITIONS[body.templateId]) {
      return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
    }

    if (body.mode !== 'keyboard-only') {
      return NextResponse.json({ error: 'Only keyboard-only mode is currently supported.' }, { status: 400 });
    }

    const definition = JOURNEY_DEFINITIONS[body.templateId];
    const scenario = buildScenario(body.templateId, body.targetUrl);
    const run = runJourney(definition, scenario, getCommitSha());

    saveJourneyRun(run);

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to run journey: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ runs: listJourneyRuns() });
}
