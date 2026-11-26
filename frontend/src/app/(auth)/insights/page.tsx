'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getInsights, cellText, type Cell, type Indicator, type IndicatorKey } from '@/lib/api/insights';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { Skeleton } from '@/components/ui/Skeleton';

const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
// Hidden counts become gaps in the chart, not zeros (a zero would claim nobody was seen)
const num = (c: Cell | undefined) => (c && !c.suppressed ? c.value ?? 0 : null);

const IND_LABEL: Record<IndicatorKey, string> = {
  gam_rate: 'Wasting (GAM)',
  sam_rate: 'Severe wasting (SAM)',
  stunting_rate: 'Stunting',
  underweight_rate: 'Underweight',
  screening_coverage: 'Screening coverage',
  measles_coverage: 'Measles (MR1) coverage',
  penta3_coverage: 'Penta3 coverage',
  penta_dropout: 'Penta1 → Penta3 dropout',
  referral_completion: 'Referrals completed',
};
const IND_GROUPS: { title: string; keys: IndicatorKey[] }[] = [
  { title: 'Nutrition, children 6–59 months', keys: ['gam_rate', 'sam_rate', 'stunting_rate', 'underweight_rate', 'screening_coverage'] },
  { title: 'Immunisation', keys: ['measles_coverage', 'penta3_coverage', 'penta_dropout'] },
  { title: 'Follow-up', keys: ['referral_completion'] },
];
const LEVEL = {
  good: { fg: 'var(--success)', bg: 'var(--low-bg)' },
  watch: { fg: 'var(--warn)', bg: 'var(--med-bg)' },
  alert: { fg: 'var(--danger)', bg: 'var(--high-bg)' },
} as const;

function IndicatorCard({ name, ind, min }: { name: string; ind: Indicator | undefined; min: number }) {
  const lv = ind?.level ? LEVEL[ind.level] : null;
  return (
    <div className="rounded-2xl border p-4 flex flex-col gap-2"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-sm)', borderLeft: lv ? `4px solid ${lv.fg}` : undefined }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{name}</p>
      {ind?.value == null ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Not enough children yet (fewer than {min}), so no rate is shown.
        </p>
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-extrabold tabular-nums" style={{ color: 'var(--ink)' }}>{ind.value}%</span>
          {ind.band && lv && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: lv.fg, backgroundColor: lv.bg }}>{ind.band}</span>
          )}
        </div>
      )}
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{ind?.benchmark}</p>
    </div>
  );
}

/**
 * Overview for government and partner organisations: aggregated statistics for the
 * camps their organisation covers. No child is ever named or listed here.
 */
