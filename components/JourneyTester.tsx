'use client';

import { useMemo, useState } from 'react';
import { JourneyRun, JourneyTemplateId } from '@/lib/journey/types';

const templates: Array<{ id: JourneyTemplateId; label: string }> = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'signup', label: 'Signup' },
  { id: 'book-appointment', label: 'Book appointment' },
];

export function JourneyTester() {
  const [templateId, setTemplateId] = useState<JourneyTemplateId>('checkout');
  const [targetUrl, setTargetUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<JourneyRun[]>([]);

  const latestRun = runs[0] ?? null;

  const blockersSummary = useMemo(() => {
    if (!latestRun) return 'No blockers yet.';
    if (latestRun.blockers.length === 0) return 'No blockers — journey can be completed.';
    return latestRun.blockers.map((b) => `${b.rank}. ${b.message}`).join(' | ');
  }, [latestRun]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch('/api/journey/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          mode: 'keyboard-only',
          targetUrl: targetUrl.trim() || undefined,
        }),
      });

      const data = (await response.json()) as JourneyRun | { error: string };
      if (!response.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : 'Journey run failed');
      }

      setRuns((prev) => [data, ...prev].slice(0, 8));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section
      aria-labelledby="journey-testing-heading"
      className="w-full max-w-4xl mt-10 rounded-2xl p-6"
      style={{ backgroundColor: '#121226', border: '1px solid #2a2a4a' }}
    >
      <h2 id="journey-testing-heading" className="text-white text-lg font-semibold mb-4">
        Task-based journey testing (MVP)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <label className="flex flex-col text-sm text-gray-300 gap-1">
          Template
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value as JourneyTemplateId)}
            className="px-3 py-2 rounded bg-[#0f0f1a] border border-[#2a2a4a] text-white"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm text-gray-300 gap-1 md:col-span-2">
          Optional target URL (use keywords like <code>unreachable-payment</code> to simulate known failures)
          <input
            type="url"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder="https://example.com/checkout"
            className="px-3 py-2 rounded bg-[#0f0f1a] border border-[#2a2a4a] text-white"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="px-4 py-2 rounded text-white font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#6366f1' }}
        >
          {running ? 'Running...' : 'Run keyboard-only journey'}
        </button>
        <span className="text-xs text-gray-400">Run history: {runs.length}</span>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {latestRun ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg p-4 border border-[#2a2a4a] bg-[#0f0f1a]">
            <p className="text-sm text-gray-200">
              <strong>Business outcome:</strong>{' '}
              {latestRun.status === 'pass' ? 'Can complete journey' : 'Cannot complete journey'}
            </p>
            <p className="text-sm text-gray-300 mt-1">
              Journey score: {latestRun.successScore} · Confidence: {(latestRun.confidence * 100).toFixed(0)}%
            </p>
            <p className="text-sm text-gray-300 mt-1">Completion time: {latestRun.totalDurationMs} ms</p>
            <p className="text-sm text-amber-200 mt-2">Top blockers: {blockersSummary}</p>
          </div>

          <div className="space-y-3">
            {latestRun.stepOutcomes.map((step) => (
              <article
                key={step.stepId}
                className="rounded-lg p-4 border"
                style={{
                  borderColor: step.status === 'pass' ? '#14532d' : '#7f1d1d',
                  backgroundColor: step.status === 'pass' ? '#052e16' : '#2d1515',
                }}
              >
                <p className="text-sm text-white font-semibold">{step.stepName}</p>
                <p className="text-xs text-gray-200 mt-1">Expected: {step.expectedCriterion}</p>
                <p className="text-xs text-gray-200 mt-1">Observed: {step.observedBehavior}</p>
                <p className="text-xs text-gray-200 mt-1">Severity: {step.severity}</p>
                <p className="text-xs text-gray-200 mt-1">Suggested fix: {step.suggestedFix}</p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-400">No journey run yet. Pick a template and execute one.</p>
      )}
    </section>
  );
}
