import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size    = 'md',
      loading,
      children,
      disabled,
      className = '',
      ...props
    },
    ref,
  ) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-xl ' +
      'transition-all select-none ' +
      'focus-visible:outline-none focus-visible:ring-2 ' +
      'focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2';

    const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 active:scale-[.98]',
      secondary:
        'bg-[var(--bg-sand)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--bg-elev)]',
      ghost:
        'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-sand)]',
      danger:
        'bg-[var(--danger)] text-white hover:opacity-90 active:scale-[.98]',
    };

    const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'px-3 py-1.5 text-sm gap-1.5 h-8',
      md: 'px-5 py-2.5 text-sm gap-2 h-10',
      lg: 'px-6 py-3 text-base gap-2 h-12',
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        className={`${base} ${variantClass[variant]} ${sizeClass[size]} ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
