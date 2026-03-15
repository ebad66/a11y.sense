import { describe, expect, it } from 'vitest';
import { buildExecInputFromIssues, computeExecMetrics, renderExecReportHtml } from '../lib/exec-report';
import { ProfileId } from '../lib/profiles';
import { AccessibilityIssue } from '../lib/claude';

function mkIssuesMap(): Record<ProfileId, AccessibilityIssue[]> {
  return {
    blind: [
      { severity: 'Critical', title: 'Missing form label', description: 'Screen reader users cannot identify the input purpose.', fix: 'Add an explicit <label> and aria-describedby.', selector: 'input[name="email"]', wcag: '1.3.1' },
      { severity: 'Warning', title: 'Low contrast CTA', description: 'Text has poor contrast and is hard to read.', fix: 'Set contrast ratio to 4.5:1.', selector: 'button.cta', wcag: '1.4.3' },
    ],
    'low-vision': [],
    dyslexia: [],
    deaf: [],
    motor: [],
  } as Record<ProfileId, AccessibilityIssue[]>;
}

describe('exec report metrics', () => {
  it('is deterministic and includes required sections', () => {
    const input = buildExecInputFromIssues({
      sessionId: 'sess-123',
      url: 'https://example.com',
      pageTitle: 'Example',
      issuesMap: mkIssuesMap(),
      includeComparison: true,
      baseline: { score: 85, blockerCount: 4, riskScore: 40, capturedAt: Date.now() - 86400000 },
    });

    const m1 = computeExecMetrics(input);
    const m2 = computeExecMetrics(input);

    expect(m1).toEqual(m2);
    expect(['Critical', 'High', 'Medium', 'Low']).toContain(m1.riskTier);
    expect(m1.topFixes.length).toBe(2);
    expect(typeof m1.complianceExposure).toBe('string');
    expect(typeof m1.customerImpact).toBe('string');
    expect(typeof m1.velocityImpact).toBe('string');

    const html = renderExecReportHtml(input, m1);
    expect(html).toContain('Top 10 ROI fixes');
    expect(html).toContain('Progress delta vs last scan');
    expect(html).toContain('Projected risk reduction');
  });

  it('tolerates missing optional fields', () => {
    const input = buildExecInputFromIssues({
      sessionId: 'sess-999',
      url: 'https://example.org',
      pageTitle: 'Fallback',
      issuesMap: {
        blind: [{ severity: 'Warning', title: 'Need alt', description: 'Image lacks alternative text.', fix: 'Add alt.' }],
        'low-vision': [],
        dyslexia: [],
        deaf: [],
        motor: [],
      } as Record<ProfileId, AccessibilityIssue[]>,
      includeComparison: false,
    });

    const metrics = computeExecMetrics(input);
    expect(metrics.topFixes.length).toBeGreaterThanOrEqual(1);
    expect(metrics.confidence).toBe('Low');
  });
});
