'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DEFAULTS, type SiteContent } from '@/lib/siteContent';

// WHO MUAC cut-offs for children 6–59 months.
const MIN_CM = 9;
const MAX_CM = 16;
const SAM_BELOW = 11.5;
const MAM_BELOW = 12.5;

// Band of a MUAC reading; its title and action text are in messages/en.json under "muac".
function classify(cm: number) {
  if (cm < SAM_BELOW) return { band: 'red', color: 'var(--muac-red)' } as const;
  if (cm < MAM_BELOW) return { band: 'yellow', color: 'var(--muac-yellow)' } as const;
  return { band: 'green', color: 'var(--muac-green)' } as const;
}

const pct = (cm: number) => ((cm - MIN_CM) / (MAX_CM - MIN_CM)) * 100;

export function MuacExplainer({ content = DEFAULTS['home.muac'] }: { content?: SiteContent['home.muac'] }) {
  const [cm, setCm] = useState(13.2);
  const id = useId();
  const t = useTranslations('muac');
  const result = classify(cm);
  const band = t(`band.${result.band}`);
  const title = t(`${result.band}.title`);

  return (
    <section className="py-16 sm:py-24 border-y" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--rule)' }}
             aria-labelledby={`${id}-heading`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-10 lg:gap-16 items-start">
        <div>
          <h2 id={`${id}-heading`} className="text-3xl sm:text-4xl font-extrabold text-balance mb-4"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {content.title}
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {content.body}
          </p>
        </div>

        <div>
          {/* The tape */}
          <div className="relative pt-9">
            <div
              className="absolute top-0 -translate-x-1/2 px-2 py-1 rounded-[var(--radius-sm)] text-sm font-extrabold tabular-nums whitespace-nowrap"
              style={{ left: `${pct(cm)}%`, background: 'var(--ink)', color: 'var(--bg)' }}
              aria-hidden="true"
            >
              {t('cm', { value: cm.toFixed(1) })}
            </div>
            <div className="relative flex h-12 overflow-hidden rounded-[var(--radius-sm)]" aria-hidden="true">
              <div style={{ width: `${pct(SAM_BELOW)}%`, background: 'var(--muac-red)' }} />
              <div style={{ width: `${pct(MAM_BELOW) - pct(SAM_BELOW)}%`, background: 'var(--muac-yellow)' }} />
              <div className="flex-1" style={{ background: 'var(--muac-green)' }} />
              <div
                className="absolute inset-x-0 top-0 h-3 pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(to right, rgba(0,0,0,.4) 0 1px, transparent 1px calc(100% / 70))' }}
              />
              <div className="absolute top-0 bottom-0 w-[3px] -translate-x-1/2"
                   style={{ left: `${pct(cm)}%`, background: 'var(--ink)' }} />
            </div>
            <div className="relative h-6 mt-1 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
              {[9, 11.5, 12.5, 16].map((v) => (
                <span key={v} className="absolute -translate-x-1/2" style={{ left: `${pct(v)}%` }}>{v}</span>
              ))}
            </div>
            <label htmlFor={`${id}-range`} className="sr-only">{t('rangeLabel')}</label>
            <input
              id={`${id}-range`}
              type="range"
              min={MIN_CM}
              max={MAX_CM}
              step={0.1}
              value={cm}
              onChange={(e) => setCm(Number(e.target.value))}
              aria-valuetext={t('valueText', { value: cm.toFixed(1), band, title })}
              className="w-full mt-2 accent-[var(--ink)] h-8 cursor-pointer"
            />
          </div>

          {/* What it means — announced to screen readers as the value changes */}
          <div className="mt-6 pl-4 border-l-4" style={{ borderColor: result.color }} aria-live="polite">
            <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{t('bandLabel', { band })}</p>
            <p className="text-xl font-extrabold mt-1" style={{ color: 'var(--ink)' }}>{title}</p>
            <p className="text-base leading-relaxed mt-2 max-w-prose" style={{ color: 'var(--text)' }}>{t(`${result.band}.action`)}</p>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('note')}
          </p>
        </div>
      </div>
    </section>
  );
}
