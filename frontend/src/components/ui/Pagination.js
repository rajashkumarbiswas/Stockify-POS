import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getPages = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap');
    result.push(page);
  });
  return result;
};

/**
 * Uses the `pagination` object returned by the API (meta.pagination).
 * The "pager-*" classes let globals.css restyle it for the dark gradient pages.
 */
export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalItems === 0) return null;

  const { currentPage, totalPages, totalItems, limit, hasNextPage, hasPreviousPage } = pagination;
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(totalItems, currentPage * limit);

  const buttonBase =
    'pager-btn flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors';

  return (
    <div className="flex flex-col items-center justify-between gap-3 px-1 pt-4 sm:flex-row">
      <p className="pager-text text-sm text-slate-600">
        Showing <strong className="text-ink">{start}</strong> to <strong className="text-ink">{end}</strong> of{' '}
        <strong className="text-ink">{totalItems}</strong>
      </p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage}
          className={clsx(buttonBase, 'text-slate-700 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40')}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {getPages(currentPage, totalPages).map((page, index) =>
          page === 'gap' ? (
            <span key={`gap-${index}`} className="pager-gap px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={clsx(
                buttonBase,
                page === currentPage ? 'bg-ink text-white' : 'text-slate-700 hover:bg-black/5'
              )}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className={clsx(buttonBase, 'text-slate-700 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40')}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}