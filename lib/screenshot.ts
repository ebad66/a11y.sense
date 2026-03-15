import { chromium, Page } from 'playwright';

export interface ElementBox {
  selector: string;
  found: boolean;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export interface CoordRequest {
  /** Canonical key used to store/retrieve the result (selector preferred, else element snippet) */
  key: string;
  /** CSS selector from the AI */
  selector?: string;
  /** Raw HTML snippet from the AI — used to disambiguate when selector matches many elements */
  element?: string;
}

export interface BrowserResult {
  screenshot: {
    base64: string;
    mimeType: 'image/png';
    width: number;
    height: number;
  };
  renderedHtml: string;
  /** Resolve element bounding boxes — call this while the browser is still open, then call close() */
  resolveCoords: (requests: CoordRequest[]) => Promise<ElementBox[]>;
  /** Must be called after resolveCoords to release the browser */
  close: () => Promise<void>;
}

export async function capturePageData(url: string): Promise<BrowserResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

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
    .goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }));

  // Dismiss cookie banners / overlays first
  await dismissOverlays(page);
  await page.waitForTimeout(500);

  // Scroll slowly through the full page to trigger lazy-loaded images/content
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      const total  = document.documentElement.scrollHeight;
      const step   = 400;
      let current  = 0;
      const timer  = setInterval(() => {
        current += step;
        window.scrollTo(0, current);
        if (current >= total) { clearInterval(timer); resolve(); }
      }, 40);
    });
  });

  // Wait for any newly-triggered network requests to settle
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);

  // Wait for web fonts
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  // Scroll back to absolute top and reset any scroll-induced layout shifts
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    // Remove any top margin/padding from fixed banners that may have been dismissed
    document.body.style.paddingTop    = '0';
    document.body.style.marginTop     = '0';
    document.documentElement.style.paddingTop = '0';
    document.documentElement.style.marginTop  = '0';
  });
  await page.waitForTimeout(300);

  const [buffer, renderedHtml, pageMetrics] = await Promise.all([
    page.screenshot({ type: 'png', fullPage: true }),
    page.content(),
    page.evaluate(() => ({
      scrollWidth:  document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    })),
  ]);

  const viewport = page.viewportSize();
  const pageW = pageMetrics.scrollWidth || viewport?.width || 1280;
  const pageH = pageMetrics.scrollHeight || viewport?.height || 900;

  return {
    screenshot: {
      base64: buffer.toString('base64'),
      mimeType: 'image/png',
      width: pageW,
      height: pageH,
    },
    renderedHtml,

    async resolveCoords(requests: CoordRequest[]): Promise<ElementBox[]> {
      // Scroll to top — when scrollY=0, getBoundingClientRect == page-absolute coords
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

      return Promise.all(
        requests.map(async ({ key, selector, element }) => {
          if (!key) return { selector: key, found: false, xPct: 0, yPct: 0, wPct: 0, hPct: 0 };
          try {
            const box = await page.evaluate(
              ({ sel, elHtml }: { sel?: string; elHtml?: string }) => {

                // Score how well an element's outerHTML matches a snippet
                // by counting attribute key=value pairs that appear in both.
                const score = (el: Element, snippet: string): number => {
                  if (!snippet) return 0;
                  const outer   = el.outerHTML.toLowerCase().slice(0, 1200);
                  const snippet_ = snippet.toLowerCase();
                  const attrs    = snippet_.match(/[\w-]+=["'][^"']{0,200}["']/g) ?? [];
                  let s = 0;
                  for (const a of attrs) {
                    if (a.startsWith('class=') || a.startsWith('id=')) {
                      if (outer.includes(a)) s += 4;   // id/class are strong signals
                    } else if (a.length > 6 && outer.includes(a)) {
                      s += 2;
                    }
                  }
                  // Bonus if tag names match
                  const tagM = snippet_.match(/^<([\w-]+)/);
                  if (tagM && el.tagName.toLowerCase() === tagM[1]) s += 1;
                  return s;
                };

                // Build candidate selectors from an HTML snippet
                const candidates = (html: string): string[] => {
                  const tagM = html.match(/^<([\w-]+)/i);
                  if (!tagM) return [];
                  const tag  = tagM[1].toLowerCase();
                  const id   = html.match(/\bid="([^"]+)"/)?.[1];
                  const src  = html.match(/\bsrc="([^"]+)"/)?.[1];
                  const href = html.match(/\bhref="([^"]+)"/)?.[1];
                  const name_ = html.match(/\bname="([^"]+)"/)?.[1];
                  const ph   = html.match(/\bplaceholder="([^"]+)"/)?.[1];
                  const aria = html.match(/\baria-label="([^"]+)"/)?.[1];
                  const altM = html.match(/\balt="([^"]*)"/);
                  const cls  = html.match(/\bclass="([^"]+)"/)?.[1]?.split(/\s+/)[0];
                  const out: string[] = [];
                  if (id)                         out.push(`#${id}`);
                  if (aria)                        out.push(`[aria-label="${aria}"]`);
                  if (src && !src.startsWith('data:')) {
                    const f = src.split('/').pop()?.split('?')[0];
                    if (f) out.push(`${tag}[src*="${f}"]`);
                  }
                  if (href && href.length < 120)  out.push(`${tag}[href="${href}"]`);
                  if (ph)                          out.push(`${tag}[placeholder="${ph}"]`);
                  if (name_)                       out.push(`${tag}[name="${name_}"]`);
                  if (altM && altM[1] === '')      out.push(`${tag}[alt=""]`);
                  if (cls)                         out.push(`${tag}.${cls}`);
                  out.push(tag);
                  return out;
                };

                let found: Element | null = null;

                // ── Strategy 1: try the AI-provided CSS selector ──────────
                if (sel) {
                  // Pre-process selector:
                  // (a) Split comma-separated multi-selectors and try each part individually
                  // (b) Handle :contains("text") which is non-standard — extract text and
                  //     fall back to text-content search instead
                  // Escape unescaped colons inside #id and .class tokens (e.g. Tailwind lg:hidden,
                  // HeadlessUI button#foo-:r2:) so querySelector doesn't treat them as pseudo-classes.
                  const escapeSel = (s: string) =>
                    s.replace(/(#|\.)([\w-]*[^\\]):(?![\w-]*\()/g,
                      (_m: string, prefix: string, before: string) => `${prefix}${before}\\:`);

                  const selectorParts = sel.split(',').map((s: string) => escapeSel(s.trim())).filter(Boolean);

                  for (const part of selectorParts) {
                    // Check if this part uses :contains() — not supported by querySelector
                    const containsMatch = part.match(/:contains\(["']([^"']+)["']\)/);
                    if (containsMatch) {
                      const needle = containsMatch[1].toLowerCase();
                      // Strip :contains() and :has(...:contains(...)) to get a base selector
                      const base = part
                        .replace(/:has\([^)]*:contains\([^)]*\)[^)]*\)/g, '')
                        .replace(/:contains\(["'][^"']*["']\)/g, '')
                        .trim() || '*';
                      try {
                        const candidates_ = Array.from(document.querySelectorAll(base));
                        const match = candidates_.find(
                          (el: Element) => (el.textContent ?? '').toLowerCase().includes(needle)
                        );
                        if (match) { found = match; break; }
                      } catch { /* skip */ }
                      continue;
                    }

                    try {
                      // Force-show hidden elements so getBoundingClientRect works
                      const all = Array.from(document.querySelectorAll(part)) as Element[];
                      // Filter out invisible (display:none / visibility:hidden) but keep 0-opacity
                      const visible = all.filter((el: Element) => {
                        const s = window.getComputedStyle(el);
                        return s.display !== 'none' && s.visibility !== 'hidden';
                      });
                      const pool = visible.length > 0 ? visible : all;
                      if (pool.length === 0) continue;
                      if (pool.length === 1) { found = pool[0]; break; }
                      // Disambiguate
                      let best = pool[0];
                      let bestScore = elHtml ? score(pool[0], elHtml) : 0;
                      for (let i = 1; i < pool.length; i++) {
                        const s = elHtml ? score(pool[i], elHtml) : 0;
                        if (s > bestScore) { bestScore = s; best = pool[i]; }
                      }
                      found = best;
                      break;
                    } catch { /* invalid selector part — try next */ }
                  }
                }

                // ── Strategy 2: build candidates from HTML snippet ────────
                if (!found && elHtml) {
                  for (const cand of candidates(elHtml)) {
                    try {
                      const all = Array.from(document.querySelectorAll(cand));
                      if (all.length === 0) continue;
                      if (all.length === 1) { found = all[0]; break; }
                      // Multiple matches — pick best scoring one
                      let best = all[0];
                      let bestScore = score(all[0], elHtml);
                      for (let i = 1; i < all.length; i++) {
                        const s = score(all[i], elHtml);
                        if (s > bestScore) { bestScore = s; best = all[i]; }
                      }
                      if (bestScore > 0) { found = best; break; }
                    } catch { /* skip invalid candidate */ }
                  }
                }

                if (!found) return null;
                const r = found.getBoundingClientRect();
                // If element has no size (hidden/collapsed), try its first visible child
                if (r.width === 0 && r.height === 0) {
                  const child = found.querySelector('*') as Element | null;
                  if (child) {
                    const cr = child.getBoundingClientRect();
                    if (cr.width > 0 || cr.height > 0) {
                      return {
                        x: cr.left + window.scrollX,
                        y: cr.top  + window.scrollY,
                        width:  cr.width,
                        height: cr.height,
                      };
                    }
                  }
                  return null;
                }
                return {
                  x:      r.left + window.scrollX,
                  y:      r.top  + window.scrollY,
                  width:  r.width,
                  height: r.height,
                };
              },
              { sel: selector, elHtml: element }
            );

            if (box && (box.x >= 0 || box.y >= 0) && (box.width > 0 || box.height > 0)) {
              const cx = Math.min(Math.max(box.x + box.width  / 2, 0), pageW);
              const cy = Math.min(Math.max(box.y + box.height / 2, 0), pageH);
              return {
                selector: key,
                found:    true,
                xPct:  cx / pageW,
                yPct:  cy / pageH,
                wPct:  box.width  / pageW,
                hPct:  box.height / pageH,
              };
            }
          } catch { /* fall through */ }
          return { selector: key, found: false, xPct: 0, yPct: 0, wPct: 0, hPct: 0 };
        })
      );
    },

    async close() {
      await browser.close();
    },
  };
}

