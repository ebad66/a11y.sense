'use client';

import { ReactNode, use, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IssueRow } from '@/components/IssueRow';
import { ProfileCard } from '@/components/ProfileCard';
import { SimulationView } from '@/components/SimulationView';
import { VisualizeTab } from '@/components/VisualizeTab';
import { readApiErrorMessage } from '@/lib/api';
import { AccessibilityIssue } from '@/lib/claude';
import { ProfileId, PROFILES, getProfile } from '@/lib/profiles';
import {
  buildDeveloperHandoffMarkdown,
  buildPrioritizedQueue,
  compareSummaries,
  summarizeIssues,
} from '@/lib/report';
import { WCAG_PRINCIPLES, WcagPrincipleId } from '@/lib/wcag';

interface ScanMeta {
  partial: boolean;
  warnings: string[];
  completedStages: string[];
  failedStages: string[];
  stageTimingsMs: Record<string, number>;
  principleStatus: Record<WcagPrincipleId, 'ok' | 'fallback'>;
}

interface SessionData {
  sessionId: string;
  url: string;
  pageTitle: string;
  createdAt: number;
  expiresAt: number;
  issues: Record<WcagPrincipleId, AccessibilityIssue[]>;
  hasScreenshot: boolean;
  screenshotWidth: number;
  screenshotHeight: number;
  elementCoords: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }>;
  scanMeta?: ScanMeta;
}

type MainTab = 'overview' | 'problems' | 'visualize' | 'handoff';

type SeveritySection = 'critical' | 'warning' | 'passing';

