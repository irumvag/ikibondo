'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

// Illustrative weight-for-age chart (girls, 0–24 months) with one child's visits.
// Reference values approximate the WHO Child Growth Standards; this is a picture
// of how Ikibondo reads a child's growth, not clinical reference data.

const W = 520;
const H = 400;
const PAD = { left: 44, right: 16, top: 20, bottom: 40 };
const MAX_MONTH = 24;
const MAX_KG = 18;

// month → [-3 SD, -2 SD, median, +2 SD, +3 SD] in kg
const REFERENCE: [number, number[]][] = [
  [0,  [2.0, 2.4, 3.2, 4.2, 4.8]],
  [3,  [3.6, 4.2, 5.8, 7.5, 8.5]],
  [6,  [4.7, 5.5, 7.3, 9.3, 10.6]],
  [9,  [5.4, 6.2, 8.2, 10.5, 12.0]],
  [12, [5.8, 6.7, 8.9, 11.5, 13.1]],
  [15, [6.2, 7.2, 9.6, 12.4, 14.1]],
  [18, [6.6, 7.6, 10.2, 13.2, 15.1]],
  [21, [6.9, 8.0, 10.9, 14.0, 16.0]],
  [24, [7.2, 8.4, 11.5, 14.8, 17.0]],
];

// One child's visits: tracks the median, falters around month 8, recovers after referral
const VISITS: [number, number][] = [
  [0, 3.1], [2, 4.9], [4, 6.0], [6, 6.6], [8, 6.5], [10, 7.5], [12, 8.4], [15, 9.3],
];
const FLAGGED_INDEX = 4;

// What the health worker saw at each visit: messages/en.json growthChart.notes.0 … .7

// Linear interpolation of one reference line at a given month
function refAt(month: number, sdIndex: number) {
  for (let i = 1; i < REFERENCE.length; i++) {
    const [m0, v0] = REFERENCE[i - 1];
    const [m1, v1] = REFERENCE[i];
    if (month <= m1) return v0[sdIndex] + ((month - m0) / (m1 - m0)) * (v1[sdIndex] - v0[sdIndex]);
  }
  return REFERENCE[REFERENCE.length - 1][1][sdIndex];
}

// Key under growthChart.band for where a weight falls on the reference lines
function bandKey(month: number, kg: number) {
  if (kg < refAt(month, 0)) return 'belowMinus3';
  if (kg < refAt(month, 1)) return 'minus3to2';
  if (kg < refAt(month, 2)) return 'minus2toMedian';
  return 'atOrAbove';
}

const x = (month: number) => PAD.left + (month / MAX_MONTH) * (W - PAD.left - PAD.right);
const y = (kg: number) => H - PAD.bottom - (kg / MAX_KG) * (H - PAD.top - PAD.bottom);

function line(sdIndex: number) {
  return REFERENCE.map(([m, v], i) => `${i ? 'L' : 'M'}${x(m).toFixed(1)},${y(v[sdIndex]).toFixed(1)}`).join(' ');
}

function band(lowIndex: number, highIndex: number) {
  const top = REFERENCE.map(([m, v], i) => `${i ? 'L' : 'M'}${x(m).toFixed(1)},${y(v[highIndex]).toFixed(1)}`);
  const bottom = [...REFERENCE].reverse().map(([m, v]) => `L${x(m).toFixed(1)},${y(v[lowIndex]).toFixed(1)}`);
  return `${top.join(' ')} ${bottom.join(' ')} Z`;
}

const childPath = VISITS.map(([m, kg], i) => `${i ? 'L' : 'M'}${x(m).toFixed(1)},${y(kg).toFixed(1)}`).join(' ');
const [flagMonth, flagKg] = VISITS[FLAGGED_INDEX];

