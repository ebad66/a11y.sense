'use client';

import { Profile } from '@/lib/profiles';
import { AccessibilityIssue } from '@/lib/claude';

interface ProfileCardProps {
  profile: Profile;
  issues: AccessibilityIssue[];
  isActive: boolean;
  onClick: () => void;
}

export function ProfileCard({ profile, issues, isActive, onClick }: ProfileCardProps) {
  const criticalCount = issues.filter((i) => i.severity === 'Critical').length;
  const warningCount = issues.filter((i) => i.severity === 'Warning').length;

  const badgeColor =
    criticalCount > 0
      ? '#ef4444'
      : warningCount > 0
      ? '#f59e0b'
      : '#10b981';

  const badgeText =
    criticalCount > 0
      ? criticalCount.toString()
      : warningCount > 0
      ? warningCount.toString()
      : '✓';

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
      style={{
        backgroundColor: isActive ? `${profile.color}22` : '#1a1a2e',
        borderColor: isActive ? profile.color : '#2a2a4a',
        minWidth: '120px',
      }}
      aria-pressed={isActive}
      aria-label={`${profile.label} profile - ${criticalCount} critical, ${warningCount} warnings`}
    >
      {/* Pixel badge */}
      <span
        className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center text-xs font-bold text-white rounded-sm z-10"
        style={{
          backgroundColor: badgeColor,
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          imageRendering: 'pixelated',
          boxShadow: `2px 2px 0px rgba(0,0,0,0.5)`,
        }}
        aria-hidden="true"
      >
        {badgeText}
      </span>

      {/* Profile emoji / avatar */}
      <div
        className="w-12 h-12 flex items-center justify-center rounded-md text-2xl"
        style={{
          backgroundColor: `${profile.color}33`,
          border: `2px solid ${profile.color}66`,
        }}
        aria-hidden="true"
      >
        {profile.emoji}
      </div>

      {/* Label */}
      <span
        className="text-white font-bold"
        style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '9px',
          lineHeight: '1.4',
          textAlign: 'center',
        }}
      >
        {profile.label}
      </span>

      {/* Issue counts */}
      <div className="flex gap-1 text-xs">
        {criticalCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-white font-semibold" style={{ backgroundColor: '#ef444466', fontSize: '10px' }}>
            {criticalCount} crit
          </span>
        )}
        {warningCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-white font-semibold" style={{ backgroundColor: '#f59e0b66', fontSize: '10px' }}>
            {warningCount} warn
          </span>
        )}
        {criticalCount === 0 && warningCount === 0 && (
          <span className="px-1.5 py-0.5 rounded text-white font-semibold" style={{ backgroundColor: '#10b98166', fontSize: '10px' }}>
            all pass
          </span>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `8px solid ${profile.color}`,
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
