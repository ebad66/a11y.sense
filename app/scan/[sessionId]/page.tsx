'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileCard } from '@/components/ProfileCard';
import { IssueRow } from '@/components/IssueRow';
import { VisualizeTab } from '@/components/VisualizeTab';
import { WCAG_PRINCIPLES, WcagPrincipleId, WcagPrinciple } from '@/lib/wcag';
import { AccessibilityIssue } from '@/lib/claude';

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
}

type MainTab = 'problems' | 'visualize';

export default function ScanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session,           setSession]           = useState<SessionData | null>(null);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [activePrincipleId, setActivePrincipleId] = useState<WcagPrincipleId>('perceivable');
  const [copied,            setCopied]            = useState(false);
  const [rescanning,        setRescanning]        = useState(false);
  const [activeTab,         setActiveTab]         = useState<MainTab>('visualize');
  // Which accordion sections are open inside the Problems tab
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ critical: true, warning: false, passing: false });

  useEffect(() => {
    let cancelled = false;
    const fetchWithRetry = async (attemptsLeft: number): Promise<SessionData> => {
      const r    = await fetch(`/api/session/${sessionId}`);
      const data = await r.json();
      if (data.error) {
        if (attemptsLeft > 1) {
          await new Promise(res => setTimeout(res, 900));
          if (!cancelled) return fetchWithRetry(attemptsLeft - 1);
        }
        throw new Error(data.error);
      }
      return data as SessionData;
    };

    fetchWithRetry(4)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        // Default to the principle with the most critical issues
        const firstWithIssues = WCAG_PRINCIPLES.find(
          (p) => (data.issues[p.id] || []).filter((i: AccessibilityIssue) => i.severity !== 'Pass').length > 0
        );
        if (firstWithIssues) setActivePrincipleId(firstWithIssues.id);
        setActiveTab('visualize');
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sessionId]);

  const handleRescan = async () => {
    if (!session?.url || rescanning) return;
    setRescanning(true);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: session.url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(`/scan/${data.sessionId}`);
    } catch (e) {
      alert(`Rescan failed: ${(e as Error).message}`);
    } finally {
      setRescanning(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/scan/${sessionId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', backgroundColor: '#0f0f1a' }}>
        <div
          style={{ width: '32px', height: '32px', border: '4px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}
          role="status"
          aria-label="Loading scan results"
        />
        <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#6366f1' }}>
          Loading report...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px', backgroundColor: '#0f0f1a' }}>
        <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '32px', color: '#ef4444' }}>404</div>
        <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: '#fff', textAlign: 'center' }}>Session not found</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
          {error || 'This session has expired or does not exist. Sessions last 24 hours.'}
        </p>
        <button
          onClick={() => router.push('/')}
          style={{ marginTop: '16px', padding: '12px 24px', backgroundColor: '#6366f1', color: '#fff', fontFamily: '"Press Start 2P", monospace', fontSize: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          ← New Scan
        </button>
      </div>
    );
  }

  const activePrinciple = WCAG_PRINCIPLES.find((p) => p.id === activePrincipleId) as WcagPrinciple;
  const activeIssues    = session.issues[activePrincipleId] || [];
  const criticals       = activeIssues.filter((i) => i.severity === 'Critical');
  const warnings        = activeIssues.filter((i) => i.severity === 'Warning');
  const passes          = activeIssues.filter((i) => i.severity === 'Pass');

  // Aggregate totals across all principles (deduplicated by title to avoid double-counting)
  const allIssues       = Object.values(session.issues).flat();
  const uniqueTitles    = new Set<string>();
  const dedupedIssues   = allIssues.filter(i => {
    if (uniqueTitles.has(i.title)) return false;
    uniqueTitles.add(i.title);
    return true;
  });
  const totalCriticals  = dedupedIssues.filter(i => i.severity === 'Critical').length;
  const totalWarnings   = dedupedIssues.filter(i => i.severity === 'Warning').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f0f1a', color: '#e5e7eb' }}>
      {/* Skip nav */}
      <a
        href="#main-content"
        style={{ position: 'absolute', left: '-9999px' }}
        onFocus={(e) => { e.currentTarget.style.left = '16px'; e.currentTarget.style.top = '16px'; }}
        onBlur={(e)  => { e.currentTarget.style.left = '-9999px'; }}
      >
        Skip to report
      </a>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px', height: '44px',
        borderBottom: '1px solid #1a1a2e',
        position: 'sticky', top: 0, zIndex: 40,
        backgroundColor: '#0f0f1a',
        gap: '10px', flexShrink: 0,
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '11px', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
          aria-label="Go to home"
        >
          a11y.sense
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ color: '#4b5563', fontSize: '13px', flexShrink: 0 }}>&gt;</span>
          <span
            style={{ color: '#9ca3af', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}
            title={session.url}
          >
            {session.url}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#ef4444', padding: '3px 8px', border: '1px solid #ef4444', borderRadius: '3px' }}>
            {totalCriticals} CRIT
          </span>
          <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#f59e0b', padding: '3px 8px', border: '1px solid #f59e0b', borderRadius: '3px' }}>
            {totalWarnings} WARN
          </span>
          <button
            onClick={handleShare}
            style={{ padding: '4px 12px', fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#f59e0b', backgroundColor: 'transparent', border: '1px solid #f59e0b', borderRadius: '4px', cursor: 'pointer' }}
            aria-label="Copy share link"
          >
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={handleRescan}
            disabled={rescanning}
            style={{ padding: '4px 12px', fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#f59e0b', backgroundColor: 'transparent', border: '1px solid #f59e0b', borderRadius: '4px', cursor: rescanning ? 'wait' : 'pointer', opacity: rescanning ? 0.6 : 1 }}
            aria-label="Re-scan URL"
          >
            {rescanning ? '...' : 'Re-scan'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar: WCAG principles ── */}
        <aside
          style={{ width: '220px', borderRight: '1px solid #1a1a2e', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          aria-label="WCAG principles"
        >
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: '6px',
            color: '#4b5563', padding: '14px 14px 10px',
            letterSpacing: '0.08em', flexShrink: 0,
          }}>
            WCAG PRINCIPLE
          </p>
          {WCAG_PRINCIPLES.map((principle) => (
            <ProfileCard
              key={principle.id}
              principle={principle}
              issues={session.issues[principle.id] || []}
              isActive={activePrincipleId === principle.id}
              onClick={() => { setActivePrincipleId(principle.id); setActiveTab('visualize'); }}
            />
          ))}

          {/* WCAG legend at bottom of sidebar */}
          <div style={{
            marginTop: 'auto', padding: '14px',
            borderTop: '1px solid #1a1a2e',
          }}>
            <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '5px', color: '#374151', marginBottom: '8px', letterSpacing: '0.06em' }}>
              WCAG 2.1 — POUR
            </p>
            {WCAG_PRINCIPLES.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <span style={{ fontSize: '10px' }}>{p.emoji}</span>
                <span style={{ fontSize: '10px', color: p.color, fontWeight: 600 }}>{p.label}</span>
                <span style={{ fontSize: '9px', color: '#374151' }}>{p.guidelines}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main
          id="main-content"
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          aria-label={`${activePrinciple.label} accessibility report`}
        >
          {/* Principle header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '16px',
            padding: '16px 24px', borderBottom: '1px solid #1a1a2e',
            flexShrink: 0, flexWrap: 'wrap',
          }}>
            {/* Icon */}
            <div
              style={{
                width: '42px', height: '42px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: `${activePrinciple.color}22`,
                border: `1px solid ${activePrinciple.color}44`,
                borderRadius: '6px', fontSize: '20px',
              }}
              aria-hidden="true"
            >
              {activePrinciple.emoji}
            </div>

            {/* Title + description */}
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: '#fff', margin: 0, lineHeight: 1.3 }}>
                  {activePrinciple.label}
                </h2>
                <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: activePrinciple.color, opacity: 0.7 }}>
                  WCAG {activePrinciple.guidelines}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '5px 0 0', lineHeight: 1.5, maxWidth: '480px' }}>
                {activePrinciple.tagline}
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '24px', textAlign: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#ef4444', lineHeight: 1 }}>{criticals.length}</div>
                <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#6b7280', marginTop: '5px', letterSpacing: '0.04em' }}>CRITICAL</div>
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#f59e0b', lineHeight: 1 }}>{warnings.length}</div>
                <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#6b7280', marginTop: '5px', letterSpacing: '0.04em' }}>WARNINGS</div>
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{passes.length}</div>
                <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#6b7280', marginTop: '5px', letterSpacing: '0.04em' }}>PASSES</div>
              </div>
            </div>
          </div>

          {/* ── Top-level tabs: PROBLEMS | VISUALIZE ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e', padding: '0 24px', gap: '4px' }}>
            {([
              {
                id:    'visualize' as MainTab,
                label: 'VISUALIZE',
                count: null,
                color: activePrinciple.color,
              },
              {
                id:    'problems'  as MainTab,
                label: 'PROBLEMS',
                count: criticals.length + warnings.length,
                color: criticals.length > 0 ? '#ef4444' : '#f59e0b',
              },
            ]).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 16px',
                    background: 'none', border: 'none',
                    borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                    marginBottom: '-1px',
                    cursor: 'pointer',
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '8px',
                    color: isActive ? tab.color : '#4b5563',
                    transition: 'color 0.15s',
                  }}
                  aria-selected={isActive}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span style={{
                      fontSize: '9px',
                      fontFamily: '"Press Start 2P", monospace',
                      color: isActive ? '#fff' : '#4b5563',
                      backgroundColor: isActive ? tab.color : '#1a1a2e',
                      padding: '2px 6px', borderRadius: '3px', lineHeight: 1.5,
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab content ── */}
          <div style={{ padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* PROBLEMS: three expandable accordion sections */}
            {activeTab === 'problems' && (
              <>
                {([
                  { key: 'critical', label: 'Critical',  color: '#ef4444', items: criticals, emptyLabel: `No critical ${activePrinciple.label} issues` },
                  { key: 'warning',  label: 'Warnings',  color: '#f59e0b', items: warnings,  emptyLabel: `No ${activePrinciple.label} warnings` },
                  { key: 'passing',  label: 'Passing',   color: '#10b981', items: passes,    emptyLabel: 'No passing checks recorded' },
                ] as const).map(({ key, label, color, items, emptyLabel }) => {
                  const open = openSections[key] ?? false;
                  return (
                    <div
                      key={key}
                      style={{
                        border: `1px solid ${open ? color + '44' : '#1a1a2e'}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {/* Accordion header */}
                      <button
                        onClick={() => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))}
                        aria-expanded={open}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '14px 16px',
                          background: open ? `${color}0d` : '#1a1a2e',
                          border: 'none', cursor: 'pointer',
                          transition: 'background 0.2s',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: color, flexShrink: 0,
                        }} />
                        <span style={{
                          fontFamily: '"Press Start 2P", monospace', fontSize: '8px',
                          color: open ? color : '#9ca3af', flex: 1,
                          transition: 'color 0.2s',
                        }}>
                          {label}
                        </span>
                        <span style={{
                          fontFamily: '"Press Start 2P", monospace', fontSize: '8px',
                          color: open ? '#fff' : '#4b5563',
                          backgroundColor: open ? color : '#111827',
                          padding: '3px 8px', borderRadius: '3px', lineHeight: 1.5,
                          transition: 'background 0.2s, color 0.2s',
                        }}>
                          {items.length}
                        </span>
                        <span style={{
                          color: '#4b5563', fontSize: '14px', flexShrink: 0,
                          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                          lineHeight: 1,
                        }} aria-hidden="true">
                          ▾
                        </span>
                      </button>

                      {/* Accordion body — slides in */}
                      <div style={{
                        maxHeight: open ? '9999px' : '0',
                        overflow: 'hidden',
                        transition: open ? 'max-height 0.35s ease' : 'max-height 0.2s ease',
                      }}>
                        <div style={{ padding: '4px 16px 16px' }}>
                          {items.length === 0
                            ? <EmptyState label={emptyLabel} />
                            : items.map((issue, i) => <IssueRow key={i} issue={issue} index={i} />)
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* VISUALIZE */}
            {activeTab === 'visualize' && (
              <VisualizeTab
                key={activePrincipleId}
                principle={activePrinciple}
                issues={activeIssues}
                sessionId={sessionId}
                hasScreenshot={session.hasScreenshot}
                screenshotWidth={session.screenshotWidth}
                screenshotHeight={session.screenshotHeight}
                elementCoords={session.elementCoords}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 0',
      color: '#4b5563', border: '1px dashed #2a2a4a',
      borderRadius: '8px', fontFamily: '"Press Start 2P", monospace', fontSize: '9px',
    }}>
      {label}
    </div>
  );
}
