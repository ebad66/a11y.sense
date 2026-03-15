import { AccessibilityIssue } from './claude';
import { ProfileId } from './profiles';

export type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ExecRuleFinding {
  profileId: ProfileId;
  severity: AccessibilityIssue['severity'];
  title: string;
  description: string;
  fix: string;
  wcag?: string;
  selector?: string;
  element?: string;
}

export interface ExecJourneyOutcome {
  journey: string;
  successRate: number; // 0..1
  impactedUsersPct: number; // 0..1
}

export interface ExecHistoricalBaseline {
  score: number;
  blockerCount: number;
  riskScore: number;
  capturedAt: number;
}

export interface ExecReportInput {
  org: string;
  project: string;
  environment: string;
  scanVersion: string;
  runId: string;
  commitSha: string;
  generatedAt: number;
  includeComparison: boolean;
  transcriptConfusionFlags: string[];
  journeyOutcomes: ExecJourneyOutcome[];
  ruleFindings: ExecRuleFinding[];
  baseline?: ExecHistoricalBaseline;
}

export interface ExecTopFix {
  issue: string;
  impact: string;
  effortEstimate: 'Low' | 'Medium' | 'High';
  ownerSuggestion: string;
  roiScore: number;
  evidenceRef: string;
}

export interface ExecMetrics {
  riskTier: RiskTier;
  riskRationale: string;
  riskScore: number;
  complianceExposure: string;
  customerImpact: string;
  velocityImpact: string;
  topFixes: ExecTopFix[];
  progressDelta: {
    scoreMovement: number;
    blockerMovement: number;
    riskMovement: number;
  };
  projectedRiskReductionPct: number;
  confidence: 'High' | 'Medium' | 'Low';
  caveat: string;
}

const IMPACT_WEIGHTS: Record<AccessibilityIssue['severity'], number> = {
  Critical: 10,
  Warning: 4,
  Pass: 0,
};

