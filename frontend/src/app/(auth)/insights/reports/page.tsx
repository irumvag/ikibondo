'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/contexts/ToastContext';
import { useAuthStore } from '@/store/authStore';
import {
  INDICATOR_KEYS, cellText, downloadInsightsCsv, getInsights, type Indicator, type IndicatorKey,
} from '@/lib/api/insights';

const LEVEL = {
  good: { fg: 'var(--success)', bg: 'var(--low-bg)', word: 'On track' },
  watch: { fg: 'var(--warn)', bg: 'var(--med-bg)', word: 'Watch' },
  alert: { fg: 'var(--danger)', bg: 'var(--high-bg)', word: 'Act now' },
} as const;

// Plain definitions of the counts; indicator definitions come from Admin → Indicators
const COUNT_DEFINITIONS: [string, string][] = [
  ['Children', 'Active children registered in the camp.'],
  ['SAM / MAM', "Children whose latest check-up showed severe / moderate acute malnutrition (WHO weight-for-height, MUAC or oedema)."],
  ['Check-ups (30 days)', 'Measurements recorded in the last 30 days.'],
  ['Open referrals', 'Referrals to a health facility that are not yet completed.'],
];

/** One sentence per indicator that has a verdict, worst first: the report's summary. */
function summarise(ind: Partial<Record<IndicatorKey, Indicator>> | undefined): string[] {
  if (!ind) return [];
  const order = { alert: 0, watch: 1, good: 2 } as const;
  return INDICATOR_KEYS
    .map((k) => ind[k])
    .filter((i): i is Indicator => !!i && i.value != null && !!i.level)
    .sort((a, b) => order[a.level!] - order[b.level!])
    .map((i) => {
      const verdict = i.band ?? LEVEL[i.level!].word;
      const target = i.target != null ? ` (target ${i.target}%)` : '';
      return `${i.label}: ${i.value}%, ${verdict.toLowerCase()}${target}.`;
    });
}

/**
 * The statistics as a report: read on screen, print or save as PDF, or download
 * as CSV. Every indicator name, target and explanation comes from the server
 * (edited in Admin → Indicators), so the report always matches the dashboard.
 */
