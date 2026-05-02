'use client';

import Link from 'next/link';

export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <h2
        className="text-xl font-bold"
        style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
      >
        Something went wrong
      </h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
        An unexpected error occurred. Please try again or return to the home page.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-[var(--bg-elev)]"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
