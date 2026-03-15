'use client';

import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { WCAGPanels } from './WCAGPanels';
import { IssuePanel } from './IssuePanel';
import { SkeletonViewer } from './SkeletonViewer';
import { BodyRegion, VisualizerIssue } from '@/visualization/types';
import { inferPrinciple } from '@/visualization/bodyPartMapping';
import { AccessibilityIssue } from '@/lib/claude';
import { ProfileId } from '@/lib/profiles';

interface VisualizerDashboardProps {
  // Pass all the profiles' issues
  issuesMap: Record<ProfileId, AccessibilityIssue[]>;
}

export function VisualizerDashboard({ issuesMap }: VisualizerDashboardProps) {
  const [activeRegion, setActiveRegion] = useState<BodyRegion | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

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

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 44px)', overflow: 'hidden', backgroundColor: '#0f0f1a' }}>
      
      {/* Left Column: WCAG Panels */}
      <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid #1a1a2e', backgroundColor: '#0f0f1a' }}>
        <WCAGPanels 
          issues={allIssues}
          activeRegion={activeRegion}
          onRegionSelect={setActiveRegion}
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
                 onRegionSelect={setActiveRegion}
               />
            </React.Suspense>
         </Canvas>
         
         {/* Overlay UI inside Canvas area */}
         <div style={{ position: 'absolute', top: '16px', left: '16px', pointerEvents: 'none' }}>
            <h2 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: '#fff', margin: 0 }}>
               A11Y.SENSE VISUALIZER
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '11px', marginTop: '8px' }}>
               Interact with body systems to isolate issues.
            </p>
         </div>
      </div>

      {/* Right Column: Issue Details */}
      <div style={{ width: '360px', flexShrink: 0, borderLeft: '1px solid #1a1a2e', backgroundColor: '#0f0f1a' }}>
        <IssuePanel 
          issue={selectedIssue}
          onClose={() => setSelectedIssueId(null)}
        />
      </div>

    </div>
  );
}
