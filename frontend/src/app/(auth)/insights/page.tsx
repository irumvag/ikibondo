'use client';

import { useTranslations } from 'next-intl';
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

// The server sends the admin-edited names.
// Fallback names while loading are in messages/en.json insights.indicator.<key>
const IND_GROUPS: { id: 'nutrition' | 'immunisation' | 'followUp'; keys: IndicatorKey[] }[] = [
  { id: 'nutrition', keys: ['gam_rate', 'sam_rate', 'stunting_rate', 'underweight_rate', 'screening_coverage'] },
  { id: 'immunisation', keys: ['measles_coverage', 'penta3_coverage', 'penta_dropout'] },
  { id: 'followUp', keys: ['referral_completion'] },
];
const LEVEL = {
  good: { fg: 'var(--success)', bg: 'var(--low-bg)' },
  watch: { fg: 'var(--warn)', bg: 'var(--med-bg)' },
  alert: { fg: 'var(--danger)', bg: 'var(--high-bg)' },
} as const;

function IndicatorCard({ name, ind, min }: { name: string; ind: Indicator | undefined; min: number }) {
  const t = useTranslations('insights');
  const lv = ind?.level ? LEVEL[ind.level] : null;
  return (
    <div className="rounded-2xl border p-4 flex flex-col gap-2"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-sm)', borderLeft: lv ? `4px solid ${lv.fg}` : undefined }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{name}</p>
      {ind?.value == null ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('notEnoughChildrenYet', { min: min })}</p>
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
  const t = useTranslations('insights');
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
    seen: num(m.children_seen),
    SAM: num(m.sam),
    MAM: num(m.mam),
  }));

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{t('childNutritionOverview')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {user?.organization_name ?? t('yourOrganisation')}{' '}{t('campsCount', { count: all?.camps.length ?? 0 })}
            {data && t('updatedOn', { date: new Date(data.generated_on).toLocaleDateString() })}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium" style={{ color: 'var(--ink)' }}>{t('camp2')}</span>
          <select value={camp} onChange={(e) => setCamp(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border outline-none min-w-[14rem]"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}>
            <option value="">{t('allCamps')}</option>
            {(all?.camps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {isError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{t('statisticsCouldNotBe')}</p>}
      {!isLoading && data && !total && (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('noCampsAssignedYet')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('anIkibondoAdministratorLinks')}</p>
        </div>
      )}

      {(isLoading || total) && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            <KPICard label={t('childrenRegistered')} value={cellText(total?.children, min)} isLoading={isLoading} />
            <KPICard label={t('acuteMalnutritionSamMam')} value={pct(total?.acute_malnutrition_rate ?? null)}
              subtext={t('ofChildrenMeasured')} isLoading={isLoading} />
            <KPICard label={t('severeSam')} value={cellText(total?.sam, min)} isLoading={isLoading} />
            <KPICard label={t('moderateMam')} value={cellText(total?.mam, min)} isLoading={isLoading} />
            <KPICard label={t('vaccinationCoverage')} value={pct(total?.vaccination_coverage ?? null)}
              subtext={t('dosesGivenOfDoses')} isLoading={isLoading} />
            <KPICard label={t('visitsLast30Days')} value={cellText(total?.visits_30d, min)} isLoading={isLoading} />
          </div>

          {/* Institutional indicators: how partners and the Ministry judge the situation */}
          <section aria-labelledby="ind-heading" className="flex flex-col gap-4">
            <div>
              <h3 id="ind-heading" className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('keyIndicators')}</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('judgedAgainstWhoUnicef')}{total?.indicators && (total.indicators.measured_6_59m.value == null
                  ? t('tooFewMeasured')
                  : t('basedOnMeasured', { measured: cellText(total.indicators.measured_6_59m, min), total: cellText(total.indicators.children_6_59m, min) }))}
              </p>
            </div>
            {IND_GROUPS.map((g) => (
              <div key={g.id}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{t(`group.${g.id}`)}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {g.keys.map((k) => <IndicatorCard key={k} name={total?.indicators?.[k]?.label || t(`indicator.${k}`)} ind={total?.indicators?.[k]} min={min} />)}
                </div>
              </div>
            ))}
          </section>

          {/* Scorecard per camp */}
          {(data?.camps.length ?? 0) > 1 && (
            <section className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
              <table className="w-full text-sm min-w-[640px]">
                <caption className="text-left px-5 pt-4 pb-2 text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('campScorecard')}</caption>
                <thead>
                  <tr className="text-left text-xs border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    <th scope="col" className="px-5 py-2 font-semibold">{t('camp2')}</th>
                    {(['gam_rate', 'stunting_rate', 'measles_coverage', 'penta3_coverage', 'penta_dropout', 'screening_coverage'] as IndicatorKey[]).map((k) => (
                      <th key={k} scope="col" className="px-3 py-2 font-semibold text-right whitespace-nowrap">{total?.indicators?.[k]?.label || t(`indicator.${k}`)}</th>
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
                            {ind?.value == null ? <span style={{ color: 'var(--text-muted)' }} title={t('fewerThanChildren', { min })}>—</span> : (
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
            <h3 id="trend-heading" className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('last12Months')}</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('childrenMeasuredEachMonth')}{(data?.trend ?? []).some((m) => m.children_seen.suppressed || m.sam.suppressed || m.mam.suppressed) &&
                t('smallBarsLeftOut', { min })}
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
                    <Bar dataKey="seen" name={t('childrenSeen')} fill="var(--ink)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="MAM" fill="var(--muac-yellow)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="SAM" fill="var(--muac-red)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-2xl border overflow-x-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            <table className="w-full text-sm">
              <caption className="text-left px-5 pt-4 pb-2 text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('byCamp')}</caption>
              <thead>
                <tr className="text-left text-xs border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  {(['camp', 'children', 'sam', 'mam', 'malnutritionRate', 'highRisk', 'vaccination', 'visits30d', 'openReferrals'] as const).map((h) => (
                    <th key={h} scope="col" className="px-5 py-2 font-semibold whitespace-nowrap">{t(`column.${h}`)}</th>
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
        {t('privacyNote', { maxHidden: min - 1, min })}
      </p>
    </div>
  );
}
