'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PROFILES } from '@/lib/profiles';

const EXAMPLE_URLS = [
  'https://gov.uk',
  'https://bbc.com',
  'https://github.com',
  'https://wikipedia.org',
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const handleScan = async (e: FormEvent | null, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = overrideUrl || url;
    if (!targetUrl.trim()) return;

    setIsScanning(true);
    setError(null);
    setProgress('Fetching page...');

    try {
      setProgress('Scraping HTML & running accessibility audit...');
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scan failed');
      }

      setProgress('Redirecting to report...');
      router.push(`/scan/${data.sessionId}`);
    } catch (err) {
      setError((err as Error).message);
      setIsScanning(false);
      setProgress('');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Skip nav */}
      <a
        href="#scan-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:bg-indigo-600 focus:text-white"
      >
        Skip to scan form
      </a>

      {/* Header */}
      <div className="text-center mb-12 max-w-2xl">
        <div
          className="text-4xl mb-4"
          aria-hidden="true"
          style={{ letterSpacing: '-2px' }}
        >
          🔍
        </div>
        <h1
          className="mb-4 text-white leading-tight"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 'clamp(18px, 4vw, 28px)',
            lineHeight: '1.6',
          }}
        >
          InclusionLens
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed">
          Paste any URL. Get an AI-powered accessibility audit across 5 disability profiles —
          instantly.
        </p>

        {/* Profile preview pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-6" aria-label="Supported disability profiles">
          {PROFILES.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: `${p.color}33`, border: `1px solid ${p.color}66` }}
              suppressHydrationWarning
            >
              <span aria-hidden="true">{p.emoji}</span>
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Scan form */}
      <div
        id="scan-form"
        className="w-full max-w-2xl rounded-2xl p-8"
        style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a' }}
        suppressHydrationWarning
      >
        <form onSubmit={handleScan} className="flex flex-col gap-4">
          <label htmlFor="url-input" className="text-sm text-gray-400 font-medium">
            Website URL
          </label>
          <div className="flex gap-3">
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              disabled={isScanning}
              className="flex-1 px-4 py-3 rounded-lg text-white placeholder-gray-600 text-sm outline-none disabled:opacity-50"
              style={{
                backgroundColor: '#0f0f1a',
                border: '2px solid #2a2a4a',
                fontFamily: 'var(--font-inter)',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = '#2a2a4a')}
              aria-describedby="url-hint"
              suppressHydrationWarning
            />
            <button
              type="submit"
              disabled={isScanning || !url.trim()}
              className="px-6 py-3 rounded-lg text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: '#6366f1',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '10px',
                minWidth: '100px',
              }}
              aria-label={isScanning ? 'Scanning in progress' : 'Start accessibility scan'}
              suppressHydrationWarning
            >
              {isScanning ? (
                <span className="flex items-center gap-2 justify-center">
                  <span
                    className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  ...
                </span>
              ) : (
                'SCAN ▶'
              )}
            </button>
          </div>

          <p id="url-hint" className="text-xs text-gray-600">
            The page will be fetched and analyzed by Claude AI. This typically takes 20–40 seconds.
          </p>
        </form>

        {/* Progress message */}
        {isScanning && progress && (
          <div
            className="mt-4 px-4 py-3 rounded-lg text-sm text-indigo-300 flex items-center gap-3"
            style={{ backgroundColor: '#1e1e3f' }}
            role="status"
            aria-live="polite"
          >
            <span
              className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0"
              aria-hidden="true"
            />
            {progress}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            className="mt-4 px-4 py-3 rounded-lg text-sm text-red-300"
            style={{ backgroundColor: '#2d1515', border: '1px solid #ef444466' }}
            role="alert"
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Example URLs */}
        <div className="mt-6">
          <p className="text-xs text-gray-600 mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_URLS.map((exUrl) => (
              <button
                key={exUrl}
                type="button"
                onClick={() => {
                  setUrl(exUrl);
                  handleScan(null, exUrl);
                }}
                disabled={isScanning}
                className="text-xs px-3 py-1.5 rounded-md text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: '#0f0f1a', border: '1px solid #2a2a4a' }}
                suppressHydrationWarning
              >
                {exUrl.replace('https://', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-2xl w-full">
        {[
          {
            icon: '⚡',
            title: 'Parallel analysis',
            desc: 'All 5 profiles analyzed simultaneously via Claude AI',
          },
          {
            icon: '🎯',
            title: 'WCAG-referenced',
            desc: 'Issues mapped to specific WCAG 2.1 success criteria',
          },
          {
            icon: '👁️',
            title: 'Visual simulations',
            desc: 'See the page through each user\'s eyes via Gemini Vision',
          },
        ].map((feat) => (
          <div
            key={feat.title}
            className="rounded-xl p-4"
            style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a' }}
            suppressHydrationWarning
          >
            <div className="text-2xl mb-2" aria-hidden="true">{feat.icon}</div>
            <h3 className="text-white text-sm font-semibold mb-1">{feat.title}</h3>
            <p className="text-gray-500 text-xs leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-16 text-xs text-gray-700 text-center">
        Powered by Claude (Anthropic) · Gemini (Google) · Next.js
      </footer>
    </main>
  );
}
