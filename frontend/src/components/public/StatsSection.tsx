'use client';

import { useState } from 'react';
import { Users, MapPin, Activity, Syringe, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useLandingStats, useStatsTrend } from '@/lib/api/queries';
import type { TrendPeriod } from '@/lib/api/public';
import { useIntersection } from '@/hooks/useIntersection';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useCountUp } from '@/hooks/useCountUp';
import { Skeleton } from '@/components/ui/Skeleton';

// ── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  suffix = '',
  trigger,
  instant,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  trigger: boolean;
  instant: boolean;
}) {
  const count = useCountUp(value, trigger, { instant });

  return (
    <div
      className="flex flex-col gap-3 p-6 rounded-2xl"
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--bg-sand)' }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div>
        <p
          className="text-3xl font-bold tabular-nums leading-none"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          {count.toLocaleString()}{suffix}
        </p>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function RiskBar({
  label,
  value,
  total,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  bgColor: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-xs font-semibold shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div
        className="flex-1 h-2.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-sand)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} risk: ${value} children`}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-24 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
        <span
          className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1"
          style={{ backgroundColor: bgColor, color }}
        >
          {label}
        </span>
        {value.toLocaleString()} ({Math.round(pct)}%)
      </span>
    </div>
  );
}

// ── Trend chart ───────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: TrendPeriod }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

function TrendChart() {
  const [period, setPeriod] = useState<TrendPeriod>('30d');
  const { data: trend, isLoading } = useStatsTrend(period);

  const formatted = (trend ?? []).map((p) => ({
    ...p,
    date: new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }));

  return (
    <div
      className="p-6 sm:p-8 rounded-2xl"
      style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Risk trend over time</h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Daily breakdown of monitored children by risk level
          </p>
        </div>
        <div
          className="flex gap-1 p-1 rounded-xl self-start"
          style={{ backgroundColor: 'var(--bg-sand)', border: '1px solid var(--border)' }}
          role="group"
          aria-label="Period"
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
              style={{
                backgroundColor: period === p.value ? 'var(--bg-elev)' : 'transparent',
                color: period === p.value ? 'var(--ink)' : 'var(--text-muted)',
              }}
              aria-pressed={period === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !formatted.length ? (
        <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No trend data available.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                fontSize: 12,
                color: 'var(--ink)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="low_risk"
              name="Low"
              stroke="var(--success)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="medium_risk"
              name="Medium"
              stroke="var(--warn)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="high_risk"
              name="High"
              stroke="var(--danger)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function StatsSection() {
  const { data, isLoading, isError } = useLandingStats();
  const { ref, visible } = useIntersection<HTMLElement>();
  const reducedMotion = useReducedMotion();

  const kpis = data
    ? [
        {
          icon: <Users size={20} style={{ color: 'var(--ink)' }} aria-hidden="true" />,
          label: 'Children monitored',
          value: data.total_children,
        },
        {
          icon: <MapPin size={20} style={{ color: 'var(--ink)' }} aria-hidden="true" />,
          label: 'Refugee camps',
          value: data.total_camps,
        },
        {
          icon: <Activity size={20} style={{ color: 'var(--success)' }} aria-hidden="true" />,
          label: 'Active CHWs',
          value: data.total_chws_active,
        },
        {
          icon: <Syringe size={20} style={{ color: 'var(--warn)' }} aria-hidden="true" />,
          label: 'Vaccination coverage',
          value: Math.round(data.vaccination_coverage_pct),
          suffix: '%',
        },
      ]
    : [];

  const riskTotal = data
    ? data.risk_distribution.LOW + data.risk_distribution.MEDIUM + data.risk_distribution.HIGH
    : 0;

  return (
    <section
      ref={ref}
      className="py-16 sm:py-24"
      style={{ backgroundColor: 'var(--bg-sand)' }}
      aria-label="Platform statistics"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Protecting children across Rwanda
          </h2>
          <p className="text-base" style={{ color: 'var(--text-muted)' }}>
            Real-time data from displacement camps, updated continuously
          </p>
        </div>

        {/* KPI cards */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : isError || !data ? (
          <div
            className="text-center py-8 rounded-2xl mb-10 text-sm"
            style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--text-muted)' }}
          >
            Live stats unavailable — the server may still be starting.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {kpis.map(({ icon, label, value, suffix }) => (
              <KPICard
                key={label}
                icon={icon}
                label={label}
                value={value}
                suffix={suffix}
                trigger={visible}
                instant={reducedMotion}
              />
            ))}
          </div>
        )}

        {/* Risk distribution + trend chart */}
        {data && (
          <div className="flex flex-col gap-4">
            {/* Distribution snapshot */}
            <div
              className="p-6 sm:p-8 rounded-2xl"
              style={{
                backgroundColor: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text)' }}>30-day health snapshot</h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Risk classification across all monitored children
                  </p>
                </div>
                {data.high_risk_30d > 0 && (
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold self-start shrink-0"
                    style={{
                      backgroundColor: 'var(--high-bg)',
                      color: 'var(--danger)',
                      border: '1px solid var(--danger)',
                    }}
                  >
                    <AlertTriangle size={14} aria-hidden="true" />
                    {data.high_risk_30d} high-risk this month
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <RiskBar
                  label="LOW"
                  value={data.risk_distribution.LOW}
                  total={riskTotal}
                  color="var(--success)"
                  bgColor="var(--low-bg)"
                />
                <RiskBar
                  label="MED"
                  value={data.risk_distribution.MEDIUM}
                  total={riskTotal}
                  color="var(--warn)"
                  bgColor="var(--med-bg)"
                />
                <RiskBar
                  label="HIGH"
                  value={data.risk_distribution.HIGH}
                  total={riskTotal}
                  color="var(--danger)"
                  bgColor="var(--high-bg)"
                />
              </div>
            </div>

            {/* Trend chart */}
            <TrendChart />
          </div>
        )}

      </div>
    </section>
  );
}
