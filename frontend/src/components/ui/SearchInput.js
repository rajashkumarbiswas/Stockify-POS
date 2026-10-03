import { Search, X } from 'lucide-react';
import clsx from 'clsx';

export default function SearchInput({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className={clsx('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-full border border-slate-300 bg-white pl-10 pr-10 text-sm text-ink placeholder:text-slate-400 focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}