import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';

export const TH_CLASS = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';

/** Table header cell that sorts the list on the server when clicked. */
export default function SortableTh({ label, field, sortBy, sortOrder, onSort, className }) {
  const active = sortBy === field;
  const Icon = active ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={clsx(TH_CLASS, className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={clsx('inline-flex items-center gap-1.5 uppercase', active ? 'text-ink' : 'hover:text-ink')}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </th>
  );
}