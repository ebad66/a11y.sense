import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { makeApiError } from '@/lib/api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      makeApiError('SESSION_NOT_FOUND', 'Session not found or expired.', {
        stage: 'session.fetch',
        retryable: false,
      }),
      { status: 404 }
    );
  }

  return NextResponse.json({
    sessionId: session.sessionId,
    url: session.url,
    pageTitle: session.pageTitle,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    issues: session.issues,
    hasScreenshot: !!session.screenshot,
    screenshotWidth: session.screenshotWidth ?? 1280,
    screenshotHeight: session.screenshotHeight ?? 900,
    elementCoords: session.elementCoords ?? {},
    scanMeta: session.scanMeta,
  });
}
