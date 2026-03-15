import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { makeApiError } from '@/lib/api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session || !session.screenshot) {
    return NextResponse.json(
      makeApiError('SESSION_NOT_FOUND', 'Screenshot not found for this session.', {
        stage: 'screenshot.fetch',
        retryable: false,
      }),
      { status: 404 }
    );
  }

  const buffer = Buffer.from(session.screenshot, 'base64');
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': session.screenshotMime || 'image/png',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