// Keep old name as alias so callers don't break
export async function captureScreenshot(url: string) {
  const result = await capturePageData(url);
  try {
    return result.screenshot;
  } finally {
    await result.close();
  }
}

async function dismissOverlays(page: Page) {
  const dismissTexts = [
    'Accept all', 'Accept All', 'Accept cookies', 'Accept Cookies',
    'I agree', 'I Accept', 'Agree', 'OK', 'Got it',
    'Close', 'Dismiss', 'Allow all', 'Allow All',
    'Yes, I agree', 'Continue', 'Reject all', 'Reject All',
    'No thanks', 'Maybe later',
  ];

  for (const text of dismissTexts) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(`^${text}$`, 'i') });
      if (await btn.count() > 0) {
        await btn.first().click({ timeout: 1000 });
        await page.waitForTimeout(400);
      }
    } catch { /* ignore */ }
  }

  // Hide any remaining overlay/modal elements via CSS injection
  await page.addStyleTag({
    content: `
      [class*="cookie"], [class*="consent"], [class*="gdpr"],
      [class*="overlay"], [class*="modal"], [class*="popup"],
      [id*="cookie"], [id*="consent"], [id*="gdpr"],
      [id*="overlay"], [id*="modal"], [id*="popup"] {
        display: none !important;
      }
      body { overflow: visible !important; }
    `,
  }).catch(() => {});
}
