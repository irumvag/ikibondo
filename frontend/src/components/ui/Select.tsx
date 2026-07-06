import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = '', id, ...props }, ref) => {
    const generated = useId();
    const selectId  = id ?? generated;
    const errorId   = `${selectId}-err`;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium"
            style={{ color: 'var(--text)' }}
          >
            {label}
            {props.required && (
              <span aria-hidden="true" style={{ color: 'var(--danger)' }}> *</span>
            )}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? 'true' : undefined}
            className={[
              'w-full appearance-none px-3 py-2.5 pr-9 rounded-xl border text-sm',
              'bg-[var(--bg-elev)] text-[var(--text)]',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'transition-colors cursor-pointer',
              error
                ? 'border-[var(--danger)] focus:ring-[var(--danger)]'
                : 'border-[var(--border)] focus:ring-[var(--ink)] focus:border-transparent',
              className,
            ].join(' ').trim()}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
        </div>

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
Select.displayName = 'Select';
