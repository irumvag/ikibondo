import Link from 'next/link';
import { ArrowRight, Shield, Heart, Activity } from 'lucide-react';

// ── Inline SVG illustration — sitting baby in teal onesie ─────────────────
function BabyIllustration() {
  return (
    <div
      className="relative w-full max-w-[460px] mx-auto select-none"
      style={{ aspectRatio: '1 / 1' }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 460 460"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Decorative outer ring */}
        <circle cx="230" cy="230" r="222" stroke="#FBC800" strokeWidth="1.5" strokeDasharray="7 5" opacity="0.4"/>

        {/* Background circle */}
        <circle cx="230" cy="230" r="206" fill="#F2EDE3"/>

        {/* Subtle WHO growth-chart grid */}
        <g opacity="0.07" stroke="#085041" strokeWidth="0.9">
          <line x1="76"  y1="55" x2="76"  y2="425"/>
          <line x1="153" y1="55" x2="153" y2="425"/>
          <line x1="230" y1="55" x2="230" y2="425"/>
          <line x1="307" y1="55" x2="307" y2="425"/>
          <line x1="384" y1="55" x2="384" y2="425"/>
          <path d="M30 370 C120 330 230 270 430 200" fill="none"/>
          <path d="M30 400 C120 365 230 315 430 255" fill="none"/>
        </g>

        {/* Baby torso / onesie */}
        <ellipse cx="230" cy="300" rx="66" ry="72" fill="#085041" opacity="0.85"/>

        {/* Onesie pocket detail */}
        <rect x="213" y="285" width="34" height="28" rx="6" fill="none" stroke="#0a6352" strokeWidth="1.5" opacity="0.6"/>

        {/* Neck */}
        <rect x="218" y="222" width="24" height="24" rx="12" fill="#C68642"/>

        {/* Head — large baby proportions */}
        <circle cx="230" cy="174" r="68" fill="#D4956A"/>

        {/* Ears */}
        <ellipse cx="165" cy="174" rx="14" ry="19" fill="#C67D4B"/>
        <ellipse cx="295" cy="174" rx="14" ry="19" fill="#C67D4B"/>
        <ellipse cx="165" cy="174" rx="8"  ry="13" fill="#D4956A" opacity="0.6"/>
        <ellipse cx="295" cy="174" rx="8"  ry="13" fill="#D4956A" opacity="0.6"/>

        {/* Hair — three tufts */}
        <path d="M204 113 Q212 96 224 106"  stroke="#3D1A00" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
        <path d="M224 106 Q232 93 244 103"  stroke="#3D1A00" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
        <path d="M244 103 Q256 97 263 111"  stroke="#3D1A00" strokeWidth="4.5" fill="none" strokeLinecap="round"/>

        {/* Eyes — left */}
        <ellipse cx="208" cy="170" rx="14" ry="16" fill="white"/>
        <circle  cx="208" cy="172" r="10"  fill="#3D1A00"/>
        <circle  cx="211" cy="169" r="3.5" fill="white"/>

        {/* Eyes — right */}
        <ellipse cx="252" cy="170" rx="14" ry="16" fill="white"/>
        <circle  cx="252" cy="172" r="10"  fill="#3D1A00"/>
        <circle  cx="255" cy="169" r="3.5" fill="white"/>

        {/* Eyelashes */}
        <line x1="197" y1="157" x2="199" y2="153" stroke="#3D1A00" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="208" y1="154" x2="208" y2="150" stroke="#3D1A00" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="219" y1="157" x2="221" y2="153" stroke="#3D1A00" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="241" y1="157" x2="239" y2="153" stroke="#3D1A00" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="252" y1="154" x2="252" y2="150" stroke="#3D1A00" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="263" y1="157" x2="265" y2="153" stroke="#3D1A00" strokeWidth="1.5" strokeLinecap="round"/>

        {/* Nose */}
        <path d="M222 190 Q230 195 238 190" stroke="#C67D4B" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

        {/* Smile */}
        <path d="M212 204 Q230 220 248 204" stroke="#3D1A00" strokeWidth="3" fill="none" strokeLinecap="round"/>

        {/* Cheeks */}
        <ellipse cx="190" cy="197" rx="17" ry="11" fill="#F5956A" opacity="0.3"/>
        <ellipse cx="270" cy="197" rx="17" ry="11" fill="#F5956A" opacity="0.3"/>

        {/* Left arm — raised */}
        <path d="M166 282 Q132 258 124 226 Q118 204 136 196" stroke="#D4956A" strokeWidth="28" fill="none" strokeLinecap="round"/>
        <circle cx="136" cy="196" r="18" fill="#D4956A"/>

        {/* Right arm — raised */}
        <path d="M294 282 Q328 258 336 226 Q342 204 324 196" stroke="#D4956A" strokeWidth="28" fill="none" strokeLinecap="round"/>
        <circle cx="324" cy="196" r="18" fill="#D4956A"/>

        {/* Left leg — sitting */}
        <path d="M186 364 Q170 386 166 408" stroke="#D4956A" strokeWidth="34" fill="none" strokeLinecap="round"/>
        <circle cx="166" cy="408" r="19" fill="#D4956A"/>

        {/* Right leg — sitting */}
        <path d="M274 364 Q290 386 294 408" stroke="#D4956A" strokeWidth="34" fill="none" strokeLinecap="round"/>
        <circle cx="294" cy="408" r="19" fill="#D4956A"/>

        {/* Shoes */}
        <ellipse cx="166" cy="418" rx="24" ry="10" fill="#085041" opacity="0.65"/>
        <ellipse cx="294" cy="418" rx="24" ry="10" fill="#085041" opacity="0.65"/>

        {/* Sparkles */}
        <g transform="translate(94,122)">
          <path d="M0,-10 L2.4,-2.4 L10,-2.4 L4,2.6 L6.2,10 L0,5.6 L-6.2,10 L-4,2.6 L-10,-2.4 L-2.4,-2.4 Z" fill="#FBC800" opacity="0.9"/>
        </g>
        <g transform="translate(358,104)">
          <path d="M0,-8 L1.9,-1.9 L8,-1.9 L3.2,2.1 L5,8 L0,4.5 L-5,8 L-3.2,2.1 L-8,-1.9 L-1.9,-1.9 Z" fill="#FBC800" opacity="0.75"/>
        </g>
        <g transform="translate(370,298)">
          <path d="M0,-6 L1.4,-1.4 L6,-1.4 L2.4,1.6 L3.7,6 L0,3.4 L-3.7,6 L-2.4,1.6 L-6,-1.4 L-1.4,-1.4 Z" fill="#FBC800" opacity="0.65"/>
        </g>
        <circle cx="82" cy="290" r="5" fill="#FBC800" opacity="0.5"/>

        {/* Heart */}
        <path d="M74,340 C74,335 79,332 79,337 C79,332 84,335 84,340 C84,345 79,350 79,350 C79,350 74,345 74,340 Z" fill="#F87171" opacity="0.7"/>

        {/* Medical cross */}
        <g transform="translate(358,182)" opacity="0.5">
          <rect x="-4.5" y="-14" width="9"  height="28" rx="3.5" fill="#085041"/>
          <rect x="-14"  y="-4.5" width="28" height="9"  rx="3.5" fill="#085041"/>
        </g>
      </svg>

      {/* Floating badge — healthy growth */}
      <div
        className="absolute -left-2 sm:-left-8 top-[18%] flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm pointer-events-none"
        style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--success)' }}/>
        <div>
          <p className="font-semibold leading-none" style={{ color: 'var(--ink)', fontSize: '0.78rem' }}>Healthy growth</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: 2 }}>WHO-tracked milestones</p>
        </div>
      </div>

      {/* Floating badge — ML score */}
      <div
        className="absolute -right-2 sm:-right-8 bottom-[22%] flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm pointer-events-none"
        style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-sand)' }}>
          <Activity size={16} style={{ color: 'var(--ink)' }}/>
        </div>
        <div>
          <p className="font-semibold leading-none" style={{ color: 'var(--ink)', fontSize: '0.78rem' }}>ML risk score</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: 2 }}>Real-time alerts</p>
        </div>
      </div>

      {/* Floating badge — vaccination */}
      <div
        className="absolute -right-2 sm:-right-4 top-[40%] px-2.5 py-1 rounded-lg text-xs font-semibold pointer-events-none"
        style={{ backgroundColor: 'var(--low-bg)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)' }}
      >
        ✓ Vaccinated on time
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
        style={{ backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)', backgroundSize: '28px 28px', opacity: 0.65 }}
        aria-hidden="true"
      />
      {/* Accent glow */}
      <div
        className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)', opacity: 0.06 }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* ── Text ── */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-7"
              style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--success)' }} aria-hidden="true"/>
              Rwanda · Child Health Platform
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-[3.35rem] font-bold leading-tight tracking-tight mb-5"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              Healthy children,{' '}
              <span style={{ color: 'var(--ink-soft)' }}>stronger</span>{' '}
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
                Sign in <ArrowRight size={18} aria-hidden="true"/>
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold border transition-colors hover:bg-[var(--bg-sand)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
              >
                How it works
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <Shield size={15} style={{ color: 'var(--success)' }} aria-hidden="true"/> WHO growth standards
              </span>
              <span className="flex items-center gap-1.5">
                <Heart size={15} style={{ color: 'var(--danger)' }} aria-hidden="true"/> Offline-first for CHWs
              </span>
              <span className="flex items-center gap-1.5">
                <Activity size={15} style={{ color: 'var(--warn)' }} aria-hidden="true"/> ML-powered risk scoring
              </span>
            </div>
          </div>

          {/* ── Illustration ── */}
          <div className="flex items-center justify-center lg:justify-end">
            <BabyIllustration />
          </div>

        </div>
      </div>
    </section>
  );
}
