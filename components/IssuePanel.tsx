import React from 'react';
import { VisualizerIssue } from '@/visualization/types';
import { HandoffPanel } from './HandoffPanel';

interface IssuePanelProps {
  issue: VisualizerIssue | null;
  onClose: () => void;
  principleIssues: VisualizerIssue[];
  sessionUrl: string;
  pageTitle: string;
}

export function IssuePanel({ issue, onClose, principleIssues, sessionUrl, pageTitle }: IssuePanelProps) {
  if (!issue) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '11px', textAlign: 'center' }}>
        <p>Select an issue from the diagnostics panel to view details.</p>
      </div>
    );
  }

  const colorMap = {
    Critical: '#ef4444',
    Warning: '#f59e0b',
    Minor: '#fcd34d',
    Pass: '#10b981'
  };
  const color = colorMap[issue.severity] || colorMap.Minor;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto', backgroundColor: '#0f0f1a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span 
          style={{ 
            fontFamily: '"Press Start 2P", monospace', 
            fontSize: '8px', 
            padding: '4px 8px', 
            backgroundColor: `${color}22`, 
            color: color, 
            border: `1px solid ${color}`, 
            borderRadius: '4px' 
          }}
        >
          {issue.severity.toUpperCase()}
        </span>
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '16px' }}
        >
          ✕
        </button>
      </div>

      <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
        {issue.title}
      </h2>

      {issue.wcag && (
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          <strong>WCAG:</strong> {issue.wcag}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '12px', color: '#e5e7eb', textTransform: 'uppercase', marginBottom: '8px' }}>Description</h3>
        <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
          {issue.description}
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: '12px', color: '#e5e7eb', textTransform: 'uppercase', marginBottom: '8px' }}>Suggested Fix</h3>
        <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
          {issue.fix}
        </p>
      </div>

      {issue.element && (
        <div>
          <h3 style={{ fontSize: '12px', color: '#e5e7eb', textTransform: 'uppercase', marginBottom: '8px' }}>Affected Element</h3>
          <pre style={{
            backgroundColor: '#1a1a2e',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#a78bfa',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            margin: 0
          }}>
            {issue.element}
          </pre>
        </div>
      )}

      <HandoffPanel
        principle={issue.principle}
        principleIssues={principleIssues}
        sessionUrl={sessionUrl}
        pageTitle={pageTitle}
      />
    </div>
  );
}
