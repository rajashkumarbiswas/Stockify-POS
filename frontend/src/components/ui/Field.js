'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';

const TONES = {
  light: {
    label: 'text-ink',
    input:
      'border-slate-300 bg-white text-ink placeholder:text-slate-400 focus:border-ink focus:ring-ink/10',
    icon: 'text-slate-400',
    hint: 'text-slate-500',
    error: 'text-red-600',
  },
  dark: {
    label: 'text-slate-200',
    input:
      'border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-brand-400 focus:ring-brand-400/20',
    icon: 'text-slate-500',
    hint: 'text-slate-400',
    error: 'text-red-400',
  },
};

/**
 * Labelled input with optional leading icon, right-side element, hint and error text.
 * tone="dark" is used on the login page.
 */
const Field = forwardRef(function Field(
  { label, error, hint, icon: Icon, rightElement, tone = 'light', className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const t = TONES[tone] || TONES.light;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className={clsx('mb-1.5 block text-sm font-medium', t.label)}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className={clsx('pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2', t.icon)}
            aria-hidden="true"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={clsx(
            'h-11 w-full rounded-xl border text-sm transition-colors',
            'focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
            Icon ? 'pl-10' : 'pl-3.5',
            rightElement ? 'pr-11' : 'pr-3.5',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : t.input
          )}
          {...props}
        />
        {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className={clsx('mt-1.5 text-sm', t.error)}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className={clsx('mt-1.5 text-xs', t.hint)}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Field;