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
  const criticalCount = issues.filter((issue) => issue.severity === 'Critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'Warning').length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border rounded-lg transition-colors ${
        isActive
          ? 'bg-slate-800/80 border-slate-500/80'
          : 'bg-slate-900/40 border-slate-700/60 hover:border-slate-500/70'
      }`}
      aria-pressed={isActive}
      aria-label={`${principle.label}: ${criticalCount} critical, ${warningCount} warnings`}
    >
      <div className="flex items-start gap-3">
        <div
          className="size-10 shrink-0 rounded-lg border flex items-center justify-center text-lg"
          style={{
            backgroundColor: `${principle.color}22`,
            borderColor: `${principle.color}66`,
          }}
          aria-hidden="true"
        >
          {principle.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{principle.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">WCAG {principle.guidelines}</p>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-red-400/50 bg-red-500/15 px-2 py-0.5 text-red-200">
              {criticalCount} critical
            </span>
            <span className="rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-amber-200">
              {warningCount} warnings
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
