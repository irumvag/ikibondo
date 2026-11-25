'use client';

import { AlertTriangle } from 'lucide-react';

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--high-bg)' }}
      >
        <AlertTriangle size={24} style={{ color: 'var(--danger)' }} aria-hidden="true" />
      </div>
      <div>
        <h2
          className="text-xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Something went wrong
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          This section encountered an error. You can try reloading it.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
      >
        Try again
      </button>
    </div>
  );
}
