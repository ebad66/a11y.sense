'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { WCAGPanels } from './WCAGPanels';
import { IssuePanel } from './IssuePanel';
import { SkeletonViewer } from './SkeletonViewer';
import { BodyRegion, VisualizerIssue } from '@/visualization/types';
import { inferPrinciple } from '@/visualization/bodyPartMapping';
import { AccessibilityIssue } from '@/lib/claude';
import { ProfileId } from '@/lib/profiles';

// bx/by are LEFT-EDGE percentages of the canvas width/height (no centering transform).
// Left safe zone: 2–22%  |  Right safe zone: 62–78% (leaves room for 240px bubble before stats panel)
// Hands: camera pans hard right so model fills the right half — left fringe only.
const REGION_IMPACT: Record<BodyRegion, {
  principle: string;
  color: string;
  bubbles: { text: string; bx: number; by: number; delay: number }[];
  stat: { main: string; caption: string; label: string; sub: string; ring: number };
  metricLabel: string;
  metricValue?: number;
}> = {
  EyesEars: {
    principle: 'Perceivable',
    color: '#f59e0b',
    bubbles: [
      { text: '👁  300M people are affected by colour blindness',    bx: 3,  by: 25, delay: 0   },
      { text: '👂  1.5B people have some degree of hearing loss',   bx: 63, by: 40, delay: 150 },
      { text: '🌍  15% of the global population is affected',       bx: 4,  by: 60, delay: 300 },
    ],
    stat: { main: '2.2B', caption: 'affected', label: 'People affected', sub: 'visual & hearing impairments worldwide', ring: 73 },
    metricLabel: 'Severity',
  },
  Hands: {
    principle: 'Operable',
    color: '#ef4444',
    bubbles: [
      { text: '✋  26% of US adults have at least one disability',    bx: 3,  by: 22, delay: 0   },
      { text: '⌨️  16% rely on keyboard-only navigation',            bx: 4,  by: 46, delay: 150 },
      { text: '🚪  71% leave inaccessible sites immediately',         bx: 3,  by: 66, delay: 300 },
    ],
    stat: { main: '1.3B', caption: 'affected', label: 'People affected', sub: 'motor & mobility impairments', ring: 60 },
    metricLabel: 'Severity',
  },
  Navigation: {
    principle: 'Navigation',
    color: '#38bdf8',
    bubbles: [
      { text: '⌨️  Keyboard paths expose blockers before users encounter them', bx: 64, by: 20, delay: 0 },
      { text: '🧭  Predictable routing and clear focus state are core navigation signals', bx: 63, by: 44, delay: 150 },
      { text: '↩️  Unexpected route changes break confidence fast on critical tasks', bx: 62, by: 66, delay: 300 },
    ],
    stat: { main: '3', caption: 'flows', label: 'Journey templates', sub: 'checkout, sign-up, and appointment paths', ring: 78 },
    metricLabel: 'Journey coverage',
    metricValue: 88,
  },
  Brain: {
    principle: 'Understandable',
    color: '#8b5cf6',
    bubbles: [
      { text: '🧠  Dyslexics read 25% slower on cluttered layouts',   bx: 3,  by: 23, delay: 0   },
      { text: '⚡  1 in 10 people globally has ADHD',                 bx: 64, by: 35, delay: 150 },
      { text: '📖  15–20% of the world has learning disabilities',    bx: 4,  by: 62, delay: 300 },
    ],
    stat: { main: '780M', caption: 'affected', label: 'Dyslexic users', sub: 'need readable, clear content', ring: 85 },
    metricLabel: 'Severity',
  },
  Spine: {
    principle: 'Robust',
    color: '#10b981',
    bubbles: [
      { text: '♿  Only 3% of websites meet full a11y standards',     bx: 3,  by: 21, delay: 0   },
      { text: '🔊  7.6M screen reader users in the US alone',         bx: 63, by: 37, delay: 150 },
      { text: '📡  AT market worth $26B globally',                    bx: 4,  by: 60, delay: 300 },
    ],
    stat: { main: '1B+', caption: 'affected', label: 'AT users affected', sub: 'rely on screen readers & assistive tech', ring: 91 },
    metricLabel: 'Severity',
  },
};

