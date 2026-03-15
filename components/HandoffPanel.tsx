'use client';

import { useState } from 'react';
import { VisualizerIssue, WCAGPrinciple } from '@/visualization/types';

interface HandoffPanelProps {
  principle: WCAGPrinciple;
  principleIssues: VisualizerIssue[];
  sessionUrl: string;
  pageTitle: string;
}

export function HandoffPanel({ principle, principleIssues, sessionUrl, pageTitle }: HandoffPanelProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issues: principleIssues,
          principle,
          url: sessionUrl,
          pageTitle,
        }),
      });
      const data = await res.json();
      setMarkdown(data.markdown ?? '# Error\nNo content returned.');
    } catch {
      setMarkdown('# Error\nFailed to generate handoff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `a11y-handoff-${principle.toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div
      style={{
        borderTop: '1px solid #1a1a2e',
        paddingTop: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            color: '#6366f1',
            margin: 0,
          }}
        >
          DEV HANDOFF
        </h3>
        <span
          style={{
            fontSize: '10px',
            color: '#6b7280',
            fontFamily: '"Press Start 2P", monospace',
          }}
        >
          {principle}
        </span>
      </div>

      {/* Issue count badge */}
      <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
        Generate a developer-ready markdown report for{' '}
        <span style={{ color: '#a78bfa' }}>
          {principleIssues.filter(i => i.severity !== 'Pass').length} {principle}
        </span>{' '}
        issues — copy or download for your PR / GitHub issue.
      </p>

      {/* Generate button (shown when no markdown yet) */}
      {!markdown && (
        <button
          onClick={generate}
          disabled={loading}
          aria-label={`Generate developer handoff for ${principle} issues`}
          style={{
            padding: '10px 12px',
            backgroundColor: loading ? '#1a1a2e' : '#4f46e5',
            color: loading ? '#6b7280' : '#fff',
            border: `1px solid ${loading ? '#2a2a4a' : '#6366f1'}`,
            borderRadius: '4px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            cursor: loading ? 'wait' : 'pointer',
            width: '100%',
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? '⟳  Generating with Gemini...' : '⬇  Generate Handoff .md'}
        </button>
      )}

      {/* Result view */}
      {markdown && (
        <>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleCopy}
              aria-label="Copy markdown to clipboard"
              style={{
                flex: 1,
                padding: '7px 6px',
                backgroundColor: '#131320',
                color: copied ? '#10b981' : '#9ca3af',
                border: `1px solid ${copied ? '#10b981' : '#2a2a4a'}`,
                borderRadius: '4px',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '6px',
                cursor: 'pointer',
                transition: 'color 0.2s, border-color 0.2s',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Markdown'}
            </button>

            <button
              onClick={handleDownload}
              aria-label={`Download ${principle} handoff as .md file`}
              style={{
                flex: 1,
                padding: '7px 6px',
                backgroundColor: '#131320',
                color: '#9ca3af',
                border: '1px solid #2a2a4a',
                borderRadius: '4px',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '6px',
                cursor: 'pointer',
              }}
            >
              Download .md
            </button>

            <button
              onClick={() => { setMarkdown(null); }}
              aria-label="Regenerate handoff"
              title="Regenerate"
              style={{
                padding: '7px 10px',
                backgroundColor: 'transparent',
                color: '#4b5563',
                border: '1px solid #1a1a2e',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              ↺
            </button>
          </div>

          {/* Markdown preview */}
          <pre
            style={{
              backgroundColor: '#0a0a14',
              border: '1px solid #2a2a4a',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '10px',
              color: '#d1d5db',
              overflowY: 'auto',
              maxHeight: '340px',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              margin: 0,
              lineHeight: 1.7,
              fontFamily: 'monospace',
            }}
          >
            {markdown}
          </pre>
        </>
      )}
    </div>
  );
}