export function GrowthChartHero() {
  const t = useTranslations('growthChart');
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <figure className="w-full" style={{ maxWidth: 560 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-labelledby="growth-chart-title growth-chart-desc"
      >
        <title id="growth-chart-title">{t('title')}</title>
        <desc id="growth-chart-desc">{t('desc')}</desc>

        {/* Chart-paper grid */}
        {Array.from({ length: MAX_MONTH / 3 + 1 }, (_, i) => i * 3).map((m) => (
          <line key={`v${m}`} x1={x(m)} x2={x(m)} y1={PAD.top} y2={H - PAD.bottom}
                stroke="var(--rule)" strokeWidth={m % 12 === 0 ? 1 : 0.5} />
        ))}
        {Array.from({ length: MAX_KG / 2 + 1 }, (_, i) => i * 2).map((kg) => (
          <line key={`h${kg}`} x1={PAD.left} x2={W - PAD.right} y1={y(kg)} y2={y(kg)}
                stroke="var(--rule)" strokeWidth={0.5} />
        ))}

        {/* Reference bands: −3 to −2 SD is the danger zone, −2 to +2 SD is the healthy range */}
        <path d={band(0, 1)} fill="var(--high-bg)" />
        <path d={band(1, 3)} fill="var(--low-bg)" opacity={0.85} />
        <path d={line(0)} fill="none" stroke="var(--danger)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        <path d={line(1)} fill="none" stroke="var(--danger)" strokeWidth={1.25} opacity={0.8} />
        <path d={line(2)} fill="none" stroke="var(--success)" strokeWidth={1.5} />
        <path d={line(3)} fill="none" stroke="var(--text-muted)" strokeWidth={1} opacity={0.6} />

        {/* Band labels at the right edge */}
        <text x={W - PAD.right - 4} y={y(REFERENCE[8][1][2]) - 6} textAnchor="end"
              fontSize="11" fill="var(--success)" fontWeight={700}>{t('median')}</text>
        <text x={W - PAD.right - 4} y={y(REFERENCE[8][1][1]) + 14} textAnchor="end"
              fontSize="11" fill="var(--danger)" fontWeight={700}>{t('minus2')}</text>

        {/* Axes */}
        {[0, 6, 12, 18, 24].map((m) => (
          <text key={`xl${m}`} x={x(m)} y={H - PAD.bottom + 18} textAnchor="middle"
                fontSize="11" fill="var(--text-muted)">{m}</text>
        ))}
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 4} textAnchor="middle"
              fontSize="11" fill="var(--text-muted)">{t('ageInMonths')}</text>
        {[0, 6, 12].map((kg) => (
          <text key={`yl${kg}`} x={PAD.left - 8} y={y(kg) + 4} textAnchor="end"
                fontSize="11" fill="var(--text-muted)">{kg}</text>
        ))}
        <text x={12} y={PAD.top + 4} fontSize="11" fill="var(--text-muted)">{t('kg')}</text>

        {/* The child — the single orchestrated moment on the page */}
        <path
          d={childPath}
          pathLength={600}
          className="plot-line"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {VISITS.map(([m, kg], i) => {
          const isSelected = selected === i;
          const isFlagged = i === FLAGGED_INDEX;
          return (
            <g
              key={m}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={t('visitLabel', { month: m, kg })}
              className="cursor-pointer focus:outline-none group"
              onClick={() => setSelected(isSelected ? null : i)}
              onMouseEnter={() => setSelected(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(isSelected ? null : i); }
              }}
            >
              {/* Generous invisible hit area for fingers */}
              <circle cx={x(m)} cy={y(kg)} r={16} fill="transparent" />
              {/* Selection / keyboard focus ring */}
              <circle cx={x(m)} cy={y(kg)} r={11} fill="none" stroke="var(--ink)" strokeWidth={2}
                      className={isSelected ? '' : 'opacity-0 group-focus-visible:opacity-100'} />
              <circle
                cx={x(m)}
                cy={y(kg)}
                r={isFlagged ? 6 : 4.5}
                className="plot-point"
                style={{ animationDelay: `${0.3 + (i / (VISITS.length - 1)) * 1.6}s` }}
                fill={isFlagged ? 'var(--bg-elev)' : 'var(--accent)'}
                stroke="var(--accent)"
                strokeWidth={isFlagged ? 2.5 : 0}
              />
            </g>
          );
        })}

        {/* Annotation for the flagged visit */}
        <g className="plot-point" style={{ animationDelay: '1.4s' }}>
          <line x1={x(flagMonth)} y1={y(flagKg) + 9} x2={x(flagMonth)} y2={y(flagKg) + 40}
                stroke="var(--ink)" strokeWidth={1} />
          <text x={x(flagMonth) + 6} y={y(flagKg) + 36} fontSize="12" fill="var(--ink)" fontWeight={700}>
            {t('flagged')}
          </text>
        </g>
      </svg>
      {/* Selected visit detail — fixed height so the layout doesn't jump */}
      <div className="mt-3 min-h-[4.5rem] pl-3 border-l-4" aria-live="polite"
           style={{ borderColor: selected === null ? 'var(--rule)' : 'var(--accent)' }}>
        {selected === null ? (
          <p className="text-sm pt-1" style={{ color: 'var(--text-muted)' }}>
            {t('hint')}
          </p>
        ) : (
          <>
            <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
              {t('selected', { month: VISITS[selected][0], kg: VISITS[selected][1].toFixed(1), band: t(`band.${bandKey(...VISITS[selected])}`) })}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{t(`notes.${selected}` as 'notes.0')}</p>
          </>
        )}
      </div>
      <figcaption className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('caption')}
      </figcaption>
    </figure>
  );
}
