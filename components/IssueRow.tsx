'use client';

import { useState } from 'react';
import { AccessibilityIssue } from '@/lib/claude';

interface IssueRowProps {
  issue: AccessibilityIssue;
  index: number;
}

const SEVERITY_CONFIG = {
  Critical: {
    bg: '#ef444422',
    border: '#ef4444',
    badge: '#ef4444',
    label: 'CRITICAL',
    icon: '✕',
  },
  Warning: {
    bg: '#f59e0b22',
    border: '#f59e0b',
    badge: '#f59e0b',
    label: 'WARNING',
    icon: '⚠',
  },
  Pass: {
    bg: '#10b98122',
    border: '#10b981',
    badge: '#10b981',
    label: 'PASS',
    icon: '✓',
  },
};

export function IssueRow({ issue, index }: IssueRowProps) {
  const [expanded, setExpanded] = useState(index < 3);
  const config = SEVERITY_CONFIG[issue.severity];

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all duration-200"
      style={{
        backgroundColor: config.bg,
        borderColor: config.border + '66',
      }}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${issue.severity}: ${issue.title}. Click to ${expanded ? 'collapse' : 'expand'}.`}
      >
        {/* Severity badge */}
        <span
          className="flex-shrink-0 flex items-center justify-center w-20 h-6 text-white text-center rounded"
          style={{
            backgroundColor: config.badge,
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            letterSpacing: '0.05em',
          }}
          aria-hidden="true"
        >
          {config.icon} {config.label}
        </span>

        {/* Title */}
        <span className="flex-1 text-white font-semibold text-sm">{issue.title}</span>

        {/* WCAG tag */}
        {issue.wcag && (
          <span
            className="flex-shrink-0 text-xs px-2 py-0.5 rounded text-gray-300"
            style={{ backgroundColor: '#ffffff11', fontSize: '10px' }}
          >
            {issue.wcag}
          </span>
        )}

        {/* Expand chevron */}
        <span
          className="flex-shrink-0 text-gray-400 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: config.border + '33' }}>
          {/* Description */}
          <div className="pt-3">
            <p className="text-gray-300 text-sm leading-relaxed">{issue.description}</p>
          </div>

          {/* Affected element */}
          {issue.element && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">
                Affected element
              </p>
              <code
                className="block text-xs px-3 py-2 rounded font-mono text-green-300 overflow-x-auto"
                style={{ backgroundColor: '#0f0f1a', border: '1px solid #2a2a4a' }}
              >
                {issue.element}
              </code>
            </div>
          )}

          {/* Fix recommendation */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">
              How to fix
            </p>
            <div
              className="text-xs px-3 py-2 rounded text-blue-200 leading-relaxed"
              style={{ backgroundColor: '#1e3a5f', border: '1px solid #2a4a7f' }}
            >
              {issue.fix}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