export default function InsightsReportsPage() {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [camp, setCamp] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: all } = useQuery({ queryKey: ['insights', ''], queryFn: () => getInsights() });
  const { data, isLoading } = useQuery({ queryKey: ['insights', camp], queryFn: () => getInsights(camp || undefined) });
  const total = data?.total;
  const ind = total?.indicators;
  const min = data?.min_cell ?? 5;
  const scope = camp ? data?.camps[0]?.name : `${all?.camps.length ?? 0} camp${all?.camps.length === 1 ? '' : 's'}`;
  const summary = summarise(ind);
  const today = data ? new Date(data.generated_on).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const download = async () => {
    setBusy(true);
    try {
      await downloadInsightsCsv(camp || undefined);
      toast.success('Report downloaded');
    } catch {
      toast.error('The report could not be downloaded. Try again later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full">
      {/* Toolbar (not printed) */}
      <div className="print:hidden flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Reports</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Read the report here, print it or save it as PDF, or download the figures.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium" style={{ color: 'var(--ink)' }}>Camp</span>
            <select value={camp} onChange={(e) => setCamp(e.target.value)}
              className="text-sm px-3 h-10 rounded-lg border outline-none min-w-[12rem]"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}>
              <option value="">All my camps</option>
              {(all?.camps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={() => window.print()} disabled={!data}>
            <Printer size={15} className="mr-2" aria-hidden="true" /> Print / PDF
          </Button>
          <Button variant="primary" loading={busy} onClick={download} disabled={!all?.camps.length}>
            <Download size={15} className="mr-2" aria-hidden="true" /> CSV
          </Button>
        </div>
      </div>

      {/* The report */}
      <article className="rounded-2xl border overflow-hidden print:border-0 print:rounded-none print:shadow-none"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-md)' }}>
        <header className="px-6 sm:px-8 py-6 flex flex-wrap items-start justify-between gap-4 border-b-4" style={{ borderColor: 'var(--ink)' }}>
          <div>
            <Logo size={30} />
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-4" style={{ color: 'var(--ink)' }}>Child nutrition report</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {user?.organization_name ?? 'Ikibondo'} · {scope}
            </p>
          </div>
          <dl className="text-xs grid grid-cols-[auto_auto] gap-x-3 gap-y-1" style={{ color: 'var(--text-muted)' }}>
            <dt>Issued</dt><dd className="font-semibold" style={{ color: 'var(--ink)' }}>{today}</dd>
            <dt>Nutrition</dt><dd style={{ color: 'var(--ink)' }}>last 90 days</dd>
            <dt>Vaccination</dt><dd style={{ color: 'var(--ink)' }}>to date</dd>
            <dt>Referrals</dt><dd style={{ color: 'var(--ink)' }}>last 12 months</dd>
          </dl>
        </header>

        {isLoading || !data ? (
          <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>Preparing the report…</div>
        ) : !total ? (
          <div className="p-8 text-sm" style={{ color: 'var(--text-muted)' }}>No camps are linked to your organisation yet.</div>
        ) : (
          <div className="px-6 sm:px-8 py-6 flex flex-col gap-8 text-sm" style={{ color: 'var(--text)' }}>
            {/* 1. Summary */}
            <section>
              <h2 className="text-base font-bold mb-2" style={{ color: 'var(--ink)' }}>1. Summary</h2>
              {summary.length ? (
                <ul className="flex flex-col gap-1.5 list-disc pl-5">{summary.map((line) => <li key={line}>{line}</li>)}</ul>
              ) : (
                <p>Too few children have been measured or vaccinated in these camps to judge the indicators safely
                  (at least {min} children are needed for any rate). The counts below still apply.</p>
              )}
            </section>

            {/* 2. Key figures */}
            <section>
              <h2 className="text-base font-bold mb-3" style={{ color: 'var(--ink)' }}>2. Key figures</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {([
                  ['Children registered', cellText(total.children, min)],
                  ['Measured, 6–59 months', ind ? cellText(ind.measured_6_59m, min) : '—'],
                  ['Severe (SAM)', cellText(total.sam, min)],
                  ['Moderate (MAM)', cellText(total.mam, min)],
                  ['Check-ups, 30 days', cellText(total.visits_30d, min)],
                  ['Open referrals', cellText(total.referrals_open, min)],
                ] as const).map(([label, value]) => (
                  <div key={label} className="rounded-xl p-3 border print:break-inside-avoid" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xl font-extrabold tabular-nums" style={{ color: 'var(--ink)' }}>{value}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Indicators */}
            <section>
              <h2 className="text-base font-bold mb-3" style={{ color: 'var(--ink)' }}>3. Indicators</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="text-left text-xs border-b-2" style={{ color: 'var(--text-muted)', borderColor: 'var(--ink)' }}>
                      <th scope="col" className="py-2 pr-3 font-semibold">Indicator</th>
                      <th scope="col" className="py-2 px-3 font-semibold text-right">Value</th>
                      <th scope="col" className="py-2 px-3 font-semibold">Status</th>
                      <th scope="col" className="py-2 pl-3 font-semibold">Benchmark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INDICATOR_KEYS.map((k) => {
                      const i = ind?.[k];
                      const lv = i?.level ? LEVEL[i.level] : null;
                      return (
                        <tr key={k} className="border-b align-top print:break-inside-avoid" style={{ borderColor: 'var(--border)' }}>
                          <th scope="row" className="py-2.5 pr-3 text-left font-semibold" style={{ color: 'var(--ink)' }}>{i?.label ?? k}</th>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{i?.value != null ? `${i.value}%` : '—'}</td>
                          <td className="py-2.5 px-3">
                            {lv ? (
                              <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: lv.fg, backgroundColor: lv.bg }}>
                                {i?.band ?? lv.word}
                              </span>
                            ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Too few children</span>}
                          </td>
                          <td className="py-2.5 pl-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {i?.benchmark}{i?.target != null && ` Target: ${i.target}%.`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. By camp */}
            {data.camps.length > 1 && (
              <section className="print:break-before-page">
                <h2 className="text-base font-bold mb-3" style={{ color: 'var(--ink)' }}>4. By camp</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse">
                    <thead>
                      <tr className="text-left text-xs border-b-2" style={{ color: 'var(--text-muted)', borderColor: 'var(--ink)' }}>
                        <th scope="col" className="py-2 pr-3 font-semibold">Camp</th>
                        {['Children', 'SAM', 'MAM', ...(['gam_rate', 'measles_coverage', 'penta3_coverage'] as IndicatorKey[]).map((k) => ind?.[k]?.label ?? k)]
                          .map((h) => <th key={h} scope="col" className="py-2 px-2 font-semibold text-right">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.camps.map((c) => (
                        <tr key={c.id} className="border-b print:break-inside-avoid" style={{ borderColor: 'var(--border)' }}>
                          <th scope="row" className="py-2 pr-3 text-left font-semibold" style={{ color: 'var(--ink)' }}>
                            {c.name}<span className="block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{c.district}</span>
                          </th>
                          <td className="py-2 px-2 text-right tabular-nums">{cellText(c.children, min)}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{cellText(c.sam, min)}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{cellText(c.mam, min)}</td>
                          {(['gam_rate', 'measles_coverage', 'penta3_coverage'] as IndicatorKey[]).map((k) => {
                            const v = c.indicators?.[k];
                            return <td key={k} className="py-2 px-2 text-right tabular-nums">{v?.value != null ? `${v.value}%` : '—'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 5. Definitions */}
            <section className="print:break-inside-avoid">
              <h2 className="text-base font-bold mb-3" style={{ color: 'var(--ink)' }}>{data.camps.length > 1 ? '5' : '4'}. Definitions</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-[12rem_minmax(0,1fr)] gap-x-4 gap-y-2">
                {COUNT_DEFINITIONS.map(([t, d]) => (
                  <div key={t} className="contents"><dt className="font-semibold" style={{ color: 'var(--ink)' }}>{t}</dt><dd>{d}</dd></div>
                ))}
                {INDICATOR_KEYS.map((k) => ind?.[k]).filter(Boolean).map((i) => (
                  <div key={i!.label} className="contents">
                    <dt className="font-semibold" style={{ color: 'var(--ink)' }}>{i!.label}</dt>
                    <dd>{i!.benchmark}{i!.target != null && ` Target: ${i!.target}%.`}</dd>
                  </div>
                ))}
                <div className="contents">
                  <dt className="font-semibold" style={{ color: 'var(--ink)' }}>Not in this report</dt>
                  <dd>Cure, death and defaulter rates of treatment programmes (Sphere) come from those programmes&apos; own reporting.</dd>
                </div>
              </dl>
            </section>

            <footer className="flex items-start gap-2 text-xs pt-4 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Counts only — no child is named. Numbers from 1 to {min - 1} appear as “&lt;{min}” and rates need at least {min} children,
                so no child can be identified. Prepared from Ikibondo on {today}.
              </span>
            </footer>
          </div>
        )}
      </article>
    </div>
  );
}
