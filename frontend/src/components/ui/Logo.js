import { Boxes } from 'lucide-react';
import clsx from 'clsx';

/**
 * Stockify logo: green rounded box with a white icon, then the name.
 * tone="dark"  -> black text (on light backgrounds, e.g. the white menu bar)
 * tone="light" -> white text (on the dark login page)
 * The "variant" prop is still accepted by older code but no longer changes anything:
 * the box is always green.
 */
export default function Logo({ tone = 'dark', size = 'md' }) {
  const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const icon = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const text = size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={clsx(
          'flex items-center justify-center bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm',
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