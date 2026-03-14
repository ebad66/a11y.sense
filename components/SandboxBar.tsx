'use client';

import { useState } from 'react';

interface SandboxBarProps {
  url: string;
  sessionId: string;
  expiresAt: number;
  onRescan: (url: string) => void;
}

export function SandboxBar({ url, sessionId, expiresAt, onRescan }: SandboxBarProps) {
  const [copied, setCopied] = useState(false);
  const [editUrl, setEditUrl] = useState(url);

  const expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000 / 60 / 60));

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/scan/${sessionId}`
      : `/scan/${sessionId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRescan = () => {
    if (editUrl.trim()) {
      onRescan(editUrl.trim());
    }
  };

  return (
    <div
      className="w-full rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
      style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a' }}
    >
      {/* URL input */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-gray-500 text-xs flex-shrink-0" aria-hidden="true">🌐</span>
        <input
          type="url"
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRescan()}
          className="flex-1 bg-transparent text-gray-300 text-sm outline-none truncate min-w-0"
          aria-label="Page URL to scan"
          placeholder="https://example.com"
        />
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-gray-700" aria-hidden="true" />

      {/* Session info */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Session:</span>
        <code
          className="px-1.5 py-0.5 rounded font-mono text-gray-400"
          style={{ backgroundColor: '#0f0f1a' }}
        >
          {sessionId}
        </code>
        <span>·</span>
        <span
          className={expiresIn < 2 ? 'text-yellow-400' : 'text-gray-500'}
          aria-label={`Session expires in ${expiresIn} hours`}
        >
          ⏱ {expiresIn}h left
        </span>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-gray-700" aria-hidden="true" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-gray-300 hover:text-white transition-colors"
          style={{ backgroundColor: '#2a2a4a' }}
          aria-label="Copy share link"
        >
          {copied ? '✓ Copied' : '🔗 Share'}
        </button>
        <button
          onClick={handleRescan}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#6366f1' }}
          aria-label="Re-scan this URL"
        >
          ↺ Re-scan
        </button>
      </div>
    </div>
  );
}
