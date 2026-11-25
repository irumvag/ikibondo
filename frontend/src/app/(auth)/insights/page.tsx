'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getInsights, cellText, type Cell } from '@/lib/api/insights';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { Skeleton } from '@/components/ui/Skeleton';

const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
// Hidden counts become gaps in the chart, not zeros (a zero would claim nobody was seen)
const num = (c: Cell | undefined) => (c && !c.suppressed ? c.value ?? 0 : null);

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
