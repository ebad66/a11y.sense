import { AccessibilityIssue } from './claude';
import { inferPrinciple } from '../visualization/bodyPartMapping';
import type { WCAGPrinciple } from '../visualization/types';

export interface IssueSummary {
  criticalCount: number;
  warningCount: number;
  passCount: number;
  score: number;
  mostImpactedPrinciple: WCAGPrinciple | 'None';
}

export function summarizeIssues(issues: AccessibilityIssue[]): IssueSummary {
  const dedupedMap = new Map<string, AccessibilityIssue>();
  for (const issue of issues) {
    const key = `${issue.severity}-${issue.wcag || ''}-${issue.selector || issue.element || issue.title}`;
    if (!dedupedMap.has(key)) dedupedMap.set(key, issue);
  }
  
  const deduped = Array.from(dedupedMap.values());
  const summary: IssueSummary = {
    criticalCount: 0,
    warningCount: 0,
    passCount: 0,
    score: 100,
    mostImpactedPrinciple: 'None'
  };

  const principleCounts: Record<string, number> = {};

  for (const issue of deduped) {
    if (issue.severity === 'Critical') summary.criticalCount++;
    if (issue.severity === 'Warning') summary.warningCount++;
    if (issue.severity === 'Pass') summary.passCount++;

    const principle = inferPrinciple(issue);
    if (issue.severity !== 'Pass') {
      principleCounts[principle] = (principleCounts[principle] || 0) + 1;
    }
  }

  // Calculate score (simple heuristic: lose points for issues)
  const totalIssues = summary.criticalCount + summary.warningCount + summary.passCount;
  if (totalIssues > 0) {
     const penalties = (summary.criticalCount * 10) + (summary.warningCount * 3);
     summary.score = Math.max(0, 100 - penalties);
  }

  // Most impacted
  let maxCount = 0;
  let maxPrinciple: WCAGPrinciple | 'None' = 'None';
  for (const [p, count] of Object.entries(principleCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxPrinciple = p as WCAGPrinciple;
    }
  }
  summary.mostImpactedPrinciple = maxPrinciple;

  return summary;
}

export function buildPrioritizedQueue(issues: AccessibilityIssue[]): AccessibilityIssue[] {
  const dedupedMap = new Map<string, AccessibilityIssue>();
  for (const issue of issues) {
    if (issue.severity === 'Pass') continue;
    
    // Key: severity + wcag + selector/element/title
    const key = `${issue.severity}-${issue.wcag || ''}-${issue.selector || issue.element || issue.title}`;
    if (!dedupedMap.has(key)) dedupedMap.set(key, issue);
  }
  
  const queue = Array.from(dedupedMap.values());

  return queue.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // Severity Weight
    scoreA += a.severity === 'Critical' ? 100 : 50;
    scoreB += b.severity === 'Critical' ? 100 : 50;

    // Evidence Boost
    if (a.selector) scoreA += 20;
    else if (a.element) scoreA += 10;
    if (b.selector) scoreB += 20;
    else if (b.element) scoreB += 10;

    // WCAG presence gives confidence boost
    if (a.wcag) scoreA += 5;
    if (b.wcag) scoreB += 5;

    return scoreB - scoreA;
  });
}

export function buildDeveloperHandoffMarkdown(
  issues: AccessibilityIssue[], 
  sessionUrl: string,
  pageTitle: string
): string {
  const summary = summarizeIssues(issues);
  const queue = buildPrioritizedQueue(issues).slice(0, 8); // Top 8 

  const dateStr = new Date().toLocaleString();

  let md = `# a11y.sense Developer Handoff Report\n\n`;
  md += `**Target:** [${pageTitle || sessionUrl}](${sessionUrl})\n`;
  md += `**Scanned:** ${dateStr}\n\n`;

  md += `## Overview\n`;
  md += `- **Accessibility Score:** ${summary.score}/100\n`;
  md += `- **Critical Issues:** ${summary.criticalCount}\n`;
  md += `- **Warnings:** ${summary.warningCount}\n`;
  md += `- **Passes Found:** ${summary.passCount}\n`;
  md += `- **Most Impacted Area:** ${summary.mostImpactedPrinciple}\n\n`;

  md += `## Fix This First (Top Priority Queue)\n\n`;

  if (queue.length === 0) {
    md += `*Great job! No actionable critical or warning issues found.*`;
    return md;
  }

  queue.forEach((issue, index) => {
    md += `### ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.title}\n`;
    if (issue.wcag) md += `- **WCAG Level:** ${issue.wcag}\n`;
    md += `- **Rationale:** ${issue.description}\n`;
    md += `- **Suggested Fix:** ${issue.fix}\n`;
    if (issue.selector) {
      md += `- **Selector:** \`${issue.selector}\`\n`;
    }
    if (issue.element) {
      md += `- **Element Snippet:**\n  \`\`\`html\n  ${issue.element}\n  \`\`\`\n`;
    }
    md += `\n`;
  });

  return md;
}

export function compareSummaries(oldSummary: IssueSummary | null, newSummary: IssueSummary): { resolved: number, newIssues: number } {
  if (!oldSummary) return { resolved: 0, newIssues: 0 };
  
  const oldTotal = oldSummary.criticalCount + oldSummary.warningCount;
  const newTotal = newSummary.criticalCount + newSummary.warningCount;
  
  return {
    resolved: Math.max(0, oldTotal - newTotal),
    newIssues: Math.max(0, newTotal - oldTotal)
  };
}
