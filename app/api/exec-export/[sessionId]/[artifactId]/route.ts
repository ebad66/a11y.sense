import { NextRequest, NextResponse } from 'next/server';
import { getSessionArtifact } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; artifactId: string }> }
) {
  const { sessionId, artifactId } = await params;
  const artifact = getSessionArtifact(sessionId, artifactId);

  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  const buffer = Buffer.from(artifact.dataBase64, 'base64');
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': artifact.contentType,
      'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
      'Cache-Control': 'private, max-age=600',
    },
  });
}
