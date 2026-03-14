'use client';

import { useState, useEffect } from 'react';
import { Profile } from '@/lib/profiles';

interface SimulationViewProps {
  profile: Profile;
  sessionId: string;
  hasScreenshot: boolean;
  onClose: () => void;
}

type Stage = 'loading-screenshot' | 'ready' | 'simulating' | 'done' | 'error';

export function SimulationView({ profile, sessionId, hasScreenshot, onClose }: SimulationViewProps) {
  const [stage, setStage] = useState<Stage>(hasScreenshot ? 'loading-screenshot' : 'ready');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imageBase64: string;
    mimeType: string;
    description: string;
  } | null>(null);

  // Auto-fetch screenshot from session on mount
  useEffect(() => {
    if (!hasScreenshot) return;

    fetch(`/api/screenshot/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Screenshot not available');
        return r.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setScreenshotBase64(dataUrl.split(',')[1]);
          setStage('ready');
        };
        reader.readAsDataURL(blob);
      })
      .catch((e) => {
        setError(e.message);
        setStage('error');
      });
  }, [sessionId, hasScreenshot]);

  const runSimulation = async () => {
    setStage('simulating');
    setError(null);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          profileId: profile.id,
          screenshotBase64,
          screenshotMimeType: 'image/png',
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Simulation failed');
      }

      const data = await response.json();
      setResult(data);
      setStage('done');
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.label} perspective simulation`}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl p-6 flex flex-col gap-5"
        style={{ backgroundColor: '#1a1a2e', border: `2px solid ${profile.color}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-white"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '13px' }}
            >
              {profile.emoji} {profile.label} Perspective
            </h2>
            <p className="text-gray-400 text-sm mt-1">{profile.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl transition-colors w-8 h-8 flex items-center justify-center rounded"
            aria-label="Close simulation"
          >
            ✕
          </button>
        </div>

        {/* Loading screenshot */}
        {stage === 'loading-screenshot' && (
          <div className="flex items-center justify-center gap-3 py-10">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${profile.color} transparent ${profile.color} ${profile.color}` }}
              aria-hidden="true"
            />
            <span className="text-gray-400 text-sm">Loading page screenshot...</span>
          </div>
        )}

        {/* Ready — show screenshot preview + generate button */}
        {stage === 'ready' && screenshotBase64 && (
          <div className="flex flex-col gap-4">
            <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid #2a2a4a' }}>
              <img
                src={`data:image/png;base64,${screenshotBase64}`}
                alt="Captured page screenshot"
                className="w-full"
              />
              <div
                className="absolute bottom-3 left-3 px-2 py-1 rounded text-xs text-white font-semibold"
                style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
              >
                Auto-captured screenshot
              </div>
            </div>
            <button
              onClick={runSimulation}
              className="w-full py-3 rounded-lg text-white font-bold hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: profile.color,
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '10px',
              }}
            >
              ▶ Generate {profile.label} Simulation
            </button>
          </div>
        )}

        {/* No screenshot available */}
        {stage === 'ready' && !screenshotBase64 && (
          <div
            className="rounded-lg p-6 text-center text-gray-400 text-sm"
            style={{ border: '1px dashed #2a2a4a' }}
          >
            Screenshot could not be captured automatically for this page.
            <br />
            <span className="text-xs text-gray-600 mt-1 block">
              This can happen with pages that block headless browsers or require login.
            </span>
          </div>
        )}

        {/* Simulating */}
        {stage === 'simulating' && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${profile.color} transparent ${profile.color} ${profile.color}` }}
              aria-hidden="true"
            />
            <span className="text-gray-400 text-sm">
              Generating <span style={{ color: profile.color }}>{profile.label}</span> simulation…
            </span>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div
            className="p-4 rounded-lg text-red-300 text-sm"
            style={{ backgroundColor: '#ef444422', border: '1px solid #ef444466' }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Result: generated perspective only */}
        {stage === 'done' && result && (
          <div className="flex flex-col gap-5">
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: `1px solid ${profile.color}66` }}
            >
              <img
                src={`data:${result.mimeType};base64,${result.imageBase64}`}
                alt={`Page as experienced by ${profile.label} users`}
                className="w-full"
              />
            </div>

            {result.description && (
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: '#0f0f1a', border: '1px solid #2a2a4a' }}
              >
                <h3 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                  AI Analysis — {profile.label} Experience
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{result.description}</p>
              </div>
            )}

            <button
              onClick={() => setStage('ready')}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors self-center"
            >
              ↩ Re-generate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
