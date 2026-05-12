import type { ReactNode } from 'react';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warn'
  | 'danger'
  | 'info'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH';

const VARIANT_STYLES: Record<
  BadgeVariant,
  { bg: string; color: string; border: string }
> = {
  default:  { bg: 'var(--bg-sand)',  color: 'var(--text-muted)', border: 'var(--border)' },
  success:  { bg: 'var(--low-bg)',   color: 'var(--success)',    border: 'color-mix(in srgb, var(--success) 35%, transparent)' },
  warn:     { bg: 'var(--med-bg)',   color: 'var(--warn)',       border: 'color-mix(in srgb, var(--warn) 35%, transparent)' },
  danger:   { bg: 'var(--high-bg)',  color: 'var(--danger)',     border: 'color-mix(in srgb, var(--danger) 35%, transparent)' },
  info:     { bg: 'var(--bg-sand)',  color: 'var(--ink-soft)',   border: 'var(--border)' },
  LOW:      { bg: 'var(--low-bg)',   color: 'var(--success)',    border: 'color-mix(in srgb, var(--success) 35%, transparent)' },
  MEDIUM:   { bg: 'var(--med-bg)',   color: 'var(--warn)',       border: 'color-mix(in srgb, var(--warn) 35%, transparent)' },
  HIGH:     { bg: 'var(--high-bg)',  color: 'var(--danger)',     border: 'color-mix(in srgb, var(--danger) 35%, transparent)' },
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({
  variant = 'default',
  children,
  dot = false,
  className = '',
}: BadgeProps) {
  const { bg, color, border } = VARIANT_STYLES[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${className}`}
      style={{ backgroundColor: bg, color, borderColor: border }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
