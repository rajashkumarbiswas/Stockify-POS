import clsx from 'clsx';

const TONES = {
  lime: 'bg-lime-300 text-lime-950',
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-200 text-slate-700',
};

/** Small pill for statuses and percentages, e.g. <Badge tone="success">Complete</Badge> */
export default function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}