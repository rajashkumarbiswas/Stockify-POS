'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, X } from 'lucide-react';
import { api } from '@/lib/api';
import { DATE_RANGE_OPTIONS, MOVEMENT_TYPE_OPTIONS } from '@/lib/constants';
import { formatDateTime, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import InventoryTabs from '@/components/inventory/InventoryTabs';
import MovementTypeBadge from '@/components/inventory/MovementTypeBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';

function MovementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('product') || '';

  const list = usePaginatedList('/inventory/movements', {
    initialParams: { sortBy: 'createdAt', sortOrder: 'desc', product: productId },
  });
  const { items, pagination, loading, error, params } = list;

  const [productName, setProductName] = useState('');
  const [rangeChoice, setRangeChoice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (!productId) return undefined;
    let active = true;
    api
      .get(`/products/${productId}`)
      .then((res) => active && setProductName(res.data.name))
      .catch(() => active && setProductName('selected product'));
    return () => {
      active = false;
    };
  }, [productId]);

  const clearProduct = () => {
    setProductName('');
    list.setFilter('product', '');
    router.replace('/inventory/movements');
  };

  const applyCustom = (nextFrom, nextTo) => {
    setDateError('');
    if (!nextFrom || !nextTo) return; // wait until both dates are chosen
    if (nextFrom > nextTo) {
      setDateError('The start date must not be after the end date');
      return;
    }
    list.setFilters({ range: 'custom', from: nextFrom, to: nextTo });
  };

  const onRangeChange = (value) => {
    setRangeChoice(value);
    setDateError('');
    if (value === 'custom') {
      list.setFilters({ range: '', from: '', to: '' });
      applyCustom(from, to);
    } else {
      list.setFilters({ range: value, from: '', to: '' });
    }
  };

  const hasFilters = Boolean(params.type || params.range || params.product);
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <PageHeader title="Inventory" description="Every change to your stock, with who did it and why." />
      <InventoryTabs />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <Select
          aria-label="Filter by type"
          placeholder="All movement types"
          options={MOVEMENT_TYPE_OPTIONS}
          value={params.type || ''}
          onChange={(e) => list.setFilter('type', e.target.value)}
          className="lg:w-56"
        />
        <Select
          aria-label="Filter by date"
          placeholder="All time"
          options={DATE_RANGE_OPTIONS}
          value={rangeChoice}
          onChange={(e) => onRangeChange(e.target.value)}
          className="lg:w-48"
        />
        {rangeChoice === 'custom' && (
          <>
            <Field
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                applyCustom(e.target.value, to);
              }}
              className="lg:w-44"
            />
            <Field
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                applyCustom(from, e.target.value);
              }}
              className="lg:w-44"
            />
          </>
        )}
        {productId && (
          <button
            type="button"
            onClick={clearProduct}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink-800"
          >
            {productName || 'Loading...'}
            <X className="h-4 w-4" aria-label="Clear product filter" />
          </button>
        )}
      </div>
      {rangeChoice === 'custom' && !dateError && (!from || !to) && (
        <p className="mb-3 text-sm text-slate-600">Pick both dates to filter.</p>
      )}
      {dateError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {dateError}
        </p>
      )}

      <div className="card overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr>
                  <SortableTh label="Date" field="createdAt" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Product
                  </th>
                  <SortableTh label="Type" field="type" {...sortProps} />
                  <SortableTh label="Change" field="quantity" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Stock
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Reason
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    By
                  </th>
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={8} cols={7} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((movement) => {
                    const delta = movement.newStock - movement.previousStock;
                    return (
                      <tr key={movement.id} className="border-t border-black/5 hover:bg-white/60">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDateTime(movement.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {movement.product ? (
                            <>
                              <Link
                                href={`/products/${movement.product.id}`}
                                className="block max-w-[220px] truncate font-semibold text-ink hover:underline"
                              >
                                {movement.product.name}
                              </Link>
                              <p className="text-xs text-slate-500">{movement.product.sku}</p>
                            </>
                          ) : (
                            <span className="text-slate-500">Deleted product</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <MovementTypeBadge type={movement.type} />
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 font-semibold ${
                            delta >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {delta >= 0 ? '+' : '−'}
                          {formatNumber(movement.quantity)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatNumber(movement.previousStock)} → <strong className="text-ink">{formatNumber(movement.newStock)}</strong>
                        </td>
                        <td className="max-w-[240px] truncate px-4 py-3 text-slate-600" title={movement.reason}>
                          {movement.reason || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{movement.user?.name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>

            {!loading && items.length === 0 && (
              <EmptyState
                icon={History}
                title="No stock movements found"
                description={
                  hasFilters
                    ? 'Try a different filter.'
                    : 'Movements appear here when stock is added, sold, returned or adjusted.'
                }
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />
    </div>
  );
}

export default function MovementsPage() {
  return (
    <RequirePermission permission="inventory:read">
      <Suspense fallback={null}>
        <MovementsContent />
      </Suspense>
    </RequirePermission>
  );
}