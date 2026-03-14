'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileCard } from '@/components/ProfileCard';
import { IssueRow } from '@/components/IssueRow';
import { SimulationView } from '@/components/SimulationView';
import { SandboxBar } from '@/components/SandboxBar';
import { PROFILES, Profile, ProfileId } from '@/lib/profiles';
import { AccessibilityIssue } from '@/lib/claude';

interface SessionData {
  sessionId: string;
  url: string;
  pageTitle: string;
  createdAt: number;
  expiresAt: number;
  issues: Record<ProfileId, AccessibilityIssue[]>;
  hasScreenshot: boolean;
}

export default function ScanPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<ProfileId>('blind');
  const [showSimulation, setShowSimulation] = useState(false);

  useEffect(() => {
    fetch(`/api/session/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSession(data);
        // Default to first profile that has issues
        const firstWithIssues = PROFILES.find(
          (p) => (data.issues[p.id] || []).filter((i: AccessibilityIssue) => i.severity !== 'Pass').length > 0
        );
        if (firstWithIssues) setActiveProfileId(firstWithIssues.id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleRescan = async (newUrl: string) => {
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(`/scan/${data.sessionId}`);
    } catch (e) {
      alert(`Rescan failed: ${(e as Error).message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div
          className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading scan results"
        />
        <p
          className="text-indigo-400"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}
        >
          Loading report...
        </p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <div
          className="text-4xl mb-2"
          aria-hidden="true"
          style={{ fontFamily: '"Press Start 2P", monospace' }}
        >
          404
        </div>
        <h1
          className="text-white text-center"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '12px' }}
        >
          Session not found
        </h1>
        <p className="text-gray-400 text-sm text-center max-w-sm">
          {error || 'This session has expired or does not exist. Sessions last 24 hours.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-6 py-3 rounded-lg text-white font-bold hover:opacity-80 transition-opacity"
          style={{ backgroundColor: '#6366f1', fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}
        >
          ← New Scan
        </button>
      </div>
    );
  }

  const activeProfile = PROFILES.find((p) => p.id === activeProfileId) as Profile;
  const activeIssues = session.issues[activeProfileId] || [];
  const criticals = activeIssues.filter((i) => i.severity === 'Critical');
  const warnings = activeIssues.filter((i) => i.severity === 'Warning');
  const passes = activeIssues.filter((i) => i.severity === 'Pass');

  const totalCriticals = PROFILES.flatMap((p) => session.issues[p.id] || []).filter(
    (i) => i.severity === 'Critical'
  ).length;
  const totalWarnings = PROFILES.flatMap((p) => session.issues[p.id] || []).filter(
    (i) => i.severity === 'Warning'
  ).length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:bg-indigo-600 focus:text-white"
      >
        Skip to report
      </a>

      {/* Top nav */}
      <header
        className="sticky top-0 z-40 px-4 py-3 flex items-center gap-4"
        style={{ backgroundColor: '#0f0f1a', borderBottom: '1px solid #1a1a2e' }}
      >
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          aria-label="Go back to home"
        >
          ← <span className="hidden sm:inline">InclusionLens</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1
            className="text-white truncate"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}
            title={session.pageTitle}
          >
            {session.pageTitle || session.url}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
          <span
            className="px-2 py-1 rounded text-white font-bold"
            style={{ backgroundColor: '#ef444433', fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }}
          >
            {totalCriticals} CRIT
          </span>
          <span
            className="px-2 py-1 rounded text-white font-bold"
            style={{ backgroundColor: '#f59e0b33', fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }}
          >
            {totalWarnings} WARN
          </span>
        </div>
      </header>

      {/* Sandbox bar */}
      <div className="px-4 pt-4">
        <SandboxBar
          url={session.url}
          sessionId={sessionId}
          expiresAt={session.expiresAt}
          onRescan={handleRescan}
        />
      </div>

      {/* Main content */}
      <main id="main-content" className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        {/* Profile selector */}
        <section aria-label="Disability profiles" className="mb-8">
          <h2
            className="text-gray-500 text-xs uppercase tracking-wider mb-4"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}
          >
            Select Profile
          </h2>
          <div
            className="flex gap-4 overflow-x-auto pb-4"
            role="tablist"
            aria-label="Disability profiles"
          >
            {PROFILES.map((profile) => (
              <div key={profile.id} role="tab" aria-selected={activeProfileId === profile.id}>
                <ProfileCard
                  profile={profile}
                  issues={session.issues[profile.id] || []}
                  isActive={activeProfileId === profile.id}
                  onClick={() => setActiveProfileId(profile.id)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Active profile report */}
        <section
          aria-label={`${activeProfile.label} accessibility report`}
          role="tabpanel"
        >
          {/* Profile header */}
          <div
            className="rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{
              backgroundColor: '#1a1a2e',
              border: `2px solid ${activeProfile.color}66`,
            }}
          >
            <div className="flex items-center gap-4 flex-1">
              <div
                className="text-3xl w-14 h-14 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{
                  backgroundColor: `${activeProfile.color}22`,
                  border: `2px solid ${activeProfile.color}44`,
                }}
                aria-hidden="true"
              >
                {activeProfile.emoji}
              </div>
              <div>
                <h2
                  className="text-white mb-1"
                  style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '13px' }}
                >
                  {activeProfile.label} Profile
                </h2>
                <p className="text-gray-400 text-sm">{activeProfile.description}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-400">{criticals.length}</div>
                <div className="text-xs text-gray-500">Critical</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{warnings.length}</div>
                <div className="text-xs text-gray-500">Warnings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{passes.length}</div>
                <div className="text-xs text-gray-500">Passes</div>
              </div>
            </div>

            {/* Simulation button */}
            <button
              onClick={() => setShowSimulation(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ backgroundColor: activeProfile.color }}
              aria-label={`Generate ${activeProfile.label} perspective simulation`}
            >
              <span aria-hidden="true">👁️</span>
              Generate Perspective
            </button>
          </div>

          {/* Issues list */}
          <div className="flex flex-col gap-3">
            {activeIssues.length === 0 ? (
              <div
                className="text-center py-12 text-gray-500 rounded-xl"
                style={{ border: '1px dashed #2a2a4a' }}
              >
                No issues found for this profile.
              </div>
            ) : (
              <>
                {/* Criticals first */}
                {criticals.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3
                      className="text-red-400 text-xs uppercase tracking-wider"
                      style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}
                    >
                      ✕ Critical Issues ({criticals.length})
                    </h3>
                    {criticals.map((issue, i) => (
                      <IssueRow key={i} issue={issue} index={i} />
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4">
                    <h3
                      className="text-yellow-400 text-xs uppercase tracking-wider"
                      style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}
                    >
                      ⚠ Warnings ({warnings.length})
                    </h3>
                    {warnings.map((issue, i) => (
                      <IssueRow key={i} issue={issue} index={i} />
                    ))}
                  </div>
                )}

                {/* Passes */}
                {passes.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4">
                    <h3
                      className="text-green-400 text-xs uppercase tracking-wider"
                      style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}
                    >
                      ✓ Passing Checks ({passes.length})
                    </h3>
                    {passes.map((issue, i) => (
                      <IssueRow key={i} issue={issue} index={i} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Simulation modal */}
      {showSimulation && (
        <SimulationView
          profile={activeProfile}
          sessionId={sessionId}
          hasScreenshot={session?.hasScreenshot ?? false}
          onClose={() => setShowSimulation(false)}
        />
      )}
    </div>
  );
}
