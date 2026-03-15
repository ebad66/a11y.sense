'use client';

import { WcagPrinciple } from '@/lib/wcag';
import { AccessibilityIssue } from '@/lib/claude';

interface PrincipleCardProps {
  principle: WcagPrinciple;
  issues: AccessibilityIssue[];
  isActive: boolean;
  onClick: () => void;
}

/** Sidebar card for a single WCAG principle. */
export function ProfileCard({ principle, issues, isActive, onClick }: PrincipleCardProps) {
  const criticalCount = issues.filter((i) => i.severity === 'Critical').length;
  const warningCount  = issues.filter((i) => i.severity === 'Warning').length;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '16px 14px',
        width: '100%',
        borderLeft:  isActive ? `3px solid ${principle.color}` : '3px solid transparent',
        borderRight: 'none',
        borderTop:   'none',
        borderBottom: '1px solid #1a1a2e',
        backgroundColor: isActive ? `${principle.color}11` : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s',
      }}
      aria-pressed={isActive}
      aria-label={`${principle.label} — ${criticalCount} critical, ${warningCount} warnings`}
    >
      {/* Icon */}
      <div
        style={{
          width: '36px', height: '36px',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: `${principle.color}22`,
          border: `1px solid ${principle.color}44`,
          borderRadius: '6px',
          fontSize: '18px',
        }}
        aria-hidden="true"
      >
        {principle.emoji}
      </div>

      {/* Label + badges */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          color: isActive ? '#fff' : '#9ca3af',
          marginBottom: '5px',
          lineHeight: 1.3,
        }}>
          {principle.label}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {criticalCount > 0 && (
            <span style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: '6px',
              color: '#ef4444', border: '1px solid #ef444466',
              borderRadius: '2px', padding: '2px 5px', lineHeight: 1.4,
            }}>
              {criticalCount} crit
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: '6px',
              color: '#f59e0b', border: '1px solid #f59e0b66',
              borderRadius: '2px', padding: '2px 5px', lineHeight: 1.4,
            }}>
              {warningCount} warn
            </span>
          )}
          {criticalCount === 0 && warningCount === 0 && (
            <span style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: '6px',
              color: '#10b981', border: '1px solid #10b98166',
              borderRadius: '2px', padding: '2px 5px', lineHeight: 1.4,
            }}>
              all pass
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