export default function InsightsPage() {
  const user = useAuthStore((s) => s.user);
  const [camp, setCamp] = useState('');
  const { data: all } = useQuery({ queryKey: ['insights', ''], queryFn: () => getInsights() });
  const { data, isLoading, isError } = useQuery({
    queryKey: ['insights', camp], queryFn: () => getInsights(camp || undefined), staleTime: 60_000,
  });
  const total = data?.total;
  const min = data?.min_cell ?? 5;

  const trend = (data?.trend ?? []).map((m) => ({
    month: new Date(`${m.month}-01`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    'Children seen': num(m.children_seen),
    SAM: num(m.sam),
    MAM: num(m.mam),
  }));

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Child nutrition overview</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {user?.organization_name ?? 'Your organisation'} · {all?.camps.length ?? 0} camp{all?.camps.length === 1 ? '' : 's'}
            {data && ` · updated ${new Date(data.generated_on).toLocaleDateString()}`}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium" style={{ color: 'var(--ink)' }}>Camp</span>
          <select value={camp} onChange={(e) => setCamp(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border outline-none min-w-[14rem]"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}>
            <option value="">All camps</option>
            {(all?.camps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {isError && <p className="text-sm" style={{ color: 'var(--danger)' }}>Statistics could not be loaded. Try again later.</p>}
      {!isLoading && data && !total && (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>No camps assigned yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            An Ikibondo administrator links your organisation to the camps it works in.
          </p>
        </div>
      )}

      {(isLoading || total) && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            <KPICard label="Children registered" value={cellText(total?.children, min)} isLoading={isLoading} />
            <KPICard label="Acute malnutrition (SAM + MAM)" value={pct(total?.acute_malnutrition_rate ?? null)}
              subtext="of children measured" isLoading={isLoading} />
            <KPICard label="Severe (SAM)" value={cellText(total?.sam, min)} isLoading={isLoading} />
            <KPICard label="Moderate (MAM)" value={cellText(total?.mam, min)} isLoading={isLoading} />
            <KPICard label="Vaccination coverage" value={pct(total?.vaccination_coverage ?? null)}
              subtext="doses given of doses due" isLoading={isLoading} />
            <KPICard label="Visits, last 30 days" value={cellText(total?.visits_30d, min)} isLoading={isLoading} />
          </div>

          {/* Institutional indicators: how partners and the Ministry judge the situation */}
          <section aria-labelledby="ind-heading" className="flex flex-col gap-4">
            <div>
              <h3 id="ind-heading" className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Key indicators</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Judged against WHO/UNICEF prevalence thresholds, UNHCR and Sphere standards.
                {total?.indicators && (total.indicators.measured_6_59m.value == null
                  ? ` Too few children aged 6–59 months were measured in the last 90 days to show rates safely.`
                  : ` Based on ${cellText(total.indicators.measured_6_59m, min)} of ${cellText(total.indicators.children_6_59m, min)} children aged 6–59 months, measured in the last 90 days.`)}
              </p>
            </div>
            {IND_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{g.title}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {g.keys.map((k) => <IndicatorCard key={k} name={IND_LABEL[k]} ind={total?.indicators?.[k]} min={min} />)}
                </div>
              </div>
            ))}
          </section>

          {/* Scorecard per camp */}
          {(data?.camps.length ?? 0) > 1 && (
            <section className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
              <table className="w-full text-sm min-w-[640px]">
                <caption className="text-left px-5 pt-4 pb-2 text-base font-semibold" style={{ color: 'var(--ink)' }}>Camp scorecard</caption>
                <thead>
                  <tr className="text-left text-xs border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    <th scope="col" className="px-5 py-2 font-semibold">Camp</th>
                    {(['gam_rate', 'stunting_rate', 'measles_coverage', 'penta3_coverage', 'penta_dropout', 'screening_coverage'] as IndicatorKey[]).map((k) => (
                      <th key={k} scope="col" className="px-3 py-2 font-semibold text-right whitespace-nowrap">{IND_LABEL[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.camps ?? []).map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                      <th scope="row" className="px-5 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{c.name}</th>
                      {(['gam_rate', 'stunting_rate', 'measles_coverage', 'penta3_coverage', 'penta_dropout', 'screening_coverage'] as IndicatorKey[]).map((k) => {
                        const ind = c.indicators?.[k];
                        const lv = ind?.level ? LEVEL[ind.level] : null;
                        return (
                          <td key={k} className="px-3 py-2.5 text-right tabular-nums">
                            {ind?.value == null ? <span style={{ color: 'var(--text-muted)' }} title={`Fewer than ${min} children`}>—</span> : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: lv?.fg, backgroundColor: lv?.bg }}>{ind.value}%</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            aria-labelledby="trend-heading">
            <h3 id="trend-heading" className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Last 12 months</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Children measured each month, and how many were severely or moderately malnourished at that visit.
              {(data?.trend ?? []).some((m) => m.children_seen.suppressed || m.sam.suppressed || m.mam.suppressed) &&
                ` Bars with fewer than ${min} children are left out to protect privacy.`}
            </p>
            {isLoading ? <Skeleton className="h-64" /> : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Children seen" fill="var(--ink)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="MAM" fill="var(--muac-yellow)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="SAM" fill="var(--muac-red)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            <table className="w-full text-sm">
              <caption className="text-left px-5 pt-4 pb-2 text-base font-semibold" style={{ color: 'var(--ink)' }}>By camp</caption>
              <thead>
                <tr className="text-left text-xs border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  {['Camp', 'Children', 'SAM', 'MAM', 'Malnutrition rate', 'High risk', 'Vaccination', 'Visits (30 d)', 'Open referrals'].map((h) => (
                    <th key={h} scope="col" className="px-5 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.camps ?? []).map((c) => (
                  <tr key={c.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                    <th scope="row" className="px-5 py-3 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                      {c.name}<span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{c.district}</span>
                    </th>
                    <td className="px-5 py-3 tabular-nums">{cellText(c.children, min)}</td>
                    <td className="px-5 py-3 tabular-nums">{cellText(c.sam, min)}</td>
                    <td className="px-5 py-3 tabular-nums">{cellText(c.mam, min)}</td>
                    <td className="px-5 py-3 tabular-nums">{pct(c.acute_malnutrition_rate)}</td>
                    <td className="px-5 py-3 tabular-nums">{cellText(c.high_risk, min)}</td>
                    <td className="px-5 py-3 tabular-nums">{pct(c.vaccination_coverage)}</td>
                    <td className="px-5 py-3 tabular-nums">{cellText(c.visits_30d, min)}</td>
                    <td className="px-5 py-3 tabular-nums">{cellText(c.referrals_open, min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <p className="flex items-start gap-2 text-xs max-w-3xl" style={{ color: 'var(--text-muted)' }}>
        <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        {`Figures are counts only — no child is named or listed. Numbers from 1 to ${min - 1} are shown as `}
        {`“<${min}” and rates are only given for at least ${min} children, so a child in a small camp `}
        {'cannot be identified. Nutrition status uses each child’s latest measurement (WHO 2006 standards).'}
      </p>
    </div>
  );
}
