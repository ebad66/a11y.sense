import { GoogleGenAI } from '@google/genai';
import { ScrapedPage, buildPageSummary } from './scraper';
import { WcagPrinciple, WcagPrincipleId } from './wcag';

export interface AccessibilityIssue {
  severity: 'Critical' | 'Warning' | 'Pass';
  title: string;
  description: string;
  fix: string;
  element?: string;
  selector?: string;
  wcag?: string;
  confidence?: 'High' | 'Medium' | 'Low';
  effort?: 'Low' | 'Medium' | 'High';
  rationale?: string;
  affectedUsers?: string[];
}

export interface AuditRunMeta {
  partial: boolean;
  warnings: string[];
  principleStatus: Record<WcagPrincipleId, 'ok' | 'fallback'>;
}

export interface AuditRunResult {
  issuesByPrinciple: Record<WcagPrincipleId, AccessibilityIssue[]>;
  meta: AuditRunMeta;
}

const MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 2;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 120_000 } });
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
- "title": string (max 80 chars — specific, names the exact issue)
- "description": string (2-3 sentences on what the problem is and who it impacts)
- "fix": string (specific, actionable recommendation or corrected code snippet)
- "element": string (REQUIRED for Critical or Warning when possible — HTML snippet of the affected element)
- "selector": string (REQUIRED for Critical or Warning when possible — CSS selector for this specific element)
- "wcag": string (REQUIRED — the specific WCAG success criterion number and name)
- "confidence": "High" | "Medium" | "Low" (how confident this finding is based on available evidence)
- "effort": "Low" | "Medium" | "High" (estimated implementation effort)
- "rationale": string (one sentence: why this issue should be prioritized)
- "affectedUsers": string[] (1-3 groups, e.g. ["screen reader users", "keyboard-only users"])

Severity rules:
- Critical = completely blocks access for affected users (fails a Level A or AA criterion outright)
- Warning = significantly impairs usability but does not completely block
- Pass = a relevant check that the page appears to satisfy

Important:
- Include 4-12 findings total.
- Include 1-3 passes where applicable.
- Do not fabricate certainty. Use lower confidence when evidence is incomplete.
- Prefer concrete, developer-usable fixes.

=== PAGE SUMMARY ===
${pageSummary}

