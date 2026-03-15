import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { chromium } from 'playwright';
import { makeApiError } from '@/lib/api';

export const maxDuration = 60;

const MAX_COORD_ELEMENTS = 60;
const MAX_ELEMENT_LENGTH = 700;

/** Convert an element string (HTML snippet or CSS selector) into candidate CSS selectors */
function toCandidates(element: string): string[] {
  const s = element.trim();
  if (!s) return [];

  // Not HTML — try as a CSS selector directly
  if (!s.startsWith('<')) return [s];

  const candidates: string[] = [];
  const tagMatch = s.match(/^<([\w-]+)/);
  if (!tagMatch) return [];
  const tag = tagMatch[1].toLowerCase();

  const id = s.match(/\bid="([^"]+)"/)?.[1];
  const cls = s.match(/\bclass="([^"]+)"/)?.[1];
  const src = s.match(/\bsrc="([^"]+)"/)?.[1];
  const href = s.match(/\bhref="([^"]+)"/)?.[1];
  const type = s.match(/\btype="([^"]+)"/)?.[1];
  const name = s.match(/\bname="([^"]+)"/)?.[1];
  const altAttr = s.match(/\balt="([^"]*)"/);

  if (id) candidates.push(`#${id}`);

  if (cls) {
    const first = cls.split(/\s+/)[0];
    candidates.push(`${tag}.${first}`);
    candidates.push(`.${first}`);
  }

  if (src && !src.startsWith('data:')) {
    const filename = src.split('/').pop()?.split('?')[0];
    if (filename) candidates.push(`${tag}[src*="${filename}"]`);
  }

  if (href) candidates.push(`${tag}[href="${href}"]`);
  if (type) candidates.push(`${tag}[type="${type}"]`);
  if (name) candidates.push(`${tag}[name="${name}"]`);
  if (altAttr && altAttr[1] === '') candidates.push(`${tag}[alt=""]`);

  // Last resort: first occurrence of the tag
  candidates.push(tag);

  return candidates;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      makeApiError('SESSION_NOT_FOUND', 'Session not found.', {
        stage: 'coords.session',
        retryable: false,
      }),
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      makeApiError('BAD_REQUEST', 'Request body must be valid JSON.', {
        stage: 'coords.validate',
        retryable: false,
      }),
      { status: 400 }
    );
  }

  const elements = Array.isArray((body as { elements?: unknown[] }).elements)
    ? ((body as { elements: unknown[] }).elements as unknown[])
    : null;

  if (!elements) {
    return NextResponse.json(
      makeApiError('BAD_REQUEST', 'Body must include an elements array.', {
        stage: 'coords.validate',
        retryable: false,
      }),
      { status: 400 }
    );
  }

  if (elements.length > MAX_COORD_ELEMENTS) {
    return NextResponse.json(
      makeApiError(
        'BAD_REQUEST',
        `Too many elements requested. Maximum is ${MAX_COORD_ELEMENTS} per request.`,
        {
          stage: 'coords.validate',
          retryable: false,
        }
      ),
      { status: 400 }
    );
  }

  const normalizedElements = elements.map((entry) => {
    if (typeof entry !== 'string') return '';
    return entry.slice(0, MAX_ELEMENT_LENGTH);
  });

  if (normalizedElements.length === 0) {
    return NextResponse.json({ coords: [], pageW: 0, pageH: 0 });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    await page
      .goto(session.url, { waitUntil: 'networkidle', timeout: 20000 })
      .catch(() => page.goto(session.url, { waitUntil: 'domcontentloaded', timeout: 15000 }));

    // Full page dimensions
    const pageDims = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
    }));

    // Resolve bounding boxes for each element string
    const coords = await Promise.all(
      normalizedElements.map(async (element, i) => {
        if (!element) return { index: i, found: false, xPct: 0.5, yPct: 0.1 };

        for (const selector of toCandidates(element)) {
          try {
            const box = await page.locator(selector).first().boundingBox({ timeout: 2000 });
            if (box) {
              return {
                index: i,
                found: true,
                xPct: (box.x + box.width / 2) / pageDims.w,
                yPct: (box.y + box.height / 2) / pageDims.h,
                wPct: box.width / pageDims.w,
                hPct: box.height / pageDims.h,
                selector,
              };
            }
          } catch {
            // try next candidate
          }
        }

        return { index: i, found: false, xPct: 0.5, yPct: 0.1 };
      })
    );

    return NextResponse.json({ coords, pageW: pageDims.w, pageH: pageDims.h });
  } finally {
    await browser.close();
  }
}
