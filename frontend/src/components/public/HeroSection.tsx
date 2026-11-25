import Link from 'next/link';
import { GrowthChartHero } from './GrowthChartHero';
import { DEFAULTS, type SiteContent } from '@/lib/siteContent';

export function HeroSection({ content = DEFAULTS['home.hero'] }: { content?: SiteContent['home.hero'] }) {
  return (
    <section style={{ background: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-12 lg:gap-16 items-center">

          <div className="max-w-xl">
            <h1
              className="text-[2.5rem] leading-[1.05] sm:text-[3.25rem] lg:text-[3.75rem] font-extrabold text-balance mb-6"
              style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
            >
              {content.title}
            </h1>

            <p className="text-lg leading-relaxed mb-9" style={{ color: 'var(--text-muted)' }}>
              {content.body}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center h-12 px-7 rounded-[var(--radius-md)] text-base font-bold transition-colors bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
                style={{ color: 'var(--bg)' }}
              >
                {content.primary_cta}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center h-12 px-6 rounded-[var(--radius-md)] text-base font-bold border-2 transition-colors hover:bg-[var(--bg-sand)]"
                style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}
              >
                {content.secondary_cta}
              </Link>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              {content.note}
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <GrowthChartHero />
          </div>

        </div>
      </div>
    </section>
  );
}
