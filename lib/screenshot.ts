import { chromium } from 'playwright';

export interface BrowserResult {
  screenshot: {
    base64: string;
    mimeType: 'image/png';
    width: number;
    height: number;
  };
  renderedHtml: string; // fully JS-rendered DOM for Claude to audit
}

export async function capturePageData(url: string): Promise<BrowserResult> {
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

    // Block trackers/ads — faster load, fewer popups
    await page.route('**/*', (route) => {
      const reqUrl = route.request().url();
      if (
        reqUrl.includes('doubleclick') ||
        reqUrl.includes('googlesyndication') ||
        reqUrl.includes('googletagmanager') ||
        reqUrl.includes('analytics') ||
        reqUrl.includes('hotjar') ||
        reqUrl.includes('intercom')
      ) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page
      .goto(url, { waitUntil: 'networkidle', timeout: 20000 })
      .catch(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }));

    // Dismiss cookie banners / GDPR overlays
    await dismissOverlays(page);
    await page.waitForTimeout(600);

    // Grab both screenshot and fully-rendered HTML in one pass
    const [buffer, renderedHtml] = await Promise.all([
      page.screenshot({ type: 'png', fullPage: false }),
      page.content(), // the real JS-rendered DOM
    ]);

    const viewport = page.viewportSize();

    return {
      screenshot: {
        base64: buffer.toString('base64'),
        mimeType: 'image/png',
        width: viewport?.width ?? 1280,
        height: viewport?.height ?? 900,
      },
      renderedHtml,
    };
  } finally {
    await browser.close();
  }
}

// Keep old name as alias so callers don't break
export async function captureScreenshot(url: string) {
  const result = await capturePageData(url);
  return result.screenshot;
}

async function dismissOverlays(page: import('playwright').Page) {
  const dismissTexts = [
    'Accept all', 'Accept All', 'Accept cookies', 'Accept Cookies',
    'I agree', 'I Accept', 'Agree', 'OK', 'Got it',
    'Close', 'Dismiss', 'Allow all', 'Allow All',
  ];

  for (const text of dismissTexts) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(`^${text}$`, 'i') });
      if (await btn.count() > 0) {
        await btn.first().click({ timeout: 1000 });
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      // ignore
    }
  }
}
