import type { ReactNode } from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-16 px-6 text-center rounded-2xl ${className}`}
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {icon && (
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <div className="max-w-xs">
        <p
          className="text-base font-semibold mb-1"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          {title}
        </p>
        {description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>

      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center px-5 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center px-5 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
