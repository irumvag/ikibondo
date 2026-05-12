import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generated = useId();
    const inputId   = id ?? generated;
    const errorId   = `${inputId}-err`;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium"
            style={{ color: 'var(--text)' }}
          >
            {label}
            {props.required && (
              <span aria-hidden="true" style={{ color: 'var(--danger)' }}>
                {' '}*
              </span>
            )}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? 'true' : undefined}
          className={[
            'w-full px-3 py-2.5 rounded-xl border text-sm transition-colors',
            'bg-[var(--bg-elev)] text-[var(--text)]',
            'placeholder:text-[var(--text-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-[var(--danger)] focus:ring-[var(--danger)]'
              : 'border-[var(--border)] focus:ring-[var(--ink)] focus:border-transparent',
            className,
          ]
            .join(' ')
            .trim()}
          {...props}
        />

        {error && (
          <p id={errorId} role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
