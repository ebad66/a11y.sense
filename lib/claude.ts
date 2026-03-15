import { GoogleGenAI } from '@google/genai';
import { WcagPrinciple } from './wcag';
import { ScrapedPage, buildPageSummary } from './scraper';

export interface AccessibilityIssue {
  severity: 'Critical' | 'Warning' | 'Pass';
  title: string;
  description: string;
  fix: string;
  element?: string;   // human-readable HTML snippet of the affected element
  selector?: string;  // machine-usable CSS selector for DOM querying
  wcag?: string;      // e.g. "1.1.1 Non-text Content"
}

const MODEL = 'gemini-2.5-flash';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

/**
 * Audit a page for a single WCAG principle.
 * Returns a list of AccessibilityIssue objects categorised under that principle.
 */
export async function auditPageForPrinciple(
  page: ScrapedPage,
  principle: WcagPrinciple
): Promise<AccessibilityIssue[]> {
  const pageSummary = buildPageSummary(page);

  const prompt = `You are a certified WCAG 2.1 accessibility auditor.
${principle.auditFocus}

Return ONLY a valid JSON array of issues found under this principle. No markdown, no explanation, no text outside the JSON array.

Each object must have:
- "severity": "Critical" | "Warning" | "Pass"
- "title": string (max 60 chars — specific, names the exact issue)
- "description": string (2-3 sentences on what the problem is and who it impacts)
- "fix": string (specific, actionable recommendation or corrected code snippet)
- "element": string (REQUIRED for Critical or Warning — the actual HTML snippet of the broken element, e.g. '<img src="/hero.jpg" alt="">' or '<button class="nav-btn">Menu</button>')
- "selector": string (REQUIRED for Critical or Warning — a CSS selector that uniquely identifies THIS SPECIFIC element. Use attribute combinations: 'img[src*="hero"]', 'input[name="email"]', 'button[aria-label="Close menu"]'. NEVER return a bare tag like 'img', 'a', 'div', 'button' alone — always combine with at least one attribute, class, id, or pseudo-selector so it targets exactly the broken element.)
- "wcag": string (REQUIRED — the specific WCAG success criterion number and name, e.g. "1.1.1 Non-text Content", "2.4.7 Focus Visible")

Severity rules:
- Critical = completely blocks access for affected users (fails a Level A or AA criterion outright)
- Warning = significantly impairs usability but does not completely block (partial failure or best-practice gap)
- Pass = a check relevant to this principle that the page does correctly (include 1-3 passes to show what works)

Aim for 4-10 issues total. Reference actual elements from the HTML below.

=== PAGE SUMMARY ===
${pageSummary}

=== PAGE HTML (condensed) ===
${page.condensedHtml}`;

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  const text = (response.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(`[Audit:${principle.id}] No JSON array in response:`, text.slice(0, 200));
    return getDefaultIssues(principle);
  }

  try {
    const issues: AccessibilityIssue[] = JSON.parse(jsonMatch[0]);
    return issues
      .filter((i) => i && typeof i === 'object' && i.severity && i.title && i.description && i.fix)
      .map((i) => ({
        severity: (['Critical', 'Warning', 'Pass'] as const).includes(i.severity as never)
          ? i.severity
          : 'Warning',
        title:       String(i.title).slice(0, 120),
        description: String(i.description),
        fix:         String(i.fix),
        element:     i.element  ? String(i.element)  : undefined,
        selector:    i.selector ? String(i.selector) : undefined,
        wcag:        i.wcag     ? String(i.wcag)     : undefined,
      }));
  } catch (e) {
    console.error(`[Audit:${principle.id}] JSON parse failed:`, e);
    return getDefaultIssues(principle);
  }
}

/**
 * Audit a page against all four WCAG principles in parallel.
 * Returns a map of principleId → issues.
 */
export async function auditAllPrinciples(
  page: ScrapedPage,
  principles: WcagPrinciple[]
): Promise<Record<string, AccessibilityIssue[]>> {
  const results = await Promise.allSettled(
    principles.map(async (principle) => ({
      id: principle.id,
      issues: await auditPageForPrinciple(page, principle),
    }))
  );

  const output: Record<string, AccessibilityIssue[]> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      output[result.value.id] = result.value.issues;
    } else {
      console.error('[Audit] Principle failed:', result.reason);
    }
  }
  return output;
}

function getDefaultIssues(principle: WcagPrinciple): AccessibilityIssue[] {
  return [
    {
      severity: 'Warning',
      title: 'Analysis incomplete',
      description: `The automated analysis for the ${principle.label} principle could not be completed for this page.`,
      fix: 'Try re-running the scan or manually review the page with an accessibility testing tool such as axe or WAVE.',
    },
  ];
}
