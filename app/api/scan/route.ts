import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { scrapeFromHtml } from '@/lib/scraper';
import { auditAllPrinciples, AccessibilityIssue } from '@/lib/claude';
import { createSession } from '@/lib/session';
import { WCAG_PRINCIPLES } from '@/lib/wcag';
import { capturePageData, CoordRequest, ElementBox } from '@/lib/screenshot';
import { makeApiError } from '@/lib/api';
import { validateAndNormalizeUrl } from '@/lib/url';

export const maxDuration = 120;

const CAPTURE_TIMEOUT_MS = 45_000;
const AUDIT_TIMEOUT_MS = 55_000;
const COORDS_TIMEOUT_MS = 18_000;

export async function POST(req: NextRequest) {
  const requestId = nanoid(10);
  const stageTimingsMs: Record<string, number> = {};
  const completedStages: string[] = [];
  const failedStages: string[] = [];
  const warnings: string[] = [];

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      makeApiError('BAD_REQUEST', 'Request body must be valid JSON.', {
        stage: 'scan.validate',
        retryable: false,
      }),
      { status: 400 }
    );
  }

  const validation = validateAndNormalizeUrl((body as { url?: unknown })?.url);
  if (!validation.ok) {
    const status = validation.code === 'BAD_REQUEST' ? 400 : 422;
    return NextResponse.json(
      makeApiError(validation.code, validation.message, {
        stage: 'scan.validate',
        retryable: false,
      }),
      { status }
    );
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      makeApiError('MISSING_CONFIG', 'GEMINI_API_KEY is not configured.', {
        stage: 'scan.config',
        retryable: false,
      }),
      { status: 500 }
    );
  }

  const normalizedUrl = validation.normalizedUrl;
  let browserResult: Awaited<ReturnType<typeof capturePageData>> | null = null;

  try {
    const captureResult = await timed('capture', stageTimingsMs, () =>
      withTimeout(capturePageData(normalizedUrl), CAPTURE_TIMEOUT_MS, 'capture')
    );
    browserResult = captureResult;
    completedStages.push('capture');

    const page = await timed('parse', stageTimingsMs, () =>
      withTimeout(
        scrapeFromHtml(normalizedUrl, captureResult.renderedHtml),
        8_000,
        'parse'
      )
    );
    completedStages.push('parse');

    const auditResult = await timed('audit', stageTimingsMs, () =>
      withTimeout(auditAllPrinciples(page, WCAG_PRINCIPLES), AUDIT_TIMEOUT_MS, 'audit')
    );
    completedStages.push('audit');

    warnings.push(...auditResult.meta.warnings);

    const issues = auditResult.issuesByPrinciple;
    const requestMap = buildCoordRequestMap(Object.values(issues).flat());

    const elementCoords: Record<string, ElementBox> = {};
    if (requestMap.size > 0) {
      try {
        const boxes = await timed('coords', stageTimingsMs, () =>
          withTimeout(
            captureResult.resolveCoords(Array.from(requestMap.values())),
            COORDS_TIMEOUT_MS,
            'coords'
          )
        );

        for (const box of boxes) {
          if (box.found) {
            elementCoords[box.selector] = box;
          }
        }

        const foundCount = Object.keys(elementCoords).length;
        if (foundCount < requestMap.size) {
          warnings.push(
            `Only ${foundCount}/${requestMap.size} issue locations were mapped precisely on the screenshot.`
          );
        }
        completedStages.push('coords');
      } catch (error) {
        failedStages.push('coords');
        warnings.push(`Coordinate mapping was partially skipped: ${(error as Error).message}`);
      }
    } else {
      completedStages.push('coords');
      stageTimingsMs.coords = 0;
    }

    const sessionId = nanoid(12);
    createSession(
      sessionId,
      normalizedUrl,
      page,
      issues,
      captureResult.screenshot.base64,
      captureResult.screenshot.mimeType,
      captureResult.screenshot.width,
      captureResult.screenshot.height,
      elementCoords,
      {
        partial:
          warnings.length > 0 ||
          failedStages.length > 0 ||
          auditResult.meta.partial,
        warnings,
        completedStages,
        failedStages,
        stageTimingsMs,
        principleStatus: auditResult.meta.principleStatus,
      }
    );

    const allIssuesFlat = dedupeIssues(Object.values(issues).flat());

    return NextResponse.json({
      sessionId,
      requestId,
      url: normalizedUrl,
      pageTitle: page.title,
      hasScreenshot: Boolean(captureResult.screenshot.base64),
      principles: Object.keys(issues),
      summary: {
        totalIssues: allIssuesFlat.filter((issue) => issue.severity !== 'Pass').length,
        criticalCount: allIssuesFlat.filter((issue) => issue.severity === 'Critical').length,
        warningCount: allIssuesFlat.filter((issue) => issue.severity === 'Warning').length,
      },
      scanMeta: {
        partial:
          warnings.length > 0 ||
          failedStages.length > 0 ||
          auditResult.meta.partial,
        warnings,
        completedStages,
        failedStages,
        stageTimingsMs,
        principleStatus: auditResult.meta.principleStatus,
      },
    });
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[Scan] request=${requestId} failed:`, error);

    if (message.startsWith('capture timeout')) {
      return NextResponse.json(
        makeApiError('SCAN_TIMEOUT', 'Timed out while capturing the target page.', {
          stage: 'capture',
          retryable: true,
        }),
        { status: 504 }
      );
    }

    if (message.startsWith('audit timeout')) {
      return NextResponse.json(
        makeApiError('SCAN_TIMEOUT', 'Timed out while running accessibility analysis.', {
          stage: 'audit',
          retryable: true,
        }),
        { status: 504 }
      );
    }

    if (message.startsWith('parse timeout')) {
      return NextResponse.json(
        makeApiError('SCAN_PARSE_FAILED', 'Failed to parse rendered page content.', {
          stage: 'parse',
          retryable: true,
        }),
        { status: 500 }
      );
    }

    if (completedStages.includes('capture') && !completedStages.includes('audit')) {
      return NextResponse.json(
        makeApiError('SCAN_AUDIT_FAILED', `Accessibility analysis failed: ${message}`, {
          stage: 'audit',
          retryable: true,
        }),
        { status: 502 }
      );
    }

    if (!completedStages.includes('capture')) {
      return NextResponse.json(
        makeApiError('SCAN_CAPTURE_FAILED', `Failed to load page: ${message}`, {
          stage: 'capture',
          retryable: true,
        }),
        { status: 422 }
      );
    }

    return NextResponse.json(
      makeApiError('SCAN_UNEXPECTED', `Unexpected scan error: ${message}`, {
        stage: 'scan',
        retryable: true,
      }),
      { status: 500 }
    );
  } finally {
    if (browserResult) {
      await browserResult.close().catch(() => {});
    }
  }
}

function buildCoordRequestMap(issues: AccessibilityIssue[]) {
  const requestMap = new Map<string, CoordRequest>();
  for (const issue of issues) {
    const key = issue.selector || issue.element;
    if (!key || requestMap.has(key)) continue;

    requestMap.set(key, {
      key,
      selector: issue.selector,
      element: issue.element,
    });
  }
  return requestMap;
}

function dedupeIssues(issues: AccessibilityIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.wcag || ''}:${issue.selector || issue.element || issue.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function timed<T>(
  label: string,
  timings: Record<string, number>,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  const result = await fn();
  timings[label] = Date.now() - startedAt;
  return result;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${stage} timeout`)), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
