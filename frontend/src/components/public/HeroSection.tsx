import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Heart, Activity } from 'lucide-react';

// ── Hero photo panel ──────────────────────────────────────────────────────────

function HeroPhoto() {
  return (
    <div
      className="relative w-full"
      style={{ maxWidth: 520, margin: '0 auto' }}
    >
      {/* Decorative background ring */}
      <div
        className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
        style={{
          background: 'var(--bg-sand)',
          transform: 'rotate(3deg) scale(1.04)',
          border: '1px solid var(--border)',
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Gold accent circle — top-left */}
      <div
        className="absolute -top-5 -left-5 w-20 h-20 rounded-full pointer-events-none"
        style={{
          background: 'var(--accent)',
          opacity: 0.18,
          animation: 'hero-blob-pulse 6s ease-in-out infinite',
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Teal accent circle — bottom-right */}
      <div
        className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
        style={{
          background: 'var(--ink)',
          opacity: 0.12,
          animation: 'hero-blob-pulse 8s ease-in-out 2s infinite reverse',
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Photo frame */}
      <div
        className="relative overflow-hidden rounded-[2rem] hero-fade-up"
        style={{
          boxShadow: 'var(--shadow-xl)',
          zIndex: 1,
          animationDelay: '0.15s',
          aspectRatio: '4 / 5',
        }}
      >
        <Image
          src="/hero-photo.jpg"
          alt="A mother holding her baby in Ruduha Village, Rwanda"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 520px"
          className="object-cover object-center"
          style={{ transform: 'scale(1.02)' }}
        />

        {/* Subtle bottom gradient overlay */}
        <div
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(8,80,65,0.45) 0%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        {/* Bottom caption inside photo */}
        <div
          className="absolute bottom-0 inset-x-0 px-5 py-4 flex items-center gap-3"
          aria-hidden="true"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className="absolute inline-flex h-full w-full rounded-full"
              style={{
                background: '#4ade80',
                opacity: 0.5,
                animation: 'hero-live-pulse 1.8s ease-in-out infinite',
              }}
            />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#4ade80' }} />
          </span>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.01em' }}>
            Ruduha Village · Rwanda
          </p>
        </div>
      </div>

      {/* ── Floating badge — Secure records (top-left) ── */}
      <div
        className="absolute -left-6 top-[14%] z-10 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl pointer-events-none"
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          animation: 'hero-slide-right 0.65s cubic-bezier(.22,1,.36,1) 0.9s both, hero-float 5s ease-in-out 1.6s infinite',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--low-bg)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>Secure records</p>
          <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: 2 }}>End-to-end encrypted</p>
        </div>
      </div>

      {/* ── Floating badge — WHO Standards (right-middle) ── */}
      <div
        className="absolute -right-5 top-[40%] z-10 flex items-center gap-2 px-3.5 py-2 rounded-xl pointer-events-none"
        style={{
          background: 'var(--ink)',
          boxShadow: '0 8px 24px rgba(0,0,0,.28)',
          animation: 'hero-slide-left 0.65s cubic-bezier(.22,1,.36,1) 1.1s both, hero-float 6s ease-in-out 2s infinite',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="var(--accent)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--bg)', whiteSpace: 'nowrap' }}>
          WHO Standards
        </span>
      </div>

      {/* ── Floating badge — Offline-first (bottom-left) ── */}
      <div
        className="absolute -left-4 bottom-[18%] z-10 flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl pointer-events-none"
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          animation: 'hero-slide-right 0.65s cubic-bezier(.22,1,.36,1) 1.3s both, hero-float 4.5s ease-in-out 1.2s infinite',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--bg-sand)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 7 13 17 8 12 1 18" />
            <polyline points="16 7 23 7 23 14" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>ML risk scoring</p>
          <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: 2 }}>Real-time alerts</p>
        </div>
      </div>

      {/* ── Floating badge — Works offline (bottom-right) ── */}
      <div
        className="absolute -right-3 bottom-[28%] z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl pointer-events-none"
        style={{
          background: 'var(--low-bg)',
          border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)',
          boxShadow: 'var(--shadow-sm)',
          animation: 'hero-slide-left 0.65s cubic-bezier(.22,1,.36,1) 1.5s both, hero-float 5.5s ease-in-out 2.5s infinite',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--success)', whiteSpace: 'nowrap' }}>
          Works offline
        </span>
      </div>
    </div>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────

export function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Dot-grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
          opacity: 0.7,
        }}
        aria-hidden="true"
      />

      {/* Teal ambient blob — top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-12rem', right: '-10rem',
          width: '40rem', height: '40rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--ink) 0%, transparent 68%)',
          opacity: 0.05,
          animation: 'hero-blob-pulse 8s ease-in-out infinite',
        }}
        aria-hidden="true"
      />

      {/* Gold ambient blob — bottom-left */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-8rem', left: '-8rem',
          width: '32rem', height: '32rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          opacity: 0.07,
          animation: 'hero-blob-pulse 10s ease-in-out 3s infinite reverse',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* ── Text column ── */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left hero-fade-up">

            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-7"
              style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--success)', animation: 'hero-live-pulse 2s ease-in-out infinite' }}
                aria-hidden="true"
              />
              Rwanda · Child Health Platform
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-[3.35rem] font-bold leading-tight tracking-tight mb-5"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              Healthy children,{' '}
              <span style={{
                color: 'transparent',
                WebkitTextStroke: '1.5px var(--ink)',
                display: 'inline-block',
              }}>
                stronger
              </span>{' '}
              communities
            </h1>

            <p className="text-lg sm:text-xl leading-relaxed mb-9 max-w-lg" style={{ color: 'var(--text-muted)' }}>
              Ikibondo empowers community health workers, nurses, and supervisors
              to monitor child nutrition and detect malnutrition early — across
              Rwanda&apos;s refugee camps.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-10">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all hover:opacity-90 active:scale-[.98]"
                style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
              >
                Sign in <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold border transition-colors hover:bg-[var(--bg-sand)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
              >
                How it works
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 text-sm"
                 style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <Shield size={15} style={{ color: 'var(--success)' }} aria-hidden="true" />
                WHO growth standards
              </span>
              <span className="flex items-center gap-1.5">
                <Heart size={15} style={{ color: 'var(--danger)' }} aria-hidden="true" />
                Offline-first for CHWs
              </span>
              <span className="flex items-center gap-1.5">
                <Activity size={15} style={{ color: 'var(--warn)' }} aria-hidden="true" />
                ML-powered risk scoring
              </span>
            </div>
          </div>

          {/* ── Photo ── */}
          <div className="flex items-center justify-center lg:justify-end">
            <HeroPhoto />
          </div>

        </div>
      </div>
    </section>
  );
}
