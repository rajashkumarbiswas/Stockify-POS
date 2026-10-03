'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import useDebounce from '@/hooks/useDebounce';

/**
 * Backend-powered list: search, filters, sorting and pagination are all sent to the API.
 *
 *   const list = usePaginatedList('/products', { initialParams: { sortBy: 'name', sortOrder: 'asc' } });
 *   list.items / list.pagination / list.loading / list.error
 *   list.setPage(2)  list.setFilter('category', id)  list.setSort('name')  list.reload()
 */
export default function usePaginatedList(endpoint, { initialParams = {} } = {}) {
  const [params, setParams] = useState({ page: 1, limit: 10, search: '', ...initialParams });
  const [searchInput, setSearchInput] = useState(initialParams.search || '');
  const debouncedSearch = useDebounce(searchInput, 400);
  const [state, setState] = useState({ items: [], pagination: null, loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequest = useRef(0);

  // Typing in the search box updates the query only after a short pause
  useEffect(() => {
    setParams((p) => (p.search === debouncedSearch ? p : { ...p, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    api
      .get(endpoint, params)
      .then((res) => {
        if (requestId !== latestRequest.current) return; // an older request finished late: ignore it

        const pagination = res.meta?.pagination ?? null;
        // The last item of the last page was removed: go back one page
        if (pagination && res.data.length === 0 && pagination.currentPage > 1) {
          setParams((p) => ({ ...p, page: Math.max(1, pagination.totalPages) }));
          return;
        }
        setState({ items: res.data, pagination, loading: false, error: null });
      })
      .catch((err) => {
        if (requestId !== latestRequest.current) return;
        setState((s) => ({ ...s, loading: false, error: err.message }));
      });
  }, [endpoint, params, reloadKey]);

  const setPage = useCallback((page) => setParams((p) => ({ ...p, page })), []);
  const setFilter = useCallback((key, value) => setParams((p) => ({ ...p, [key]: value, page: 1 })), []);
  const setSort = useCallback(
    (field) =>
      setParams((p) => ({
        ...p,
        sortBy: field,
        sortOrder: p.sortBy === field && p.sortOrder === 'asc' ? 'desc' : 'asc',
        page: 1,
      })),
    []
  );
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { ...state, params, searchInput, setSearchInput, setPage, setFilter, setSort, reload };
}