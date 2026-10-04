'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';
import useClickOutside from '@/hooks/useClickOutside';
import useDebounce from '@/hooks/useDebounce';
import SearchInput from '@/components/ui/SearchInput';

/** Search active products by name, SKU or barcode (done by the API) and pick one. Enter adds the first result. */
export default function ProductPicker({ onSelect }) {
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 300);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  useEffect(() => {
    const query = debounced.trim();
    if (!query) {
      setResults([]);
      return undefined;
    }

    let active = true;
    setLoading(true);
    api
      .get('/products', { search: query, limit: 8, status: 'ACTIVE', sortBy: 'name', sortOrder: 'asc' })
      .then((res) => {
        if (!active) return;
        setResults(res.data);
        setOpen(true);
      })
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [debounced]);

  const choose = (product) => {
    onSelect(product);
    setTerm('');
    setResults([]);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (results[0]) choose(results[0]);
    }
  };

  return (
    <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
      <SearchInput value={term} onChange={setTerm} placeholder="Search a product by name, SKU or barcode to add it..." />
      {loading && (
        <Loader2
          className="absolute right-11 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
          aria-hidden="true"
        />
      )}

      {open && term.trim() && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-black/5 bg-white p-2 shadow-pill">
          {results.length === 0 && !loading ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No active products found.</p>
          ) : (
            results.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => choose(product)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-black/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{product.name}</span>
                  <span className="block text-xs text-slate-500">
                    {product.sku} · stock {formatNumber(product.currentStock)} {product.unit}
                    {product.purchasePrice !== undefined ? ` · cost ${formatMoney(product.purchasePrice)}` : ''}
                  </span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}