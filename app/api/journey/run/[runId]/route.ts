import { NextRequest, NextResponse } from 'next/server';
import { getJourneyRun } from '@/lib/journey/store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const run = getJourneyRun(runId);

  if (!run) {
    return NextResponse.json({ error: 'Journey run not found' }, { status: 404 });
  }

  return NextResponse.json(run);
}
