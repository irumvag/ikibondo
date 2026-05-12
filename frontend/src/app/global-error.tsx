'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#fafaf8',
          color: '#1a1a18',
        }}
      >
        <p style={{ fontSize: '4rem', fontWeight: 700, color: '#e5e3db', margin: '0 0 0.5rem' }} aria-hidden="true">
          :(
        </p>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6b6b67', margin: '0 0 2rem', maxWidth: '24rem' }}>
          An unexpected error occurred. Please try reloading the page.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: '0.75rem',
            border: 'none',
            backgroundColor: '#1a1a18',
            color: '#fafaf8',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
