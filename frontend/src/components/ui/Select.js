'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

/** Labelled dropdown. options = [{ value, label }]. */
const Select = forwardRef(function Select(
  { label, error, hint, options = [], placeholder, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error)}
          className={clsx(
            'h-11 w-full appearance-none rounded-xl border bg-white pl-3.5 pr-10 text-sm text-ink transition-colors',
            'focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-300 focus:border-ink focus:ring-ink/10'
          )}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

export default Select;