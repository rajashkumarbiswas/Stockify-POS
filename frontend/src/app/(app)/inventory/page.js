'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, History, Package, PackageCheck, PackageX, SlidersHorizontal, TriangleAlert, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { RECORD_STATUS_OPTIONS, STOCK_STATUS_OPTIONS } from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import StockBadge from '@/components/catalog/StockBadge';
import InventoryTabs from '@/components/inventory/InventoryTabs';
import StockAdjustModal from '@/components/inventory/StockAdjustModal';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import StatCard from '@/components/ui/StatCard';
import TableSkeleton from '@/components/ui/TableSkeleton';

function SummaryCards({ summary }) {
  const { loading, error, data } = summary;
  const show = (value, formatter = formatNumber) => (loading ? '…' : error || !data ? '—' : formatter(value));

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard title="Active products" value={show(data?.totalProducts)} icon={Package} hint={loading || error ? undefined : `${formatNumber(data?.totalUnits)} units in total`} />
      <StatCard title="In stock" value={show(data?.inStock)} icon={PackageCheck} />
      <StatCard title="Low stock" value={show(data?.lowStock)} icon={TriangleAlert} />
      <StatCard title="Out of stock" value={show(data?.outOfStock)} icon={PackageX} />
      <StatCard
        title="Stock value (cost)"
        value={show(data?.stockValueCost, formatMoney)}
        icon={Wallet}
        hint={loading || error ? undefined : `Retail ${formatMoney(data?.stockValueRetail)}`}
      />
    </div>
  );
}

function InventoryContent() {
  const { can } = useAuth();
  const list = usePaginatedList('/inventory', {
    initialParams: { sortBy: 'name', sortOrder: 'asc', status: 'ACTIVE' },
  });
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ loading: true, error: '', data: null });
  const [adjusting, setAdjusting] = useState(null);

  const canAdjust = can('inventory:adjust');
  const canSeeCost = can('products:view_cost');
  const { items, pagination, loading, error, params } = list;
  const columnCount = 7 + (canSeeCost ? 1 : 0) + (canAdjust ? 1 : 0);

  const loadSummary = useCallback(async () => {
    setSummary((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await api.get('/inventory/summary');
      setSummary({ loading: false, error: '', data: res.data });
    } catch (err) {
      setSummary({ loading: false, error: err.message, data: null });
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let active = true;
    api
      .get('/categories/options')
      .then((res) => active && setCategories(res.data.map((c) => ({ value: c.id, label: c.name }))))
      .catch(() => {}); // the filter simply stays empty
    return () => {
      active = false;
    };
  }, []);

  const hasFilters = Boolean(params.search || params.category || params.stockStatus);
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <PageHeader title="Inventory" description="Track stock levels, add or remove stock and review every change." />
      <InventoryTabs />
      <SummaryCards summary={summary} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search name, SKU or barcode..."
          className="lg:w-80"
        />
        <Select
          aria-label="Filter by category"
          placeholder="All categories"
          options={categories}
          value={params.category || ''}
          onChange={(e) => list.setFilter('category', e.target.value)}
          className="lg:w-48"
        />
        <Select
          aria-label="Filter by stock level"
          placeholder="Any stock level"
          options={STOCK_STATUS_OPTIONS}
          value={params.stockStatus || ''}
          onChange={(e) => list.setFilter('stockStatus', e.target.value)}
          className="lg:w-48"
        />
        <Select
          aria-label="Filter by status"
          placeholder="All statuses"
          options={RECORD_STATUS_OPTIONS}
          value={params.status || ''}
          onChange={(e) => list.setFilter('status', e.target.value)}
          className="lg:w-40"
        />
      </div>

      <div className="card overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr>
                  <SortableTh label="Product" field="name" {...sortProps} />
                  <SortableTh label="Stock" field="currentStock" {...sortProps} />
                  <SortableTh label="Min" field="minStockLevel" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Level
                  </th>
                  {canSeeCost && <SortableTh label="Cost" field="purchasePrice" {...sortProps} />}
                  <SortableTh label="Price" field="sellingPrice" {...sortProps} />
                  <SortableTh label="Last update" field="lastStockUpdateAt" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Status
                  </th>
                  {canAdjust && (
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={8} cols={columnCount} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((product) => (
                    <tr key={product.id} className="border-t border-black/5 hover:bg-white/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/products/${product.id}`}
                          className="block max-w-[240px] truncate font-semibold text-ink hover:underline"
                        >
                          {product.name}
                        </Link>
                        <p className="text-xs text-slate-500">{product.sku}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                        {formatNumber(product.currentStock)}{' '}
                        <span className="text-xs font-normal text-slate-500">{product.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatNumber(product.minStockLevel)}</td>
                      <td className="px-4 py-3">
                        <StockBadge status={product.stockStatus} />
                      </td>
                      {canSeeCost && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatMoney(product.purchasePrice)}</td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatMoney(product.sellingPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(product.lastStockUpdateAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={product.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      {canAdjust && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setAdjusting(product)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                              Adjust
                            </button>
                            <Link
                              href={`/inventory/movements?product=${product.id}`}
                              className="rounded-full p-2 text-slate-600 hover:bg-black/5 hover:text-ink"
                              aria-label={`Stock history of ${product.name}`}
                              title="Stock history"
                            >
                              <History className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {!loading && items.length === 0 && (
              <EmptyState
                icon={Boxes}
                title="No products found"
                description={
                  hasFilters
                    ? 'Try a different search or clear the filters.'
                    : 'Add products first, then manage their stock here.'
                }
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />

      {adjusting && (
        <StockAdjustModal
          key={adjusting.id}
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            list.reload();
            loadSummary();
          }}
        />
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <RequirePermission permission="inventory:read">
      <InventoryContent />
    </RequirePermission>
  );
}