// Draggable impact bubble.
// Outer div  — owns position + drag offset. Never animates transform so drag always works.
// Inner div  — owns the float-in animation (opacity + Y only, no transform override on outer).
function DraggableBubble({ text, bx, by, delay, color, jitter }: {
  text: string; bx: number; by: number; delay: number; color: string;
  jitter: { x: number; y: number };
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [grabbing, setGrabbing] = useState(false);
  const origin = useRef<{ mx: number; my: number; dx: number; dy: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGrabbing(true);
    origin.current = { mx: e.clientX, my: e.clientY, dx: drag.x, dy: drag.y };
    const onMove = (ev: MouseEvent) => {
      if (!origin.current) return;
      setDrag({ x: origin.current.dx + ev.clientX - origin.current.mx,
                y: origin.current.dy + ev.clientY - origin.current.my });
    };
    const onUp = () => {
      origin.current = null;
      setGrabbing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    // Outer: position + drag — no animation touches this transform
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: `${bx + jitter.x}%`,
        top: `${by + jitter.y}%`,
        transform: `translate(${drag.x}px, ${drag.y}px)`,
        cursor: grabbing ? 'grabbing' : 'grab',
        userSelect: 'none',
        zIndex: 20,
      }}
    >
      {/* Inner: float-in animation (opacity + Y only — never overrides outer transform) */}
      <div style={{
        background: 'rgba(10, 10, 22, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${color}55`,
        borderRadius: '28px',
        padding: '12px 20px',
        color: '#e5e7eb',
        fontSize: '12px',
        width: '260px',
        lineHeight: '1.6',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        boxShadow: `0 0 18px ${color}22, inset 0 1px 0 rgba(255,255,255,0.04)`,
        animation: 'bubbleFloat 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        animationDelay: `${delay}ms`,
        opacity: 0,
      }}>
        {text}
      </div>
    </div>
  );
}

interface VisualizerDashboardProps {
  issuesMap: Record<ProfileId, AccessibilityIssue[]>;
  sessionUrl: string;
  pageTitle: string;
}

