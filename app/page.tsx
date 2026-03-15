'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WCAG_PRINCIPLES } from '@/lib/wcag';
import { readApiErrorMessage } from '@/lib/api';

const EXAMPLE_URLS = ['https://gov.uk', 'https://bbc.com', 'https://github.com', 'https://wikipedia.org'];

const VALUE_POINTS = [
  {
    title: 'Evidence-backed findings',
    description:
      'Every issue includes WCAG references, affected element clues, and a practical remediation path.',
  },
  {
    title: 'Prioritized remediation queue',
    description:
      'Critical blockers are surfaced first so teams can fix what matters before polishing lower-risk items.',
  },
  {
    title: 'Visual proof for stakeholders',
    description:
      'View issue pins over a rendered screenshot to align product, design, and engineering quickly.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const scanDisabled = isScanning || !url.trim();

  const scanChecklist = useMemo(
    () => [
      'Load rendered page and screenshot',
      'Run WCAG analysis across POUR principles',
      'Map issues to page coordinates',
      'Generate prioritized report',
    ],
    []
  );

  const handleScan = async (e: FormEvent | null, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = (overrideUrl || url).trim();
    if (!targetUrl) return;

    setIsScanning(true);
    setError(null);
    setProgress('Preparing scan request...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      setProgress('Capturing page and running analysis...');
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readApiErrorMessage(data, 'Scan failed. Please try again.'));
      }

      setProgress('Opening report...');
      router.push(`/scan/${data.sessionId}`);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setError('Scan timed out after 120 seconds. Please retry or use a simpler page URL.');
      } else {
        setError((err as Error).message);
      }
      setIsScanning(false);
      setProgress('');
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b1020] text-slate-100 px-4 py-10 sm:py-14">
      <a
        href="#scan-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:bg-indigo-600 focus:text-white"
      >
        Skip to scan form
      </a>

      <div className="mx-auto max-w-6xl">
        <header className="mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            <span aria-hidden="true">🧭</span>
            WCAG 2.1 analysis with evidence and prioritization
          </div>

          <h1 className="mt-5 text-3xl sm:text-5xl font-semibold tracking-tight text-white max-w-4xl leading-tight">
            a11y.sense helps teams find and fix accessibility blockers with actionable proof.
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300 text-sm sm:text-base leading-relaxed">
            Scan any live URL and get a structured report grouped by POUR principles, severity, and evidence.
            Built for developers, product teams, and demo environments where trust matters.
          </p>

          <div className="mt-6 flex flex-wrap gap-2" aria-label="WCAG principles covered">
            {WCAG_PRINCIPLES.map((principle) => (
              <span
                key={principle.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm"
                style={{
                  borderColor: `${principle.color}77`,
                  backgroundColor: `${principle.color}1a`,
                  color: '#f8fafc',
                }}
              >
                <span aria-hidden="true">{principle.emoji}</span>
                {principle.label}
                <span className="text-slate-300">({principle.guidelines})</span>
              </span>
            ))}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div
            id="scan-form"
            className="rounded-2xl border border-slate-700/70 bg-slate-900/70 backdrop-blur-sm p-5 sm:p-7"
          >
            <h2 className="text-lg sm:text-xl font-semibold text-white">Start a scan</h2>
            <p className="mt-1 text-sm text-slate-300">
              Enter a public URL. The scan usually completes in 20–60 seconds, depending on page complexity.
            </p>

            <form onSubmit={handleScan} className="mt-5 flex flex-col gap-4">
              <label htmlFor="url-input" className="text-sm text-slate-200 font-medium">
                Website URL
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="url-input"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com"
                  required
                  disabled={isScanning}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-400 disabled:opacity-60"
                  aria-describedby="url-hint"
                />
                <button
                  type="submit"
                  disabled={scanDisabled}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-5 py-3 text-xs sm:text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-400 transition-colors"
                  aria-label={isScanning ? 'Scanning in progress' : 'Start accessibility scan'}
                >
                  {isScanning ? 'Scanning…' : 'Run scan'}
                </button>
              </div>

              <p id="url-hint" className="text-xs text-slate-400">
                Private/local hosts are blocked for safety. Use publicly reachable pages only.
              </p>
            </form>

            {isScanning && progress && (
              <div className="mt-4 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-3" role="status" aria-live="polite">
                <div className="flex items-center gap-2 text-sm text-indigo-100">
                  <span
                    className="inline-block size-3 rounded-full border-2 border-indigo-300 border-t-transparent animate-spin"
                    aria-hidden="true"
                  />
                  {progress}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
                <strong className="font-semibold">Scan failed:</strong> {error}
              </div>
            )}

            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Try an example</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLE_URLS.map((exampleUrl) => (
                  <button
                    key={exampleUrl}
                    type="button"
                    disabled={isScanning}
                    onClick={() => {
                      setUrl(exampleUrl);
                      void handleScan(null, exampleUrl);
                    }}
                    className="rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 hover:border-indigo-400 hover:text-white disabled:opacity-50"
                  >
                    {exampleUrl.replace('https://', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-white">What the report includes</h2>
            <ul className="mt-4 space-y-3">
              {scanChecklist.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-slate-500 text-[11px] text-slate-200">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Credibility notes</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-300 leading-relaxed">
                <li>• Findings are AI-assisted and should be verified with deterministic tools before compliance sign-off.</li>
                <li>• Every issue is linked to WCAG context and a suggested remediation path.</li>
                <li>• Report links are session-based and currently retained in-memory for 24 hours.</li>
              </ul>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {VALUE_POINTS.map((point) => (
            <article key={point.title} className="rounded-xl border border-slate-700/70 bg-slate-900/55 p-4">
              <h3 className="text-sm font-semibold text-white">{point.title}</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">{point.description}</p>
            </article>
          ))}
        </section>

        <footer className="mt-10 border-t border-slate-800 pt-5 text-xs text-slate-400">
          Powered by Next.js, Playwright, and Gemini-based analysis. Built for practical remediation workflows.
        </footer>
      </div>
    </main>
  );
}
