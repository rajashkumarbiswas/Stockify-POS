'use client';

import { useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

/** Centered dialog (bottom sheet on phones). Closes on Escape or a click on the dark backdrop. */
export default function Modal({ open, onClose, title, description, size = 'md', children, footer }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        className={clsx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-pill sm:rounded-3xl',
          SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">{children}</div>

        {footer && <div className="flex justify-end gap-2 border-t border-black/5 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}