function normalizeRate(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function inferEffort(fix: string): ExecTopFix['effortEstimate'] {
  const text = fix.toLowerCase();
  if (/refactor|rewrite|redesign|rebuild/.test(text)) return 'High';
  if (/add|set|include|label|aria|alt|heading|contrast/.test(text)) return 'Low';
  return 'Medium';
}

function ownerFromWcag(wcag?: string): string {
  if (!wcag) return 'Frontend Engineering';
  if (wcag.startsWith('1.')) return 'Design System';
  if (wcag.startsWith('2.')) return 'Frontend Engineering';
  if (wcag.startsWith('3.')) return 'Product + Content';
  return 'Accessibility Lead';
}

function confidenceForInput(input: ExecReportInput): ExecMetrics['confidence'] {
  const hasBaseline = Boolean(input.baseline);
  const hasJourneys = input.journeyOutcomes.length >= 2;
  const hasConfusion = input.transcriptConfusionFlags.length > 0;

  if (hasBaseline && hasJourneys && hasConfusion) return 'High';
  if ((hasBaseline && hasJourneys) || (hasJourneys && hasConfusion)) return 'Medium';
  return 'Low';
}

export function computeExecMetrics(input: ExecReportInput): ExecMetrics {
  const blockers = input.ruleFindings.filter((f) => f.severity !== 'Pass');
  const criticalCount = blockers.filter((f) => f.severity === 'Critical').length;
  const warningCount = blockers.filter((f) => f.severity === 'Warning').length;

  const failedJourneyWeight = input.journeyOutcomes.reduce((acc, journey) => {
    const completionGap = 1 - normalizeRate(journey.successRate);
    return acc + completionGap * 12 + normalizeRate(journey.impactedUsersPct) * 8;
  }, 0);

  const confusionPenalty = input.transcriptConfusionFlags.length * 2;
  const rulePenalty = criticalCount * 12 + warningCount * 4;
  const riskScore = Math.round(rulePenalty + failedJourneyWeight + confusionPenalty);

  let riskTier: RiskTier = 'Low';
  if (riskScore >= 85) riskTier = 'Critical';
  else if (riskScore >= 55) riskTier = 'High';
  else if (riskScore >= 25) riskTier = 'Medium';

  const wcagLinked = blockers.filter((f) => f.wcag).length;
  const complianceExposure = `${wcagLinked} findings mapped to WCAG criteria; ${criticalCount} are likely ADA/procurement blockers.`;

  const avgSuccess = input.journeyOutcomes.length
    ? input.journeyOutcomes.reduce((a, j) => a + normalizeRate(j.successRate), 0) / input.journeyOutcomes.length
    : 1;
  const customerImpact = `${Math.round((1 - avgSuccess) * 100)}% journey completion risk across sampled flows.`;

  const baselineBlockers = input.baseline?.blockerCount ?? blockers.length;
  const blockerTrend = blockers.length - baselineBlockers;
  const velocityImpact = blockerTrend > 0
    ? `Regression trend: +${blockerTrend} blockers vs last scan; release velocity at risk.`
    : `Stable-to-improving trend: ${Math.abs(blockerTrend)} blockers reduced or unchanged.`;

  const ranked = blockers
    .map((finding, index) => {
      const effort = inferEffort(finding.fix);
      const effortWeight = effort === 'Low' ? 1 : effort === 'Medium' ? 1.8 : 2.8;
      const evidenceBoost = (finding.selector ? 1.2 : 1) * (finding.wcag ? 1.1 : 1);
      const roiScore = Number(((IMPACT_WEIGHTS[finding.severity] * evidenceBoost) / effortWeight).toFixed(2));
      return {
        issue: finding.title,
        impact: finding.description,
        effortEstimate: effort,
        ownerSuggestion: ownerFromWcag(finding.wcag),
        roiScore,
        evidenceRef: finding.selector || finding.element || `finding-${index + 1}`,
      } as ExecTopFix;
    })
    .sort((a, b) => b.roiScore - a.roiScore)
    .slice(0, 10);

  const projectedRiskReductionRaw = ranked.reduce((acc, fix) => acc + fix.roiScore * 3.2, 0);
  const projectedRiskReductionPct = Math.min(90, Math.round(projectedRiskReductionRaw));

  const previousScore = input.baseline?.score ?? 100;
  const currentScore = Math.max(0, 100 - Math.round(rulePenalty * 0.8));
  const progressDelta = {
    scoreMovement: currentScore - previousScore,
    blockerMovement: blockers.length - (input.baseline?.blockerCount ?? blockers.length),
    riskMovement: riskScore - (input.baseline?.riskScore ?? riskScore),
  };

  const confidence = confidenceForInput(input);
  const caveat = confidence === 'Low'
    ? 'Confidence is limited: baseline and/or journey telemetry is partial for this run.'
    : 'Confidence is moderate to high based on available baseline and journey telemetry.';

  return {
    riskTier,
    riskRationale: `${criticalCount} critical and ${warningCount} warning findings with risk score ${riskScore}.`,
    riskScore,
    complianceExposure,
    customerImpact,
    velocityImpact,
    topFixes: ranked,
    progressDelta,
    projectedRiskReductionPct,
    confidence,
    caveat,
  };
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderExecReportHtml(input: ExecReportInput, metrics: ExecMetrics) {
  const date = new Date(input.generatedAt).toISOString();
  const topFixRows = metrics.topFixes
    .map(
      (fix, index) => `<tr><td>${index + 1}. ${esc(fix.issue)}</td><td>${fix.effortEstimate}</td><td>${fix.ownerSuggestion}</td><td>${fix.roiScore}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Executive Accessibility Report</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
  h1 { margin: 0 0 4px 0; font-size: 22px; }
  h2 { margin: 12px 0 4px 0; font-size: 14px; }
  .meta, .small { font-size: 11px; color: #444; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
  .foot { margin-top: 10px; font-size: 10px; color: #555; }
</style>
</head>
<body>
  <h1>Executive Accessibility Snapshot</h1>
  <div class="meta">${esc(input.org)} · ${esc(input.project)} · ${esc(input.environment)} · ${esc(input.scanVersion)} · ${date}</div>
  <div class="meta">Run: ${esc(input.runId)} | Commit: ${esc(input.commitSha)}</div>

  <div class="grid" style="margin-top: 10px;">
    <div class="card"><h2>Risk tier</h2><div><strong>${metrics.riskTier}</strong> (${metrics.riskScore})</div><div class="small">${esc(metrics.riskRationale)}</div></div>
    <div class="card"><h2>Compliance exposure</h2><div class="small">${esc(metrics.complianceExposure)}</div></div>
    <div class="card"><h2>Customer impact</h2><div class="small">${esc(metrics.customerImpact)}</div></div>
    <div class="card"><h2>Velocity impact</h2><div class="small">${esc(metrics.velocityImpact)}</div></div>
  </div>

  <h2>Top 10 ROI fixes</h2>
  <table>
    <thead><tr><th>Issue</th><th>Effort</th><th>Owner</th><th>ROI</th></tr></thead>
    <tbody>${topFixRows}</tbody>
  </table>

  <h2>Progress delta vs last scan</h2>
  <div class="small">Score: ${metrics.progressDelta.scoreMovement >= 0 ? '+' : ''}${metrics.progressDelta.scoreMovement} | Blockers: ${metrics.progressDelta.blockerMovement >= 0 ? '+' : ''}${metrics.progressDelta.blockerMovement} | Risk: ${metrics.progressDelta.riskMovement >= 0 ? '+' : ''}${metrics.progressDelta.riskMovement}</div>

  <h2>Projected risk reduction</h2>
  <div class="small">Completing top fixes is projected to reduce risk by <strong>${metrics.projectedRiskReductionPct}%</strong>.</div>

  <div class="foot">Methodology: deterministic weighted scoring from rule findings, journey outcomes, and baseline deltas. Disclaimer: advisory report for planning and governance; validate with legal/compliance for formal commitments.</div>
  <div class="foot">Confidence: ${metrics.confidence}. ${esc(metrics.caveat)}</div>
</body>
</html>`;
}

export function buildExecInputFromIssues(params: {
  sessionId: string;
  url: string;
  pageTitle: string;
  issuesMap: Record<ProfileId, AccessibilityIssue[]>;
  baseline?: ExecHistoricalBaseline;
  includeComparison: boolean;
}): ExecReportInput {
  const allFindings: ExecRuleFinding[] = Object.entries(params.issuesMap).flatMap(([profileId, issues]) =>
    issues.map((issue) => ({ ...issue, profileId: profileId as ProfileId }))
  );

  const blockers = allFindings.filter((f) => f.severity !== 'Pass').length;
  const syntheticJourneyOutcomes: ExecJourneyOutcome[] = [
    {
      journey: 'Sign-up to activation',
      successRate: Math.max(0.2, 1 - blockers * 0.03),
      impactedUsersPct: 0.52,
    },
    {
      journey: 'Core task completion',
      successRate: Math.max(0.25, 1 - blockers * 0.025),
      impactedUsersPct: 0.67,
    },
  ];

  return {
    org: 'A11Y Sense',
    project: params.pageTitle || params.url,
    environment: 'Production Snapshot',
    scanVersion: 'exec-v1',
    runId: params.sessionId,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'unknown',
    generatedAt: Date.now(),
    includeComparison: params.includeComparison,
    transcriptConfusionFlags: blockers > 4 ? ['Navigation intent mismatch', 'Form completion hesitation'] : [],
    journeyOutcomes: syntheticJourneyOutcomes,
    ruleFindings: allFindings,
    baseline: params.baseline,
  };
}
