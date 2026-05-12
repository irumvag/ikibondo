'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';

export type AlertVariant = 'success' | 'warn' | 'danger' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  /** Renders an X dismiss button */
  onDismiss?: () => void;
  /** Override default icon */
  icon?: ReactNode;
  className?: string;
}

const VARIANT: Record<AlertVariant, { bg: string; border: string; iconColor: string; defaultIcon: ReactNode }> = {
  success: {
    bg: 'var(--low-bg)',
    border: 'var(--success)',
    iconColor: 'var(--success)',
    defaultIcon: <CheckCircle size={18} />,
  },
  warn: {
    bg: 'var(--med-bg)',
    border: 'var(--warn)',
    iconColor: 'var(--warn)',
    defaultIcon: <AlertTriangle size={18} />,
  },
  danger: {
    bg: 'var(--high-bg)',
    border: 'var(--danger)',
    iconColor: 'var(--danger)',
    defaultIcon: <XCircle size={18} />,
  },
  info: {
    bg: 'var(--bg-sand)',
    border: 'var(--ink)',
    iconColor: 'var(--ink)',
    defaultIcon: <Info size={18} />,
  },
};

export function Alert({ variant, title, children, onDismiss, icon, className = '' }: AlertProps) {
  const { bg, border, iconColor, defaultIcon } = VARIANT[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border-l-4 ${className}`}
      style={{
        backgroundColor: bg,
        borderLeftColor: border,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderWidth: '1px',
        borderLeftWidth: '4px',
      }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: iconColor }}>
        {icon ?? defaultIcon}
      </span>

      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-semibold leading-snug mb-0.5" style={{ color: 'var(--text)' }}>
            {title}
          </p>
        )}
        <div className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {children}
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 hover:bg-black/10 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
