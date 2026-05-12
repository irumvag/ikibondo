import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <p
        className="text-8xl font-bold mb-4 select-none"
        style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--bg-sand)' }}
        aria-hidden="true"
      >
        404
      </p>
      <h1
        className="text-2xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
      >
        Page not found
      </h1>
      <p className="text-sm mb-8 max-w-xs" style={{ color: 'var(--text-muted)' }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
        >
          Go home
        </Link>
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-[var(--bg-elev)]"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
