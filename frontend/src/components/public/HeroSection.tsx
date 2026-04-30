import Link from 'next/link';
import { ArrowRight, Shield, Heart, Activity } from 'lucide-react';

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg)' }}
    >
      {/* Subtle dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
          opacity: 0.7,
        }}
        aria-hidden="true"
      />

      {/* Decorative glow — top-right */}
      <div
        className="absolute -top-32 -right-32 w-[30rem] h-[30rem] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)',
          opacity: 0.07,
        }}
        aria-hidden="true"
      />
      {/* Decorative glow — bottom-left */}
      <div
        className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--ink) 0%, transparent 65%)',
          opacity: 0.07,
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 flex flex-col items-center text-center">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-8"
          style={{
            backgroundColor: 'var(--bg-sand)',
            color: 'var(--ink)',
            border: '1px solid var(--border)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: 'var(--success)' }}
            aria-hidden="true"
          />
          UNHCR · Rwanda · Child Health
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6 max-w-4xl"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Healthy children,{' '}
          <span style={{ color: 'var(--ink-soft)' }}>stronger</span>{' '}
          communities
        </h1>

        {/* Subtext */}
        <p
          className="text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl"
          style={{ color: 'var(--text-muted)' }}
        >
          Ikibondo empowers community health workers, nurses, and supervisors to
          monitor child nutrition and detect malnutrition risk early — across
          Rwanda&apos;s refugee camps.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all hover:opacity-90 active:scale-[.98]"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
          >
            Sign in
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold border transition-colors hover:bg-[var(--bg-sand)]"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
          >
            Learn more
          </Link>
        </div>

        {/* Trust indicators */}
        <div
          className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <div className="flex items-center gap-2">
            <Shield
              size={16}
              aria-hidden="true"
              style={{ color: 'var(--success)' }}
            />
            <span>WHO growth standards</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart
              size={16}
              aria-hidden="true"
              style={{ color: 'var(--danger)' }}
            />
            <span>Designed for field CHWs</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity
              size={16}
              aria-hidden="true"
              style={{ color: 'var(--accent)', filter: 'brightness(0.75)' }}
            />
            <span>ML-powered risk scoring</span>
          </div>
        </div>

      </div>
    </section>
  );
}
