'use client';

import { forwardRef, useId } from 'react';
import clsx from 'clsx';

const Textarea = forwardRef(function Textarea({ label, error, hint, className, id, rows = 3, ...props }, ref) {
  const generatedId = useId();
  const textareaId = id || generatedId;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={clsx(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400',
          'focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-300 focus:border-ink focus:ring-ink/10'
        )}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

export default Textarea;