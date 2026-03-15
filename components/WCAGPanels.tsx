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
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                <span>{principle.label}</span>
              </div>
              <span style={{ color: '#6b7280' }}>{principleIssues.length}</span>
            </button>

            {/* Dropdown Content */}
            {isActive && principleIssues.length > 0 && (
              <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {principleIssues.map(issue => (
                  <button
                    key={issue.id}
                    onClick={(e) => { e.stopPropagation(); onIssueSelect(issue.id); }}
                    style={{
                      padding: '8px 12px',
                      background: selectedIssueId === issue.id ? '#2a2a4a' : 'transparent',
                      border: '1px solid transparent',
                      borderColor: selectedIssueId === issue.id ? color : 'transparent',
                      borderRadius: '4px',
                      color: '#d1d5db',
                      fontSize: '11px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                       <span style={{ fontWeight: 'bold' }}>{issue.severity}</span>
                    </div>
                    <span>{issue.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
