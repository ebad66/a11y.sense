import { AccessibilityIssue } from './claude';
import { WCAG_PRINCIPLES, WcagPrincipleId } from './wcag';

type Severity = AccessibilityIssue['severity'];
type Confidence = 'High' | 'Medium' | 'Low';
type Effort = 'Low' | 'Medium' | 'High';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  Critical: 100,
  Warning: 60,
  Pass: 0,
};

const EFFORT_PENALTY: Record<Effort, number> = {
  Low: 0,
  Medium: 6,
  High: 12,
};

export interface PrioritizedIssue {
  key: string;
  issue: AccessibilityIssue;
  principleIds: WcagPrincipleId[];
  priorityScore: number;
  confidence: Confidence;
  effort: Effort;
  rationale: string;
  evidence: 'Exact selector' | 'Element snippet' | 'Heuristic only';
}

export interface ExecutiveSummary {
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  passCount: number;
  score: number;
  mostImpactedPrinciple: WcagPrincipleId;
}

export function summarizeIssues(
  issuesByPrinciple: Record<WcagPrincipleId, AccessibilityIssue[]>
): ExecutiveSummary {
  const all = Object.values(issuesByPrinciple).flat();
  const deduped = dedupeIssues(all);

  const criticalCount = deduped.filter((issue) => issue.severity === 'Critical').length;
  const warningCount = deduped.filter((issue) => issue.severity === 'Warning').length;
  const passCount = deduped.filter((issue) => issue.severity === 'Pass').length;

  const principleImpact = WCAG_PRINCIPLES.map((principle) => ({
    id: principle.id,
    count: (issuesByPrinciple[principle.id] || []).filter((issue) => issue.severity !== 'Pass').length,
  })).sort((a, b) => b.count - a.count);

  const mostImpactedPrinciple = (principleImpact[0]?.id ?? 'perceivable') as WcagPrincipleId;
  const score = Math.max(0, Math.min(100, Math.round(100 - criticalCount * 12 - warningCount * 4 + passCount * 0.4)));

  return {
    totalIssues: criticalCount + warningCount,
    criticalCount,
    warningCount,
    passCount,
    score,
    mostImpactedPrinciple,
  };
}

export function buildPrioritizedQueue(
  issuesByPrinciple: Record<WcagPrincipleId, AccessibilityIssue[]>
): PrioritizedIssue[] {
  const merged = new Map<string, { issue: AccessibilityIssue; principleIds: Set<WcagPrincipleId> }>();

  for (const principle of WCAG_PRINCIPLES) {
    const issues = issuesByPrinciple[principle.id] || [];

    for (const issue of issues) {
      if (issue.severity === 'Pass') continue;

      const key = issueKey(issue);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { issue, principleIds: new Set([principle.id]) });
        continue;
      }

      existing.principleIds.add(principle.id);
      if (SEVERITY_WEIGHT[issue.severity] > SEVERITY_WEIGHT[existing.issue.severity]) {
        existing.issue = issue;
      }
    }
  }

  return Array.from(merged.entries())
    .map(([key, value]) => {
      const confidence = inferConfidence(value.issue);
      const effort = inferEffort(value.issue);
      const evidence = inferEvidence(value.issue);
      const priorityScore =
        SEVERITY_WEIGHT[value.issue.severity] +
        confidenceBoost(confidence) +
        evidenceBoost(evidence) +
        Math.min(8, Math.max(0, value.principleIds.size - 1) * 2) -
        EFFORT_PENALTY[effort];

      return {
        key,
        issue: value.issue,
        principleIds: Array.from(value.principleIds),
        priorityScore,
        confidence,
        effort,
        rationale: value.issue.rationale || defaultRationale(value.issue),
        evidence,
      } satisfies PrioritizedIssue;
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function buildDeveloperHandoffMarkdown(input: {
  url: string;
  pageTitle: string;
  createdAt: number;
  summary: ExecutiveSummary;
  queue: PrioritizedIssue[];
}): string {
  const date = new Date(input.createdAt).toLocaleString();

  return [
    `# a11y.sense — Developer Handoff`,
    '',
    `- **URL:** ${input.url}`,
    `- **Page title:** ${input.pageTitle}`,
    `- **Scanned at:** ${date}`,
    `- **Accessibility score:** ${input.summary.score}/100`,
    `- **Critical:** ${input.summary.criticalCount}`,
    `- **Warnings:** ${input.summary.warningCount}`,
    '',
    '## Fix this first',
    ...input.queue.slice(0, 8).map((item, index) => {
      const principles = item.principleIds
        .map((id) => WCAG_PRINCIPLES.find((p) => p.id === id)?.label || id)
        .join(', ');
      return [
        `${index + 1}. **[${item.issue.severity}] ${item.issue.title}**`,
        `   - WCAG: ${item.issue.wcag || 'Not specified'}`,
        `   - Principle(s): ${principles}`,
        `   - Confidence: ${item.confidence}`,
        `   - Effort: ${item.effort}`,
        `   - Why first: ${item.rationale}`,
        `   - Fix: ${item.issue.fix}`,
        item.issue.selector ? `   - Selector: \`${item.issue.selector}\`` : undefined,
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ]
    .flat()
    .join('\n');
}

export function compareSummaries(current: ExecutiveSummary, baseline: ExecutiveSummary) {
  return {
    criticalDelta: current.criticalCount - baseline.criticalCount,
    warningDelta: current.warningCount - baseline.warningCount,
    scoreDelta: current.score - baseline.score,
  };
}

function dedupeIssues(issues: AccessibilityIssue[]): AccessibilityIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = issueKey(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function issueKey(issue: AccessibilityIssue): string {
  const selectorPart = issue.selector || issue.element || issue.title.toLowerCase();
  const wcagPart = issue.wcag || 'wcag-unknown';
  return `${issue.severity}:${wcagPart}:${selectorPart}`.toLowerCase();
}

function inferConfidence(issue: AccessibilityIssue): Confidence {
  if (issue.confidence) return issue.confidence;
  if (issue.selector && issue.element && issue.wcag) return 'High';
  if (issue.selector || issue.element) return 'Medium';
  return 'Low';
}

function inferEffort(issue: AccessibilityIssue): Effort {
  if (issue.effort) return issue.effort;

  const fix = issue.fix.toLowerCase();
  if (fix.includes('redesign') || fix.includes('refactor') || fix.includes('rebuild')) return 'High';
  if (fix.includes('update') || fix.includes('replace') || fix.includes('add')) return 'Medium';
  return 'Low';
}

function inferEvidence(issue: AccessibilityIssue): PrioritizedIssue['evidence'] {
  if (issue.selector) return 'Exact selector';
  if (issue.element) return 'Element snippet';
  return 'Heuristic only';
}

function confidenceBoost(confidence: Confidence): number {
  if (confidence === 'High') return 18;
  if (confidence === 'Medium') return 10;
  return 0;
}

function evidenceBoost(evidence: PrioritizedIssue['evidence']): number {
  if (evidence === 'Exact selector') return 10;
  if (evidence === 'Element snippet') return 6;
  return 0;
}

function defaultRationale(issue: AccessibilityIssue): string {
  if (issue.severity === 'Critical') {
    return 'This issue blocks core accessibility workflows and should be fixed before release.';
  }
  return 'This issue impacts usability and should be resolved after critical blockers.';
}
