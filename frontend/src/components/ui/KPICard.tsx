import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { CountUp } from './CountUp';

interface Delta {
  value: number;   // positive = up, negative = down, 0 = flat
  label: string;   // e.g. "vs last week"
}

interface KPICardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  delta?: Delta;
  /** Semantic colour of the card accent */
  variant?: 'default' | 'success' | 'warn' | 'danger';
  subtext?: string;
  isLoading?: boolean;
  className?: string;
}

const ACCENT: Record<NonNullable<KPICardProps['variant']>, string> = {
  default: 'var(--ink)',
  success: 'var(--success)',
  warn:    'var(--warn)',
  danger:  'var(--danger)',
};

export function KPICard({
  label,
  value,
  icon,
  delta,
  variant = 'default',
  subtext,
  isLoading = false,
  className = '',
}: KPICardProps) {
  const accent = ACCENT[variant];

  const DeltaIcon =
    !delta ? null
    : delta.value > 0 ? TrendingUp
    : delta.value < 0 ? TrendingDown
    : Minus;

  const deltaColor =
    !delta ? 'var(--text-muted)'
    : delta.value > 0 ? 'var(--success)'
    : delta.value < 0 ? 'var(--danger)'
    : 'var(--text-muted)';

  return (
    <div
      className={`flex flex-col gap-3 p-5 rounded-[var(--radius-sm)] ${className}`}
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        // The left rule carries meaning: it is coloured only when the figure needs attention
        borderLeft: `4px solid ${variant === 'default' ? 'var(--rule)' : accent}`,
      }}
    >
      {/* Label, with the icon inline as a small identifier rather than a decorative tile */}
      <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
        {icon && (
          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4" style={{ color: accent }} aria-hidden="true">
            {icon}
          </span>
        )}
        {label}
      </p>

      {/* Value */}
      {isLoading ? (
        <Skeleton className="h-10 w-24" />
      ) : (
        <p
          className="text-4xl font-extrabold leading-none tabular-nums"
          style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </p>
      )}

      {/* Delta + subtext */}
      {(delta || subtext) && (
        <div className="flex items-center gap-2">
          {delta && DeltaIcon && !isLoading && (
            <span
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: deltaColor }}
            >
              <DeltaIcon size={13} aria-hidden="true" />
              {Math.abs(delta.value)}%{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {delta.label}
              </span>
            </span>
          )}
          {subtext && !delta && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
