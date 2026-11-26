import { useId } from 'react';

/**
 * Ikibondo mark: a rising growth curve on a blue tile, the same drawing as the
 * mobile app (mobile/lib/shared/widgets/brand.dart) and the launcher icon.
 * `name` adds the wordmark beside it.
 */
export function Logo({ size = 32, name = true, className = '' }: { size?: number; name?: boolean; className?: string }) {
  const id = useId();
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 100 100" role={name ? undefined : 'img'}
        aria-label={name ? undefined : 'Ikibondo'} aria-hidden={name ? true : undefined}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#0E4C92" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="28" fill={`url(#${id}-g)`} />
        <polyline points="20,74 36,56 52,48 68,36" fill="none" stroke="#fff" strokeWidth="7.5"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="36" cy="56" r="5.5" fill="#fff" />
        <circle cx="52" cy="48" r="5.5" fill="#fff" />
        <circle cx="76" cy="30" r="11" fill="#0EA5A4" />
      </svg>
      {name && (
        <span className="font-extrabold tracking-tight" style={{ fontSize: size * 0.62, color: 'var(--ink)', lineHeight: 1 }}>
          Ikibondo
        </span>
      )}
    </span>
  );
}