=== PAGE HTML (condensed) ===
${page.condensedHtml}`;

  const ai = getClient();
  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    MAX_RETRIES,
    `[Audit:${principle.id}]`
  );

  const text = (response.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(`[Audit:${principle.id}] No JSON array in response:`, text.slice(0, 200));
    return getDefaultIssues(principle, 'Model returned an invalid response format.');
  }

  try {
    const issues = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(issues)) {
      return getDefaultIssues(principle, 'Model response payload was not an array.');
    }

    const normalized = issues
      .filter((issue) => issue && typeof issue === 'object')
      .map((issue) => normalizeIssue(issue as Partial<AccessibilityIssue>))
      .filter((issue): issue is AccessibilityIssue => Boolean(issue));

    if (normalized.length === 0) {
      return getDefaultIssues(principle, 'No valid issues were returned by the model.');
    }

    return normalized;
  } catch (error) {
    console.error(`[Audit:${principle.id}] JSON parse failed:`, error);
    return getDefaultIssues(principle, 'Could not parse model output as JSON.');
  }
}

/**
 * Audit a page against all WCAG principles in parallel.
 * Always returns every principle key; failed principles receive a fallback issue.
 */
export async function auditAllPrinciples(
  page: ScrapedPage,
  principles: WcagPrinciple[]
): Promise<AuditRunResult> {
  const issuesByPrinciple = {} as Record<WcagPrincipleId, AccessibilityIssue[]>;
  const warnings: string[] = [];
  const principleStatus = {} as Record<WcagPrincipleId, 'ok' | 'fallback'>;

  const results = await Promise.allSettled(
    principles.map(async (principle) => ({
      id: principle.id,
      issues: await auditPageForPrinciple(page, principle),
    }))
  );

  for (const [index, result] of results.entries()) {
    const principle = principles[index];

    if (result.status === 'fulfilled') {
      issuesByPrinciple[result.value.id as WcagPrincipleId] = result.value.issues;
      principleStatus[result.value.id as WcagPrincipleId] = hasFallbackIssue(result.value.issues)
        ? 'fallback'
        : 'ok';
      if (hasFallbackIssue(result.value.issues)) {
        warnings.push(`${principle.label}: analysis incomplete`);
      }
      continue;
    }

    console.error(`[Audit] Principle failed (${principle.id}):`, result.reason);
    issuesByPrinciple[principle.id] = getDefaultIssues(
      principle,
      'The model request failed for this principle.'
    );
    principleStatus[principle.id] = 'fallback';
    warnings.push(`${principle.label}: model request failed`);
  }

  return {
    issuesByPrinciple,
    meta: {
      partial: warnings.length > 0,
      warnings,
      principleStatus,
    },
  };
}

function normalizeIssue(issue: Partial<AccessibilityIssue>): AccessibilityIssue | null {
  if (!issue.severity || !issue.title || !issue.description || !issue.fix) {
    return null;
  }

  const severity = (['Critical', 'Warning', 'Pass'] as const).includes(issue.severity as never)
    ? issue.severity
    : 'Warning';

  const confidence = (['High', 'Medium', 'Low'] as const).includes(issue.confidence as never)
    ? issue.confidence
    : inferConfidence(issue);

  const effort = (['Low', 'Medium', 'High'] as const).includes(issue.effort as never)
    ? issue.effort
    : inferEffort(issue.fix);

  const normalized: AccessibilityIssue = {
    severity,
    title: String(issue.title).slice(0, 120),
    description: String(issue.description),
    fix: String(issue.fix),
    element: issue.element ? String(issue.element).slice(0, 600) : undefined,
    selector: issue.selector ? String(issue.selector).slice(0, 240) : undefined,
    wcag: issue.wcag ? String(issue.wcag).slice(0, 120) : undefined,
    confidence,
    effort,
    rationale: issue.rationale ? String(issue.rationale).slice(0, 240) : undefined,
    affectedUsers: Array.isArray(issue.affectedUsers)
      ? issue.affectedUsers.map((entry) => String(entry).slice(0, 80)).slice(0, 3)
      : undefined,
  };

  if (normalized.severity !== 'Pass' && !normalized.selector && !normalized.element) {
    normalized.confidence = 'Low';
  }

  return normalized;
}

function inferConfidence(issue: Partial<AccessibilityIssue>): AccessibilityIssue['confidence'] {
  if (issue.selector && issue.element && issue.wcag) return 'High';
  if (issue.selector || issue.element || issue.wcag) return 'Medium';
  return 'Low';
}

function inferEffort(fixText: unknown): AccessibilityIssue['effort'] {
  const text = String(fixText || '').toLowerCase();
  if (text.includes('refactor') || text.includes('rebuild') || text.includes('redesign')) {
    return 'High';
  }
  if (text.includes('replace') || text.includes('update') || text.includes('add')) {
    return 'Medium';
  }
  return 'Low';
}

function hasFallbackIssue(issues: AccessibilityIssue[]) {
  return issues.some((issue) => issue.title.toLowerCase().includes('analysis incomplete'));
}

function getDefaultIssues(principle: WcagPrinciple, reason: string): AccessibilityIssue[] {
  return [
    {
      severity: 'Warning',
      title: 'Analysis incomplete',
      description: `The automated analysis for the ${principle.label} principle could not be completed for this page.`,
      fix: 'Try re-running the scan or manually validate this area with deterministic tools such as axe-core, Lighthouse, or WAVE.',
      wcag: `${principle.guidelines} Manual verification required`,
      confidence: 'Low',
      effort: 'Medium',
      rationale: reason,
      affectedUsers: ['screen reader users', 'keyboard-only users'],
    },
  ];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  label: string
): Promise<T> {
  let attempt = 0;
  // retries=2 means total attempts = 3
  while (true) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= retries;
      if (isLastAttempt || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = 800 * Math.pow(2, attempt);
      console.warn(`${label} transient failure, retrying in ${delayMs}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
  }
}

function isRetryableError(error: unknown): boolean {
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('overloaded') ||
    message.includes('temporar')
  );
}
