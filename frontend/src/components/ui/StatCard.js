import Badge from '@/components/ui/Badge';

/**
 * Dashboard statistic tile. `value` must come from the backend (never hardcoded).
 * Pass `badge={{ tone: 'lime', label: '+10%' }}` for a change indicator.
 */
export default function StatCard({ title, value, hint, icon: Icon, badge }) {
  return (
    <div className="card flex flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-card">
            <Icon className="h-5 w-5 text-ink" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-5">
        <div className="flex items-center gap-2">
          <p className="text-3xl font-bold tracking-tight text-ink">{value}</p>
          {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
        </div>
        {hint && <p className="mt-3 border-t border-black/5 pt-3 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}