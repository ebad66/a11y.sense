import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { scrapeFromHtml } from '@/lib/scraper';
import { auditAllProfiles } from '@/lib/claude'; // now uses Gemini 2.5 Flash
import { createSession } from '@/lib/session';
import { PROFILES } from '@/lib/profiles';
import { capturePageData } from '@/lib/screenshot';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const normalizedUrl = parsedUrl.toString();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    console.log(`[Scan] Starting scan for: ${normalizedUrl}`);

    // Single Playwright session: get rendered HTML + screenshot together
    let browserResult: Awaited<ReturnType<typeof capturePageData>>;
    try {
      browserResult = await capturePageData(normalizedUrl);
    } catch (err) {
      console.error('[Scan] Browser capture failed:', err);
      return NextResponse.json(
        { error: `Failed to load page: ${(err as Error).message}` },
        { status: 422 }
      );
    }

    console.log(
      `[Scan] Page loaded | HTML: ${browserResult.renderedHtml.length} chars | Screenshot: OK`
    );

    // Parse the rendered HTML
    const page = await scrapeFromHtml(normalizedUrl, browserResult.renderedHtml);

    console.log(`[Scan] Parsed: "${page.title}" | ${page.images.length} images, ${page.links.length} links`);

    // Run Claude audit for all 5 profiles in parallel
    let issues: Record<string, import('@/lib/claude').AccessibilityIssue[]>;
    try {
      issues = await auditAllProfiles(page, PROFILES);
    } catch (err) {
      console.error('[Scan] Claude audit failed:', err);
      return NextResponse.json(
        { error: `Accessibility analysis failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }

    console.log(`[Scan] Audit complete. Profiles: ${Object.keys(issues).join(', ')}`);

    const sessionId = nanoid(12);
    createSession(
      sessionId,
      normalizedUrl,
      page,
      issues,
      browserResult.screenshot.base64,
      browserResult.screenshot.mimeType
    );

    return NextResponse.json({
      sessionId,
      url: normalizedUrl,
      pageTitle: page.title,
      hasScreenshot: true,
      profiles: Object.keys(issues),
      summary: {
        totalIssues: Object.values(issues).flat().filter((i) => i.severity !== 'Pass').length,
        criticalCount: Object.values(issues).flat().filter((i) => i.severity === 'Critical').length,
        warningCount: Object.values(issues).flat().filter((i) => i.severity === 'Warning').length,
      },
    });
  } catch (err) {
    console.error('[Scan] Unexpected error:', err);
    return NextResponse.json(
      { error: `Unexpected error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