export function VisualizerDashboard({ issuesMap, sessionUrl, pageTitle }: VisualizerDashboardProps) {
  const [activeRegion, setActiveRegion] = useState<BodyRegion | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [bubbleKey, setBubbleKey] = useState(0);

  const handleRegionSelect = (region: BodyRegion | null) => {
    setActiveRegion(region);
    setSelectedIssueId(null);
  };

  // Re-mount bubbles on every region change so the float-in animation replays
  useEffect(() => {
    setBubbleKey(k => k + 1);
  }, [activeRegion]);

  // Fresh random jitter each time a region is selected so bubbles never land identically
  const jitter = useMemo(() =>
    [0, 1, 2].map(() => ({
      x: (Math.random() - 0.5) * 5,   // ±2.5% horizontal
      y: (Math.random() - 0.5) * 7,   // ±3.5% vertical
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [bubbleKey]);

  // Flatten all parsed issues into our normalized VisualizerIssue format
  const allIssues = useMemo(() => {
    let idCounter = 0;
    const flat: VisualizerIssue[] = [];

    // Combine issues from all profiles into one unified view 
    // for the 3D dashboard representation
    for (const [profileId, profileIssues] of Object.entries(issuesMap)) {
      for (const issue of profileIssues) {
        // Skip passes unless needed, but generally we want to visualize problems
        if (issue.severity === 'Pass') continue;

        flat.push({
          id: `${profileId}-${idCounter++}`,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          fix: issue.fix,
          element: issue.element,
          selector: issue.selector,
          wcag: issue.wcag,
          principle: inferPrinciple(issue),
        });
      }
    }
    return flat;
  }, [issuesMap]);

  const selectedIssue = useMemo(
    () => allIssues.find(i => i.id === selectedIssueId) || null,
    [allIssues, selectedIssueId]
  );

  const principleIssues = useMemo(
    () => selectedIssue ? allIssues.filter(i => i.principle === selectedIssue.principle) : [],
    [allIssues, selectedIssue]
  );

  // Severity % for the active principle — weighted: Critical=1.0, Warning=0.5, Minor=0.25
  const severityPct = useMemo(() => {
    if (!activeRegion) return 0;
    if (activeRegion === 'Navigation') return REGION_IMPACT.Navigation.metricValue ?? 0;
    const principle = REGION_IMPACT[activeRegion].principle;
    const regionIssues = allIssues.filter(i => i.principle === principle);
    if (regionIssues.length === 0) return 0;
    const score = regionIssues.reduce((acc, i) => {
      if (i.severity === 'Critical') return acc + 1;
      if (i.severity === 'Warning')  return acc + 0.5;
      return acc + 0.25;
    }, 0);
    return Math.min(100, Math.round((score / regionIssues.length) * 100));
  }, [allIssues, activeRegion]);

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 44px)', overflow: 'hidden', backgroundColor: '#0f0f1a' }}>
      
      {/* Left Column: WCAG Panels */}
      <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid #1a1a2e', backgroundColor: '#0f0f1a' }}>
        <WCAGPanels 
          issues={allIssues}
          activeRegion={activeRegion}
          onRegionSelect={handleRegionSelect}
          selectedIssueId={selectedIssueId}
          onIssueSelect={setSelectedIssueId}
        />
      </div>

      {/* Center Column: 3D Visualization */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
         <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }} style={{ width: '100%', height: '100%' }}>
            <React.Suspense fallback={null}>
               <SkeletonViewer 
                 issues={allIssues} 
                 activeRegion={activeRegion}
                 onRegionSelect={(region) => handleRegionSelect(region)}
               />
            </React.Suspense>
         </Canvas>
         
         {/* Overlay UI inside Canvas area */}
         <div style={{ position: 'absolute', top: '16px', left: '16px', pointerEvents: 'none' }}>
            <h2 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: '#fff', margin: 0 }}>
               A11Y.SENSE VISUALIZER
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '11px', marginTop: '8px' }}>
               Interact with body systems and journey diagnostics to isolate issues.
            </p>
         </div>

         {/* Impact overlays — appear when a principle is active */}
         {activeRegion && (() => {
           const impact = REGION_IMPACT[activeRegion];
           const R = 38;
           const circ = 2 * Math.PI * R;
           const arcOffset = circ * (1 - impact.stat.ring / 100);
           return (
             <>
               {/* Per-render keyframe so ring animates from empty → correct fill */}
               <style>{`
                 @keyframes ringDraw-${activeRegion} {
                   from { stroke-dashoffset: ${circ.toFixed(1)}; }
                   to   { stroke-dashoffset: ${arcOffset.toFixed(1)}; }
                 }
               `}</style>

               {/* Draggable impact bubbles — overflow:hidden is the hard boundary against the left border */}
               <div key={`bubbles-${bubbleKey}`} style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 10 }}>
                 {impact.bubbles.map((b, i) => (
                   <DraggableBubble
                     key={i}
                     text={b.text}
                     bx={b.bx}
                     by={b.by}
                     delay={b.delay}
                     color={impact.color}
                     jitter={jitter[i] ?? { x: 0, y: 0 }}
                   />
                 ))}
               </div>

               {/* Stats ring panel — top-right of canvas */}
               <div
                 key={`stat-${bubbleKey}`}
                 style={{
                   position: 'absolute',
                   top: '16px',
                   right: '16px',
                   width: '260px',
                   background: 'rgba(10, 10, 22, 0.92)',
                   backdropFilter: 'blur(16px)',
                   WebkitBackdropFilter: 'blur(16px)',
                   border: `1px solid ${impact.color}44`,
                   borderRadius: '16px',
                   padding: '18px 20px',
                   pointerEvents: 'none',
                   zIndex: 10,
                   boxShadow: `0 0 40px ${impact.color}18, inset 0 1px 0 rgba(255,255,255,0.05)`,
                   animation: 'statSlideIn 0.4s ease forwards',
                 }}
               >
                 {/* Principle label */}
                 <div style={{
                   fontFamily: '"Press Start 2P", monospace',
                   fontSize: '8px',
                   color: impact.color,
                   letterSpacing: '0.06em',
                   marginBottom: '14px',
                   textTransform: 'uppercase',
                 }}>
                   {impact.principle}
                 </div>

                 {/* Ring + main number */}
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <svg width="92" height="92" viewBox="0 0 92 92" style={{ flexShrink: 0 }}>
                     <circle cx="46" cy="46" r={R} fill="none" stroke="#1a1a2e" strokeWidth="6" />
                     <circle
                       cx="46" cy="46" r={R}
                       fill="none"
                       stroke={impact.color}
                       strokeWidth="6"
                       strokeLinecap="round"
                       strokeDasharray={`${circ}`}
                       strokeDashoffset={`${arcOffset}`}
                       transform="rotate(-90 46 46)"
                       style={{
                         filter: `drop-shadow(0 0 6px ${impact.color})`,
                         animation: `ringDraw-${activeRegion} 1s ease forwards`,
                         animationDelay: '100ms',
                       }}
                     />
                     <text x="46" y="41" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="700" fontFamily="system-ui">
                       {impact.stat.main}
                     </text>
                     <text x="46" y="55" textAnchor="middle" fill="#6b7280" fontSize="8" fontFamily="system-ui">
                       {impact.stat.caption}
                     </text>
                   </svg>

                   <div>
                     <div style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: 700, lineHeight: '1.3', marginBottom: '6px' }}>
                       {impact.stat.label}
                     </div>
                     <div style={{ color: '#9ca3af', fontSize: '11px', lineHeight: '1.5' }}>
                       {impact.stat.sub}
                     </div>
                   </div>
                 </div>

                 {/* Severity bar */}
                   <div style={{ marginTop: '16px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                     <span style={{ fontSize: '10px', color: '#6b7280' }}>{impact.metricLabel}</span>
                     <span style={{ fontSize: '10px', fontWeight: 600, color: impact.color }}>{severityPct}%</span>
                   </div>
                   <div style={{ height: '5px', background: '#1a1a2e', borderRadius: '3px', overflow: 'hidden' }}>
                     <div style={{
                       height: '100%',
                       width: `${severityPct}%`,
                       background: `linear-gradient(90deg, ${impact.color}88, ${impact.color})`,
                       borderRadius: '3px',
                       boxShadow: `0 0 8px ${impact.color}`,
                       animation: 'barGrow 1s ease forwards',
                     }} />
                   </div>
                 </div>
               </div>
             </>
           );
         })()}
      </div>

      {/* Right Column: Issue Details */}
      <div style={{ width: '360px', flexShrink: 0, borderLeft: '1px solid #1a1a2e', backgroundColor: '#0f0f1a' }}>
        <IssuePanel
          issue={selectedIssue}
          onClose={() => setSelectedIssueId(null)}
          principleIssues={principleIssues}
          sessionUrl={sessionUrl}
          pageTitle={pageTitle}
          activeRegion={activeRegion}
        />
      </div>

    </div>
  );
}