export default function ScanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const baselineSessionId = searchParams.get('baseline');
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [baseline, setBaseline] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePrincipleId, setActivePrincipleId] = useState<WcagPrincipleId>('perceivable');
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [handoffCopyState, setHandoffCopyState] = useState<'idle' | 'copied'>('idle');
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SeveritySection, boolean>>({
    critical: true,
    warning: true,
    passing: false,
  });
  const [simulationProfileId, setSimulationProfileId] = useState<ProfileId | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionData() {
      setLoading(true);
      setError(null);

      try {
        const currentSession = await fetchSessionWithRetry(sessionId, 4);
        if (cancelled) return;

        setSession(currentSession);

        const firstPrincipleWithIssues = WCAG_PRINCIPLES.find((principle) =>
          (currentSession.issues[principle.id] || []).some((issue) => issue.severity !== 'Pass')
        );
        if (firstPrincipleWithIssues) {
          setActivePrincipleId(firstPrincipleWithIssues.id);
        }

        if (baselineSessionId && baselineSessionId !== sessionId) {
          const baselineSession = await fetchSessionWithRetry(baselineSessionId, 1).catch(() => null);
          if (!cancelled) setBaseline(baselineSession);
        } else {
          setBaseline(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSessionData();

    return () => {
      cancelled = true;
    };
  }, [baselineSessionId, sessionId]);

  const activePrinciple = useMemo(
    () => WCAG_PRINCIPLES.find((principle) => principle.id === activePrincipleId) || WCAG_PRINCIPLES[0],
    [activePrincipleId]
  );

  const summary = useMemo(() => {
    if (!session) return null;
    return summarizeIssues(session.issues);
  }, [session]);

  const baselineSummary = useMemo(() => {
    if (!baseline) return null;
    return summarizeIssues(baseline.issues);
  }, [baseline]);

  const comparison = useMemo(() => {
    if (!summary || !baselineSummary) return null;
    return compareSummaries(summary, baselineSummary);
  }, [summary, baselineSummary]);

  const prioritizedQueue = useMemo(() => {
    if (!session) return [];
    return buildPrioritizedQueue(session.issues);
  }, [session]);

  const activeIssues = session?.issues[activePrincipleId] || [];
  const criticals = activeIssues.filter((issue) => issue.severity === 'Critical');
  const warnings = activeIssues.filter((issue) => issue.severity === 'Warning');
  const passes = activeIssues.filter((issue) => issue.severity === 'Pass');

  const handoffMarkdown = useMemo(() => {
    if (!session || !summary) return '';
    return buildDeveloperHandoffMarkdown({
      url: session.url,
      pageTitle: session.pageTitle,
      createdAt: session.createdAt,
      summary,
      queue: prioritizedQueue,
    });
  }, [prioritizedQueue, session, summary]);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/scan/${sessionId}`);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('idle');
    }
  }

  async function handleRescan() {
    if (!session?.url || rescanning) return;

    setRescanError(null);
    setRescanning(true);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: session.url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readApiErrorMessage(data, 'Re-scan failed.'));
      }

      router.push(`/scan/${data.sessionId}?baseline=${sessionId}`);
    } catch (scanError) {
      setRescanError((scanError as Error).message);
    } finally {
      setRescanning(false);
    }
  }

  async function handleCopyHandoff() {
    if (!handoffMarkdown) return;
    try {
      await navigator.clipboard.writeText(handoffMarkdown);
      setHandoffCopyState('copied');
      setTimeout(() => setHandoffCopyState('idle'), 1500);
    } catch {
      setHandoffCopyState('idle');
    }
  }

  function handleDownloadHandoff() {
    if (!handoffMarkdown || !session) return;

    const blob = new Blob([handoffMarkdown], { type: 'text/markdown;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `a11y-sense-handoff-${session.sessionId}.md`;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] text-slate-100 flex flex-col items-center justify-center gap-4 px-4">
        <span
          className="inline-block size-8 rounded-full border-4 border-indigo-300 border-t-transparent animate-spin"
          role="status"
          aria-label="Loading scan results"
        />
        <p className="text-sm text-slate-300">Loading report…</p>
      </div>
    );
  }

  if (error || !session || !summary) {
    return (
      <div className="min-h-screen bg-[#0b1020] text-slate-100 flex items-center justify-center px-4">
        <div className="max-w-lg rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-red-200">Session unavailable</p>
          <h1 className="mt-2 text-xl font-semibold text-white">Could not load this report</h1>
          <p className="mt-3 text-sm text-red-100 leading-relaxed">
            {error || 'This session has expired or does not exist. Session data is currently retained for 24 hours.'}
          </p>
          <button
            className="mt-5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            onClick={() => router.push('/')}
          >
            Start a new scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <a
        href="#report-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-indigo-600 focus:px-4 focus:py-2"
      >
        Skip to report content
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0b1020]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
          >
            ← New scan
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Scanned URL</p>
            <p className="truncate text-sm text-slate-200" title={session.url}>
              {session.url}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-red-100">
              {summary.criticalCount} critical
            </span>
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-amber-100">
              {summary.warningCount} warnings
            </span>
            <button
              onClick={handleShare}
              className="rounded-full border border-slate-600 px-3 py-1 text-slate-200 hover:border-slate-400"
            >
              {copyState === 'copied' ? 'Copied' : 'Share link'}
            </button>
            <button
              onClick={handleRescan}
              disabled={rescanning}
              className="rounded-full border border-indigo-400/60 px-3 py-1 text-indigo-100 hover:border-indigo-300 disabled:opacity-60"
            >
              {rescanning ? 'Re-scanning…' : 'Re-scan'}
            </button>
          </div>
        </div>
      </header>

      <main id="report-content" className="mx-auto max-w-7xl px-4 py-6">
        {rescanError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
            {rescanError}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4 mb-5">
          <SummaryCard title="Accessibility score" value={`${summary.score}/100`} tone="indigo" subtitle="Higher is better" />
          <SummaryCard title="Critical blockers" value={String(summary.criticalCount)} tone="red" subtitle="Fix these first" />
          <SummaryCard title="Warnings" value={String(summary.warningCount)} tone="amber" subtitle="Important usability gaps" />
          <SummaryCard
            title="Most impacted"
            value={WCAG_PRINCIPLES.find((item) => item.id === summary.mostImpactedPrinciple)?.label || 'Perceivable'}
            tone="slate"
            subtitle="Principle with most issues"
          />
        </section>

        {comparison && baseline && baselineSummary && (
          <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Before / after re-scan</p>
                <p className="text-sm text-slate-200">
                  Compared with session <code className="text-slate-300">{baseline.sessionId}</code>
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <DeltaChip label="Score" value={comparison.scoreDelta} positiveHigher />
                <DeltaChip label="Critical" value={comparison.criticalDelta * -1} positiveHigher={false} />
                <DeltaChip label="Warnings" value={comparison.warningDelta * -1} positiveHigher={false} />
              </div>
            </div>
          </section>
        )}

        {session.scanMeta?.warnings?.length ? (
          <section className="mb-5 rounded-xl border border-amber-400/35 bg-amber-500/10 p-4">
            <p className="text-xs uppercase tracking-wider text-amber-200">Scan warnings</p>
            <ul className="mt-2 list-disc list-inside text-sm text-amber-100 space-y-1">
              {session.scanMeta.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 h-fit">
            <p className="px-2 pb-2 text-[11px] uppercase tracking-wide text-slate-400">POUR principles</p>
            <div className="space-y-2">
              {WCAG_PRINCIPLES.map((principle) => (
                <ProfileCard
                  key={principle.id}
                  principle={principle}
                  issues={session.issues[principle.id] || []}
                  isActive={activePrincipleId === principle.id}
                  onClick={() => {
                    setActivePrincipleId(principle.id);
                    if (activeTab === 'handoff') return;
                    setActiveTab('problems');
                  }}
                />
              ))}
            </div>
          </aside>

          <section className="rounded-xl border border-slate-700 bg-slate-900/60">
            <div className="border-b border-slate-700 px-4 pt-4">
              <h1 className="text-lg font-semibold text-white">{session.pageTitle || session.url}</h1>
              <p className="mt-1 text-sm text-slate-300">
                {activePrinciple.label}: {activePrinciple.tagline}
              </p>

              <div role="tablist" aria-label="Report views" className="mt-4 flex flex-wrap gap-2 pb-3">
                <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                  Overview
                </TabButton>
                <TabButton active={activeTab === 'problems'} onClick={() => setActiveTab('problems')}>
                  Problems ({criticals.length + warnings.length})
                </TabButton>
                <TabButton active={activeTab === 'visualize'} onClick={() => setActiveTab('visualize')}>
                  Visualize
                </TabButton>
                <TabButton active={activeTab === 'handoff'} onClick={() => setActiveTab('handoff')}>
                  Developer handoff
                </TabButton>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <section className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                    <h2 className="text-sm font-semibold text-white">Fix this first</h2>
                    {prioritizedQueue.length === 0 ? (
                      <p className="mt-2 text-sm text-emerald-200">No blocking issues detected for this scan.</p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {prioritizedQueue.slice(0, 6).map((item, index) => (
                          <li key={item.key} className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm text-slate-100 font-medium">
                                {index + 1}. {item.issue.title}
                              </p>
                              <span className="text-[11px] rounded-full border border-slate-600 px-2 py-0.5 text-slate-300">
                                Score {Math.round(item.priorityScore)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-300">
                              {item.issue.severity} • {item.evidence} • Confidence {item.confidence} • Effort {item.effort}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">{item.rationale}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <section className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                    <h2 className="text-sm font-semibold text-white">Persona simulations</h2>
                    <p className="mt-1 text-xs text-slate-300">
                      Preview how this page may be experienced by different disability profiles.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {PROFILES.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left hover:border-slate-500"
                          onClick={() => setSimulationProfileId(profile.id)}
                        >
                          <p className="text-sm text-slate-100 font-medium">
                            {profile.emoji} {profile.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">{profile.description}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'problems' && (
                <div className="space-y-3">
                  <SeverityPanel
                    title="Critical"
                    count={criticals.length}
                    open={openSections.critical}
                    onToggle={() => setOpenSections((prev) => ({ ...prev, critical: !prev.critical }))}
                    tone="red"
                  >
                    {criticals.length === 0 ? (
                      <EmptyState label={`No critical ${activePrinciple.label} blockers`} />
                    ) : (
                      criticals.map((issue, index) => <IssueRow key={`${issue.title}-${index}`} issue={issue} index={index} />)
                    )}
                  </SeverityPanel>

                  <SeverityPanel
                    title="Warnings"
                    count={warnings.length}
                    open={openSections.warning}
                    onToggle={() => setOpenSections((prev) => ({ ...prev, warning: !prev.warning }))}
                    tone="amber"
                  >
                    {warnings.length === 0 ? (
                      <EmptyState label={`No ${activePrinciple.label} warnings`} />
                    ) : (
                      warnings.map((issue, index) => <IssueRow key={`${issue.title}-${index}`} issue={issue} index={index} />)
                    )}
                  </SeverityPanel>

                  <SeverityPanel
                    title="Passing checks"
                    count={passes.length}
                    open={openSections.passing}
                    onToggle={() => setOpenSections((prev) => ({ ...prev, passing: !prev.passing }))}
                    tone="emerald"
                  >
                    {passes.length === 0 ? (
                      <EmptyState label="No passing checks returned for this principle" />
                    ) : (
                      passes.map((issue, index) => <IssueRow key={`${issue.title}-${index}`} issue={issue} index={index} />)
                    )}
                  </SeverityPanel>
                </div>
              )}

              {activeTab === 'visualize' && (
                <VisualizeTab
                  key={activePrincipleId}
                  principle={activePrinciple}
                  issues={activeIssues}
                  sessionId={session.sessionId}
                  hasScreenshot={session.hasScreenshot}
                  screenshotWidth={session.screenshotWidth}
                  screenshotHeight={session.screenshotHeight}
                  elementCoords={session.elementCoords}
                />
              )}

              {activeTab === 'handoff' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopyHandoff}
                      className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400"
                    >
                      {handoffCopyState === 'copied' ? 'Copied' : 'Copy markdown'}
                    </button>
                    <button
                      onClick={handleDownloadHandoff}
                      className="rounded-md border border-indigo-400/60 px-3 py-1.5 text-xs text-indigo-100 hover:border-indigo-300"
                    >
                      Download .md
                    </button>
                  </div>

                  <pre className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-200 overflow-auto whitespace-pre-wrap max-h-[520px]">
                    {handoffMarkdown}
                  </pre>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>

      {simulationProfileId && (
        <SimulationView
          profile={getProfile(simulationProfileId)}
          sessionId={session.sessionId}
          hasScreenshot={session.hasScreenshot}
          onClose={() => setSimulationProfileId(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: 'indigo' | 'red' | 'amber' | 'slate';
}) {
  const toneClass =
    tone === 'indigo'
      ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-100'
      : tone === 'red'
        ? 'border-red-400/40 bg-red-500/10 text-red-100'
        : tone === 'amber'
          ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
          : 'border-slate-600 bg-slate-900/70 text-slate-100';

  return (
    <article className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-90">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{subtitle}</p>
    </article>
  );
}

function DeltaChip({
  label,
  value,
  positiveHigher,
}: {
  label: string;
  value: number;
  positiveHigher: boolean;
}) {
  const isPositive = positiveHigher ? value > 0 : value >= 0;
  const prefix = value > 0 ? '+' : '';

  return (
    <span
      className={`rounded-full border px-2.5 py-1 ${
        isPositive
          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
          : 'border-red-400/40 bg-red-500/10 text-red-100'
      }`}
    >
      {label}: {prefix}
      {value}
    </span>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs sm:text-sm ${
        active
          ? 'border-indigo-400/70 bg-indigo-500/15 text-indigo-100'
          : 'border-slate-600 text-slate-300 hover:border-slate-500'
      }`}
    >
      {children}
    </button>
  );
}

