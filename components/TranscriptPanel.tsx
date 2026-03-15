'use client';

import { useMemo, useState } from 'react';
import { JourneyRun } from '@/lib/journey';
import { JourneyTranscript, TranscriptViewMode } from '@/lib/sr-transcript';

interface TranscriptPanelProps {
  journeyRun: JourneyRun | null;
  transcript: JourneyTranscript | null;
}

export function TranscriptPanel({ journeyRun, transcript }: TranscriptPanelProps) {
  const [mode, setMode] = useState<TranscriptViewMode>('plain');

  const activeStepId = journeyRun?.steps[0]?.id;
  const stepEvents = useMemo(
    () => transcript?.events.filter((e) => !activeStepId || e.journeyStepId === activeStepId) ?? [],
    [transcript, activeStepId]
  );

  if (!journeyRun || !transcript) {
    return (
      <section style={{ borderTop: '1px solid #1a1a2e', padding: '14px 16px', backgroundColor: '#0b0b16' }}>
        <p style={{ color: '#6b7280', fontSize: '12px' }}>Screen-reader transcript unavailable for this run.</p>
      </section>
    );
  }

  const download = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section style={{ borderTop: '1px solid #1a1a2e', backgroundColor: '#0b0b16', padding: '12px 16px', maxHeight: '36vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: 13 }}>Screen-reader Simulation Transcript</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMode('plain')} style={btn(mode === 'plain')}>Plain English</button>
          <button onClick={() => setMode('technical')} style={btn(mode === 'technical')}>Technical</button>
          <button onClick={() => download(`transcript-${journeyRun.id}.json`, transcript.export.json, 'application/json')} style={btn(false)}>Export JSON</button>
          <button onClick={() => download(`transcript-${journeyRun.id}.txt`, transcript.export.text, 'text/plain')} style={btn(false)}>Export text</button>
        </div>
      </div>

      <p style={{ color: '#9ca3af', fontSize: 12, margin: '8px 0 6px' }}>
        What users likely experience: {transcript.plainEnglishSummary}
      </p>
      <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 10px' }}>
        Top confusion moments: {transcript.confusionFlags.length} | confidence: {Math.round(transcript.confidence * 100)}%
      </p>

      {transcript.confusionFlags.length > 0 && (
        <ul style={{ margin: '0 0 10px 16px', color: '#fca5a5', fontSize: 11 }}>
          {transcript.confusionFlags.slice(0, 3).map((f) => (
            <li key={f.id}>{f.type}: {f.rationale}</li>
          ))}
        </ul>
      )}

      <div style={{ display: 'grid', gap: 6 }}>
        {stepEvents.map((event) => (
          <div key={event.id} style={{ border: '1px solid #1f2937', borderRadius: 6, padding: '8px 10px', backgroundColor: '#0f172a66' }}>
            <div style={{ color: '#94a3b8', fontSize: 10 }}>
              {event.journeyStepId} · {event.triggerAction}
            </div>
            <div style={{ color: '#e2e8f0', fontSize: 12 }}>
              {mode === 'plain' ? event.plainEnglish : event.technical}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function btn(active: boolean) {
  return {
    border: `1px solid ${active ? '#6366f1' : '#334155'}`,
    color: active ? '#a5b4fc' : '#cbd5e1',
    backgroundColor: 'transparent',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
  } as const;
}
