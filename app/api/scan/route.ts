import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { scrapeFromHtml } from '@/lib/scraper';
import { auditAllPrinciples } from '@/lib/claude';
import { createSession } from '@/lib/session';
import { WCAG_PRINCIPLES } from '@/lib/wcag';
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

    // Open browser — keep it alive until coords are resolved
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

    const page = await scrapeFromHtml(normalizedUrl, browserResult.renderedHtml);

    console.log(`[Scan] Parsed: "${page.title}" | ${page.images.length} images, ${page.links.length} links`);

    // Run WCAG audit across all four principles in parallel — browser stays open
    let issues: Record<string, import('@/lib/claude').AccessibilityIssue[]>;
    try {
      issues = await auditAllPrinciples(page, WCAG_PRINCIPLES);
    } catch (err) {
      console.error('[Scan] Audit failed:', err);
      await browserResult.close();
      return NextResponse.json(
        { error: `Accessibility analysis failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }

    console.log(`[Scan] Audit complete. Resolving element coordinates...`);

    // Build one coord request per unique key across all issues.
    // Key = selector (preferred) or element snippet — used to look up coords in VisualizeTab.
    const allIssues = Object.values(issues).flat();
    const requestMap = new Map<string, import('@/lib/screenshot').CoordRequest>();
    for (const issue of allIssues) {
      const key = issue.selector || issue.element;
      if (key && !requestMap.has(key)) {
        requestMap.set(key, {
          key,
          selector: issue.selector,
          element:  issue.element,
        });
      }
    }

    // Resolve coordinates while browser is still open — no second launch needed
    let elementCoords: Record<string, import('@/lib/screenshot').ElementBox> = {};
    try {
      if (requestMap.size > 0) {
        const boxes = await browserResult.resolveCoords(Array.from(requestMap.values()));
        for (const box of boxes) {
          if (box.found) elementCoords[box.selector] = box;
        }
        console.log(`[Scan] Coords resolved: ${Object.keys(elementCoords).length}/${requestMap.size} found`);
      }
    } catch (err) {
      console.warn('[Scan] Coord resolution failed (non-fatal):', err);
    }

    // Now close the browser
    await browserResult.close();

    const sessionId = nanoid(12);
    createSession(
      sessionId,
      normalizedUrl,
      page,
      issues,
      browserResult.screenshot.base64,
      browserResult.screenshot.mimeType,
      browserResult.screenshot.width,
      browserResult.screenshot.height,
      elementCoords
    );

    const allIssuesFlat = Object.values(issues).flat();
    return NextResponse.json({
      sessionId,
      url: normalizedUrl,
      pageTitle: page.title,
      hasScreenshot: true,
      principles: Object.keys(issues),
      summary: {
        totalIssues:   allIssuesFlat.filter((i) => i.severity !== 'Pass').length,
        criticalCount: allIssuesFlat.filter((i) => i.severity === 'Critical').length,
        warningCount:  allIssuesFlat.filter((i) => i.severity === 'Warning').length,
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