function SeverityPanel({
  title,
  count,
  open,
  onToggle,
  tone,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  tone: 'red' | 'amber' | 'emerald';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-400/40 bg-red-500/10 text-red-100'
      : tone === 'amber'
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
        : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/40">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-100">{title}</span>
        <span className={`text-xs rounded-full border px-2 py-0.5 ${toneClass}`}>
          {count}
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/35 px-4 py-8 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

async function fetchSessionWithRetry(sessionId: string, attempts: number): Promise<SessionData> {
  let attempt = 0;
  while (attempt < attempts) {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readApiErrorMessage(data, 'Unable to load session.'));
      }
      return normalizeSessionData(data);
    } catch (error) {
      attempt += 1;
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  throw new Error('Unable to load session.');
}

function normalizeSessionData(raw: unknown): SessionData {
  const data = raw as {
    sessionId: string;
    url: string;
    pageTitle: string;
    createdAt: number;
    expiresAt: number;
    issues: Record<string, AccessibilityIssue[]>;
    hasScreenshot: boolean;
    screenshotWidth: number;
    screenshotHeight: number;
    elementCoords: Record<string, { xPct: number; yPct: number; wPct: number; hPct: number }>;
    scanMeta?: ScanMeta;
  };

  const normalizedIssues = WCAG_PRINCIPLES.reduce((acc, principle) => {
    acc[principle.id] = Array.isArray(data.issues?.[principle.id])
      ? data.issues[principle.id]
      : [];
    return acc;
  }, {} as Record<WcagPrincipleId, AccessibilityIssue[]>);

  return {
    sessionId: data.sessionId,
    url: data.url,
    pageTitle: data.pageTitle,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    issues: normalizedIssues,
    hasScreenshot: Boolean(data.hasScreenshot),
    screenshotWidth: data.screenshotWidth || 1280,
    screenshotHeight: data.screenshotHeight || 900,
    elementCoords: data.elementCoords || {},
    scanMeta: data.scanMeta,
  };
}
