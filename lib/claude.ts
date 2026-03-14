import { GoogleGenAI } from '@google/genai';
import { Profile } from './profiles';
import { ScrapedPage, buildPageSummary } from './scraper';

export interface AccessibilityIssue {
  severity: 'Critical' | 'Warning' | 'Pass';
  title: string;
  description: string;
  fix: string;
  element?: string;   // human-readable HTML snippet
  selector?: string;  // machine-usable CSS selector for DOM querying
  wcag?: string;
}

const MODEL = 'gemini-2.5-flash';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

export async function auditPageForProfile(
  page: ScrapedPage,
  profile: Profile
): Promise<AccessibilityIssue[]> {
  const pageSummary = buildPageSummary(page);

  const prompt = `You are a certified WCAG 2.1 accessibility expert auditing a webpage for ${profile.label} users (${profile.description}).

${profile.claudeFocus}

Return ONLY a valid JSON array of issues. No markdown, no explanation, no text outside the JSON array.

Each object must have:
- "severity": "Critical" | "Warning" | "Pass"
- "title": string (max 60 chars)
- "description": string (2-3 sentences on impact for ${profile.label} users)
- "fix": string (specific, actionable recommendation or code snippet)
- "element": string (REQUIRED for any Critical or Warning — the actual HTML snippet of the broken element, e.g. '<img src="/hero.jpg" alt="">' or '<button class="nav-btn">Menu</button>')
- "selector": string (REQUIRED for any Critical or Warning — a CSS selector that uniquely identifies THIS SPECIFIC element, not a generic tag. Use attribute combinations: 'img[src*="hero"]', 'input[name="email"]', 'button[aria-label="Close menu"]', 'video:not([track])', 'a[href="/about"][class*="nav"]'. NEVER return a bare tag like 'img', 'a', 'p', 'div', 'button', 'h1' alone — always combine with at least one attribute, class, id, or pseudo-class so it targets exactly the broken element.)
- "wcag": string (optional — e.g. "1.1.1 Non-text Content")

Critical = completely blocks access. Warning = significantly impairs. Pass = done correctly (include 1-2).
Aim for 6-12 items. Reference actual elements from the HTML.

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
    console.error(`[Audit:${profile.id}] No JSON array in response:`, text.slice(0, 200));
    return getDefaultIssues(profile);
  }

  try {
    const issues: AccessibilityIssue[] = JSON.parse(jsonMatch[0]);
    return issues
      .filter((i) => i && typeof i === 'object' && i.severity && i.title && i.description && i.fix)
      .map((i) => ({
        severity: (['Critical', 'Warning', 'Pass'] as const).includes(i.severity as never)
          ? i.severity
          : 'Warning',
        title: String(i.title).slice(0, 120),
        description: String(i.description),
        fix: String(i.fix),
        element: i.element ? String(i.element) : undefined,
        selector: i.selector ? String(i.selector) : undefined,
        wcag: i.wcag ? String(i.wcag) : undefined,
      }));
  } catch (e) {
    console.error(`[Audit:${profile.id}] JSON parse failed:`, e);
    return getDefaultIssues(profile);
  }
}

export async function auditAllProfiles(
  page: ScrapedPage,
  profiles: Profile[]
): Promise<Record<string, AccessibilityIssue[]>> {
  const results = await Promise.allSettled(
    profiles.map(async (profile) => ({
      id: profile.id,
      issues: await auditPageForProfile(page, profile),
    }))
  );

  const output: Record<string, AccessibilityIssue[]> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      output[result.value.id] = result.value.issues;
    } else {
      console.error('[Audit] Profile failed:', result.reason);
    }
  }
  return output;
}

function getDefaultIssues(profile: Profile): AccessibilityIssue[] {
  return [
    {
      severity: 'Warning',
      title: 'Analysis incomplete',
      description: `The automated analysis for ${profile.label} users could not be completed for this page.`,
      fix: 'Try re-running the scan or manually review the page with an accessibility testing tool.',
    },
  ];
}
