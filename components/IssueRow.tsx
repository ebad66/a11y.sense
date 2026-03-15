'use client';

import { useMemo, useState } from 'react';
import { AccessibilityIssue } from '@/lib/claude';

interface IssueRowProps {
  issue: AccessibilityIssue;
  index: number;
}

const SEVERITY_CONFIG = {
  Critical: {
    text: 'Critical',
    chip: 'bg-red-500/15 text-red-200 border-red-400/50',
    dot: 'bg-red-400',
  },
  Warning: {
    text: 'Warning',
    chip: 'bg-amber-500/15 text-amber-200 border-amber-400/50',
    dot: 'bg-amber-400',
  },
  Pass: {
    text: 'Pass',
    chip: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/50',
    dot: 'bg-emerald-400',
  },
};

export function IssueRow({ issue, index }: IssueRowProps) {
  const [expanded, setExpanded] = useState(index < 2);
  const config = SEVERITY_CONFIG[issue.severity];

  const evidenceLabel = useMemo(() => {
    if (issue.selector) return 'Exact selector evidence';
    if (issue.element) return 'Element snippet evidence';
    return 'Heuristic evidence only';
  }, [issue.element, issue.selector]);

  return (
    <article className="border-b border-slate-800/80 py-1">
      <button
        type="button"
        className="w-full text-left px-1 py-3 flex items-start gap-3 hover:bg-slate-900/40 rounded-md"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        aria-label={`${issue.severity}: ${issue.title}. ${expanded ? 'Collapse' : 'Expand'} details`}
      >
        <span className={`mt-1.5 inline-block size-2 rounded-full ${config.dot}`} aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] border rounded-full px-2 py-0.5 font-semibold ${config.chip}`}>
              {config.text}
            </span>
            {issue.wcag && <span className="text-xs text-slate-300">{issue.wcag}</span>}
            {issue.confidence && (
              <span className="text-[11px] text-slate-300 border border-slate-600 rounded-full px-2 py-0.5">
                Confidence: {issue.confidence}
              </span>
            )}
            {issue.effort && (
              <span className="text-[11px] text-slate-300 border border-slate-600 rounded-full px-2 py-0.5">
                Effort: {issue.effort}
              </span>
            )}
          </div>

          <h3 className="mt-2 text-sm sm:text-[15px] font-medium text-slate-100 leading-snug">{issue.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{evidenceLabel}</p>
        </div>

        <span className="text-slate-500 pt-1 text-lg leading-none" aria-hidden="true">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="px-6 pb-4">
          <p className="text-sm text-slate-200 leading-relaxed">{issue.description}</p>

          {issue.affectedUsers && issue.affectedUsers.length > 0 && (
            <div className="mt-3 text-xs text-slate-300">
              <span className="font-semibold text-slate-100">Impacted users:</span>{' '}
              {issue.affectedUsers.join(', ')}
            </div>
          )}

          <div className="mt-3 rounded-md border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-100 leading-relaxed">
            <p className="text-[11px] uppercase tracking-wide text-indigo-200 font-semibold mb-1">Recommended fix</p>
            {issue.fix}
          </div>

          {issue.rationale && (
            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-100">Why this matters:</span> {issue.rationale}
            </p>
          )}

          {issue.selector && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">CSS selector</p>
              <code className="block rounded bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-cyan-200 overflow-x-auto">
                {issue.selector}
              </code>
            </div>
          )}

          {!issue.selector && issue.element && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">HTML evidence</p>
              <code className="block rounded bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-cyan-200 overflow-x-auto whitespace-pre-wrap">
                {issue.element}
              </code>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
