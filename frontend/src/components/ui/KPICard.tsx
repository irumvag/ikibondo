import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from './Skeleton';

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
      className={`flex flex-col gap-3 p-5 rounded-2xl ${className}`}
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Top row: icon + label */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        {icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--bg-sand)', color: accent }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      {isLoading ? (
        <Skeleton className="h-9 w-24 rounded-lg" />
      ) : (
        <p
          className="text-3xl font-bold leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          {value}
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
