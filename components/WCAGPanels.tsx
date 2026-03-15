import React from 'react';
import { VisualizerIssue, BodyRegion, WCAGPrinciple } from '@/visualization/types';

interface WCAGPanelsProps {
  issues: VisualizerIssue[];
  activeRegion: BodyRegion | null;
  onRegionSelect: (region: BodyRegion | null) => void;
  selectedIssueId: string | null;
  onIssueSelect: (issueId: string | null) => void;
}

const PRINCIPLES: { id: WCAGPrinciple; label: string; region: BodyRegion }[] = [
  { id: 'Perceivable', label: 'Perceivable (Eyes/Ears)', region: 'EyesEars' },
  { id: 'Operable', label: 'Operable (Hands)', region: 'Hands' },
  { id: 'Understandable', label: 'Understandable (Brain)', region: 'Brain' },
  { id: 'Robust', label: 'Robust (Nervous System)', region: 'Spine' },
];

const NAVIGATION_SIGNALS = [
  'Keyboard path verification',
  'Focus continuity and visible focus checks',
  'Route predictability across high-value flows',
];

export function WCAGPanels({ issues, activeRegion, onRegionSelect, selectedIssueId, onIssueSelect }: WCAGPanelsProps) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      <h3 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#6366f1', marginBottom: '8px' }}>
        SYSTEM DIAGNOSTICS
      </h3>
      
      {PRINCIPLES.map(principle => {
        const principleIssues = issues.filter(i => i.principle === principle.id);
        const isActive = activeRegion === principle.region;
        const highestSeverity = principleIssues.some(i => i.severity === 'Critical') 
          ? 'Critical' 
          : principleIssues.some(i => i.severity === 'Warning') 
            ? 'Warning' 
            : principleIssues.length > 0 ? 'Minor' : 'Pass';

        const colorMap = {
          Critical: '#ef4444',
          Warning: '#f59e0b',
          Minor: '#fcd34d',
          Pass: '#4b5563'
        };

        const color = principleIssues.length > 0 ? colorMap[highestSeverity] : colorMap.Pass;

        return (
          <div 
            key={principle.id}
            style={{
              border: `1px solid ${isActive ? color : '#2a2a4a'}`,
              borderRadius: '8px',
              backgroundColor: isActive ? `${color}11` : '#131320',
              overflow: 'hidden',
              transition: 'all 0.2s'
            }}
          >
            {/* Header / Trigger */}
            <button
              onClick={() => onRegionSelect(isActive ? null : principle.region)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '8px',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                <span>{principle.label}</span>
              </div>
              <span style={{ color: '#6b7280' }}>{principleIssues.length}</span>
            </button>

            {/* Dropdown Content — scrollable, separated */}
            {isActive && principleIssues.length > 0 && (
              <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0 8px 8px' }}>
                {principleIssues.map((issue, idx) => (
                  <button
                    key={issue.id}
                    onClick={(e) => { e.stopPropagation(); onIssueSelect(issue.id); }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: selectedIssueId === issue.id ? '#2a2a4a' : 'transparent',
                      border: 'none',
                      borderTop: idx > 0 ? '1px solid #1e1e38' : 'none',
                      outline: selectedIssueId === issue.id ? `1px solid ${color}` : 'none',
                      outlineOffset: '-1px',
                      borderRadius: selectedIssueId === issue.id ? '4px' : '0',
                      color: '#d1d5db',
                      fontSize: '11px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: issue.severity === 'Critical' ? '#ef4444' : '#f59e0b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {issue.severity}
                    </span>
                    <span style={{ lineHeight: 1.4 }}>{issue.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {(() => {
        const isActive = activeRegion === 'Navigation';
        const color = '#38bdf8';

        return (
          <div
            style={{
              border: `1px solid ${isActive ? color : '#2a2a4a'}`,
              borderRadius: '8px',
              backgroundColor: isActive ? `${color}11` : '#131320',
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}
          >
            <button
              onClick={() => {
                onIssueSelect(null);
                onRegionSelect(isActive ? null : 'Navigation');
              }}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '8px',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                <span>Navigation</span>
              </div>
              <span style={{ color: '#6b7280' }}>3</span>
            </button>

            {isActive && (
              <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {NAVIGATION_SIGNALS.map((signal) => (
                  <div
                    key={signal}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#101925',
                      border: '1px solid #1e3a4c',
                      color: '#cbd5e1',
                      fontSize: '11px',
                      lineHeight: 1.5,
                    }}
                  >
                    {signal}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
