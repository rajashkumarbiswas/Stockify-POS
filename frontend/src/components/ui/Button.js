import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

const VARIANTS = {
  primary: 'bg-ink text-white hover:bg-ink-800 focus-visible:outline-ink',
  brand:
    'bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:from-brand-500 hover:to-brand-700 focus-visible:outline-brand-500',
  secondary: 'border border-slate-300 bg-white text-ink hover:bg-slate-50 focus-visible:outline-ink',
  outline: 'border border-ink bg-white text-ink hover:bg-ink hover:text-white focus-visible:outline-ink',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  ghost: 'text-ink hover:bg-black/5 focus-visible:outline-ink',
};

const SIZES = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  type = 'button',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}