import { Boxes } from 'lucide-react';
import clsx from 'clsx';

/**
 * variant="brand": green gradient mark (login page)
 * variant="ink":   black mark (signed-in app)
 */
export default function Logo({ tone = 'dark', size = 'md', variant = 'brand' }) {
  const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const icon = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const text = size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={clsx(
          'flex items-center justify-center text-white shadow-sm',
          variant === 'ink' ? 'bg-ink' : 'bg-gradient-to-br from-brand-300 to-brand-600',
          box
        )}
      >
        <Boxes className={icon} aria-hidden="true" />
      </span>
      <span className={clsx('font-bold tracking-tight', text, tone === 'light' ? 'text-white' : 'text-ink')}>
        Stockify
      </span>
    </span>
  );
}