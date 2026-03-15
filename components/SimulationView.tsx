'use client';

import { useEffect, useRef, useState } from 'react';
import { Profile } from '@/lib/profiles';
import { readApiErrorMessage } from '@/lib/api';

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
    type?: 'html';
    html?: string;
    imageBase64?: string;
    mimeType?: string;
    description: string;
  } | null>(null);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Auto-fetch screenshot from session on mount
  useEffect(() => {
    if (!hasScreenshot) return;

    fetch(`/api/screenshot/${sessionId}`)
      .then((response) => {
        if (!response.ok) throw new Error('Screenshot not available');
        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setScreenshotBase64(dataUrl.split(',')[1]);
          setStage('ready');
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        setError(err.message);
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

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readApiErrorMessage(data, 'Simulation failed'));
      }

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
      style={{ backgroundColor: 'rgba(2,6,23,0.86)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.label} perspective simulation`}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl p-6 flex flex-col gap-5"
        style={{ backgroundColor: '#131a2f', border: `2px solid ${profile.color}` }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-white text-lg font-semibold">
              {profile.emoji} {profile.label} perspective
            </h2>
            <p className="text-slate-300 text-sm mt-1">{profile.description}</p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-slate-300 hover:text-white text-xl transition-colors w-9 h-9 flex items-center justify-center rounded border border-slate-600"
            aria-label="Close simulation"
          >
            ✕
          </button>
        </div>

        {stage === 'loading-screenshot' && (
          <div className="flex items-center justify-center gap-3 py-10">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${profile.color} transparent ${profile.color} ${profile.color}` }}
              aria-hidden="true"
            />
            <span className="text-slate-300 text-sm">Loading page screenshot...</span>
          </div>
        )}

        {stage === 'ready' && screenshotBase64 && (
          <div className="flex flex-col gap-4">
            <div className="relative rounded-lg overflow-hidden border border-slate-700">
              <img
                src={`data:image/png;base64,${screenshotBase64}`}
                alt="Captured page screenshot"
                className="w-full"
              />
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded text-xs text-white font-semibold bg-black/70">
                Auto-captured screenshot
              </div>
            </div>
            <button
              onClick={runSimulation}
              className="w-full py-3 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: profile.color }}
            >
              Generate {profile.label} simulation
            </button>
          </div>
        )}

        {stage === 'ready' && !screenshotBase64 && (
          <div className="rounded-lg p-6 text-center text-slate-300 text-sm border border-dashed border-slate-700">
            Screenshot could not be captured automatically for this page.
            <br />
            <span className="text-xs text-slate-400 mt-1 block">
              This can happen when a page blocks headless browsers or requires authentication.
            </span>
          </div>
        )}

        {stage === 'simulating' && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${profile.color} transparent ${profile.color} ${profile.color}` }}
              aria-hidden="true"
            />
            <span className="text-slate-300 text-sm">Generating simulation…</span>
          </div>
        )}

        {stage === 'error' && (
          <div className="p-4 rounded-lg text-red-200 text-sm bg-red-500/15 border border-red-500/40" role="alert">
            {error}
          </div>
        )}

        {stage === 'done' && result && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg overflow-hidden border border-slate-700">
              {result.type === 'html' ? (
                <iframe
                  srcDoc={result.html}
                  sandbox="allow-scripts"
                  className="w-full"
                  style={{ height: '560px', border: 'none', display: 'block' }}
                  title={`${profile.label} simulation`}
                />
              ) : (
                <img
                  src={`data:${result.mimeType};base64,${result.imageBase64}`}
                  alt={`Page as experienced by ${profile.label} users`}
                  className="w-full"
                />
              )}
            </div>

            {result.description && (
              <div className="rounded-lg p-4 bg-slate-950 border border-slate-700">
                <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">
                  AI analysis — {profile.label} experience
                </h3>
                <p className="text-slate-200 text-sm leading-relaxed">{result.description}</p>
              </div>
            )}

            <button
              onClick={() => setStage('ready')}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors self-center"
            >
              Re-generate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
