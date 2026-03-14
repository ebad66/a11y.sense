import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session || !session.screenshot) {
    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  }

  const buffer = Buffer.from(session.screenshot, 'base64');
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': session.screenshotMime || 'image/png',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
