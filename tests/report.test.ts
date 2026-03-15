import { describe, expect, it } from 'vitest';
import { AccessibilityIssue } from '../lib/claude';
import { buildPrioritizedQueue, compareSummaries, summarizeIssues } from '../lib/report';
import { WcagPrincipleId } from '../lib/wcag';

function makeIssues(input: Partial<AccessibilityIssue> & Pick<AccessibilityIssue, 'title' | 'severity'>): AccessibilityIssue {
  return {
    title: input.title,
    severity: input.severity,
    description: input.description || 'Description',
    fix: input.fix || 'Fix guidance',
    wcag: input.wcag,
    selector: input.selector,
    element: input.element,
    confidence: input.confidence,
    effort: input.effort,
    rationale: input.rationale,
    affectedUsers: input.affectedUsers,
  };
}

function issuesByPrinciple() {
  return {
    perceivable: [
      makeIssues({
        severity: 'Critical',
        title: 'Image missing alt',
        wcag: '1.1.1 Non-text Content',
        selector: 'img[src*="hero"]',
        confidence: 'High',
      }),
      makeIssues({
        severity: 'Pass',
        title: 'Main heading present',
      }),
    ],
    operable: [
      makeIssues({
        severity: 'Warning',
        title: 'Focus style faint',
        wcag: '2.4.7 Focus Visible',
        element: '<button class="btn">Pay</button>',
        effort: 'Low',
      }),
    ],
    understandable: [
      makeIssues({
        severity: 'Critical',
        title: 'Image missing alt',
        wcag: '1.1.1 Non-text Content',
        selector: 'img[src*="hero"]',
      }),
    ],
    robust: [],
  } as Record<WcagPrincipleId, AccessibilityIssue[]>;
}

describe('report utilities', () => {
  it('summarizes issue counts and score', () => {
    const summary = summarizeIssues(issuesByPrinciple());

    expect(summary.criticalCount).toBe(1);
    expect(summary.warningCount).toBe(1);
    expect(summary.passCount).toBe(1);
    expect(summary.score).toBeLessThan(100);
  });

  it('builds a prioritized queue sorted by score', () => {
    const queue = buildPrioritizedQueue(issuesByPrinciple());

    expect(queue.length).toBe(2);
    expect(queue[0].issue.severity).toBe('Critical');
    expect(queue[0].principleIds.length).toBe(2);
    expect(queue[0].priorityScore).toBeGreaterThan(queue[1].priorityScore);
  });

  it('compares before and after summaries', () => {
    const before = summarizeIssues(issuesByPrinciple());
    const afterData = issuesByPrinciple();
    afterData.perceivable = afterData.perceivable.filter((issue) => issue.severity !== 'Critical');
    afterData.understandable = afterData.understandable.filter((issue) => issue.severity !== 'Critical');
    const after = summarizeIssues(afterData);

    const comparison = compareSummaries(after, before);
    expect(comparison.criticalDelta).toBe(-1);
    expect(comparison.scoreDelta).toBeGreaterThan(0);
  });
});
