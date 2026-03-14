'use client';

import { useState } from 'react';
import { AccessibilityIssue } from '@/lib/claude';

interface IssueRowProps {
  issue: AccessibilityIssue;
  index: number;
}

const SEVERITY_CONFIG = {
  Critical: {
    color: '#ef4444',
    label: 'CRITICAL',
  },
  Warning: {
    color: '#f59e0b',
    label: 'WARNING',
  },
  Pass: {
    color: '#10b981',
    label: 'PASS',
  },
};

export function IssueRow({ issue, index }: IssueRowProps) {
  const [expanded, setExpanded] = useState(index < 3);
  const config = SEVERITY_CONFIG[issue.severity];

  return (
    <div style={{ borderBottom: '1px solid #1a1a2e' }}>
      {/* Header row */}
      <button
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '11px 0',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${issue.severity}: ${issue.title}. Click to ${expanded ? 'collapse' : 'expand'}.`}
      >
        {/* Severity badge — outline style */}
        <span
          style={{
            flexShrink: 0,
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: config.color,
            border: `1px solid ${config.color}`,
            borderRadius: '3px',
            padding: '3px 8px',
            whiteSpace: 'nowrap',
            lineHeight: 1.5,
            minWidth: '72px',
            textAlign: 'center',
          }}
          aria-hidden="true"
        >
          {config.label}
        </span>

        {/* Title */}
        <span style={{ flex: 1, color: '#d1d5db', fontSize: '13px', lineHeight: 1.4 }}>
          {issue.title}
        </span>

        {/* WCAG tag */}
        {issue.wcag && (
          <span
            style={{
              flexShrink: 0,
              fontSize: '11px',
              color: '#6b7280',
              whiteSpace: 'nowrap',
            }}
          >
            {issue.wcag}
          </span>
        )}

        {/* Chevron */}
        <span
          style={{
            flexShrink: 0,
            color: '#4b5563',
            fontSize: '12px',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ paddingBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Description */}
          <p style={{ color: '#9ca3af', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
            {issue.description}
          </p>

          {/* Affected element */}
          {issue.element && (
            <div>
              <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontWeight: 600 }}>
                Affected element
              </p>
              <code
                style={{
                  display: 'block',
                  fontSize: '11px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  color: '#6ee7b7',
                  backgroundColor: '#0f0f1a',
                  border: '1px solid #2a2a4a',
                  overflowX: 'auto',
                }}
              >
                {issue.element}
              </code>
            </div>
          )}

          {/* Fix */}
          <div>
            <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontWeight: 600 }}>
              How to fix
            </p>
            <div
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                borderRadius: '4px',
                color: '#93c5fd',
                backgroundColor: '#1e3a5f',
                border: '1px solid #2a4a7f',
                lineHeight: 1.6,
              }}
            >
              {issue.fix}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
