'use client';

import { useMemo, useState } from 'react';
import { JourneyRun, JourneyTemplateId } from '@/lib/journey/types';

const templates: Array<{ id: JourneyTemplateId; label: string; detail: string }> = [
  { id: 'checkout', label: 'Checkout', detail: 'Validate cart review, payment selection, and confirmation routing.' },
  { id: 'signup', label: 'Sign up', detail: 'Confirm the account creation flow stays keyboard-accessible from start to submit.' },
  { id: 'book-appointment', label: 'Book appointment', detail: 'Check time-slot selection and confirmation flow without pointer input.' },
];

interface JourneyTesterProps {
  targetUrl: string;
}

export function JourneyTester({ targetUrl }: JourneyTesterProps) {
  const [templateId, setTemplateId] = useState<JourneyTemplateId>('checkout');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<JourneyRun[]>([]);

  const latestRun = runs[0] ?? null;
  const activeTemplate = templates.find((template) => template.id === templateId) ?? templates[0];
  const targetHost = useMemo(() => {
    try {
      return new URL(targetUrl).host;
    } catch {
      return targetUrl;
    }
  }, [targetUrl]);

  const blockersSummary = useMemo(() => {
    if (!latestRun) return 'Run a navigation diagnostic to surface keyboard blockers and route-level failures.';
    if (latestRun.blockers.length === 0) return 'No blockers detected across the selected journey.';
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
    <section aria-labelledby="journey-testing-heading" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <div
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            letterSpacing: '0.08em',
            color: '#38bdf8',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          Navigation diagnostics
        </div>
        <h2 id="journey-testing-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
          Keyboard journey verification
        </h2>
        <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6, margin: '10px 0 0' }}>
          Replay high-value user flows against this scan target and expose focus loss, unreachable controls, and
          unexpected route changes before they ship.
        </p>
      </div>

      <div
        style={{
          border: '1px solid #1f3c52',
          backgroundColor: '#111a24',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            letterSpacing: '0.08em',
            color: '#7dd3fc',
            textTransform: 'uppercase',
          }}
        >
          Active scope
        </div>
        <div style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: 600 }}>{targetHost}</div>
        <div
          style={{
            color: '#94a3b8',
            fontSize: '12px',
            fontFamily: 'monospace',
            overflowWrap: 'anywhere',
            lineHeight: 1.5,
          }}
        >
          {targetUrl}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#d1d5db', fontSize: '12px' }}>
          Journey
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value as JourneyTemplateId)}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: '#111827',
              border: '1px solid #243041',
              color: '#fff',
            }}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            borderRadius: '12px',
            border: '1px solid #1f2937',
            backgroundColor: '#111827',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '7px',
              letterSpacing: '0.08em',
              color: '#64748b',
              textTransform: 'uppercase',
            }}
          >
            Selected flow
          </div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{activeTemplate.label}</div>
          <div style={{ color: '#9ca3af', fontSize: '12px', lineHeight: 1.6 }}>{activeTemplate.detail}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: '#0ea5e9',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            cursor: running ? 'wait' : 'pointer',
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? 'Running navigation audit...' : 'Run navigation audit'}
        </button>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>Recent runs: {runs.length}</span>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: '#2d1515',
            border: '1px solid #7f1d1d',
            color: '#fca5a5',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      ) : null}

      {latestRun ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              borderRadius: '14px',
              border: `1px solid ${latestRun.status === 'pass' ? '#14532d' : '#7f1d1d'}`,
              backgroundColor: latestRun.status === 'pass' ? '#052e16' : '#2b1212',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <div
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '7px',
                    letterSpacing: '0.08em',
                    color: latestRun.status === 'pass' ? '#86efac' : '#fca5a5',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  Latest result
                </div>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                  {latestRun.status === 'pass' ? 'Journey completed successfully' : 'Journey blocked by navigation defects'}
                </div>
              </div>
              <div
                style={{
                  padding: '5px 8px',
                  borderRadius: '999px',
                  border: `1px solid ${latestRun.status === 'pass' ? '#22c55e' : '#ef4444'}`,
                  color: latestRun.status === 'pass' ? '#86efac' : '#fca5a5',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {latestRun.status}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { label: 'Score', value: `${latestRun.successScore}` },
                { label: 'Confidence', value: `${(latestRun.confidence * 100).toFixed(0)}%` },
                { label: 'Runtime', value: `${latestRun.totalDurationMs} ms` },
              ].map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(15, 23, 42, 0.42)',
                    padding: '10px',
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>
                    {metric.label}
                  </div>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>{metric.value}</div>
                </div>
              ))}
            </div>

            <div style={{ color: '#e2e8f0', fontSize: '12px', lineHeight: 1.6 }}>
              <strong style={{ color: '#fff' }}>Primary blockers:</strong> {blockersSummary}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {latestRun.stepOutcomes.map((step) => (
              <article
                key={step.stepId}
                style={{
                  borderRadius: '12px',
                  padding: '14px',
                  border: `1px solid ${step.status === 'pass' ? '#164e63' : '#7c2d12'}`,
                  backgroundColor: step.status === 'pass' ? '#0b1f2a' : '#261615',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700, margin: 0 }}>{step.stepName}</p>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: step.status === 'pass' ? '#7dd3fc' : '#fdba74',
                    }}
                  >
                    {step.severity}
                  </span>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                  <strong style={{ color: '#fff' }}>Expected:</strong> {step.expectedCriterion}
                </p>
                <p style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                  <strong style={{ color: '#fff' }}>Observed:</strong> {step.observedBehavior}
                </p>
                <p style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                  <strong style={{ color: '#fff' }}>Fix direction:</strong> {step.suggestedFix}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            borderRadius: '12px',
            border: '1px dashed #334155',
            padding: '18px',
            color: '#94a3b8',
            fontSize: '12px',
            lineHeight: 1.6,
          }}
        >
          Select a journey and run a navigation audit to generate a keyboard-flow diagnostic for this page.
        </div>
      )}
    </section>
  );
}
