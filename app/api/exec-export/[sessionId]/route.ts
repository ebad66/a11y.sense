import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { addSessionArtifact, getSession } from '@/lib/session';
import { buildExecInputFromIssues, computeExecMetrics, renderExecReportHtml } from '@/lib/exec-report';
import { renderHtmlToPdfBuffer } from '@/lib/pdf';
import { ProfileId } from '@/lib/profiles';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const includeComparison = body?.includeComparison !== false;

    const input = buildExecInputFromIssues({
      sessionId,
      url: session.url,
      pageTitle: session.pageTitle,
      issuesMap: session.issues as Record<ProfileId, import('@/lib/claude').AccessibilityIssue[]>,
      baseline: session.baseline,
      includeComparison,
    });

    const metrics = computeExecMetrics(input);
    const html = renderExecReportHtml(input, metrics);
    const pdfBuffer = await renderHtmlToPdfBuffer(html);

    const artifactId = nanoid(10);
    const dateTag = new Date(input.generatedAt).toISOString().slice(0, 10);
    const fileName = `exec-report-${sessionId}-${dateTag}.pdf`;

    addSessionArtifact(sessionId, {
      artifactId,
      kind: 'exec-pdf',
      fileName,
      createdAt: Date.now(),
      contentType: 'application/pdf',
      dataBase64: pdfBuffer.toString('base64'),
    });

    return NextResponse.json({
      artifactId,
      fileName,
      downloadUrl: `/api/exec-export/${sessionId}/${artifactId}`,
      metrics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to generate exec PDF: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
