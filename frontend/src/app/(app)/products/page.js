'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Package, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { RECORD_STATUS_OPTIONS, STOCK_STATUS_OPTIONS } from '@/lib/constants';
import { formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import StockBadge from '@/components/catalog/StockBadge';
import Badge from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';

const DARK_BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-full bg-[#1c1c20] px-5 text-sm font-medium text-white transition-colors hover:bg-black';
const ICON_BUTTON = 'rounded-full p-2 text-slate-500 transition-colors hover:bg-[#ece9f8] hover:text-[#6b5fb0]';

function Thumbnail({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ece9f8]">
        <Package className="h-5 w-5 text-[#8b7fc7]" aria-hidden="true" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-11 w-11 shrink-0 rounded-2xl bg-[#ece9f8] object-cover"
    />
  );
}

function ProductsList() {
  const { can } = useAuth();
  const list = usePaginatedList('/products', { initialParams: { sortBy: 'name', sortOrder: 'asc' } });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const canCreate = can('products:create');
  const canUpdate = can('products:update');
  const canDelete = can('products:delete');
  const canSeeCost = can('products:view_cost');
  const { items, pagination, loading, error, params } = list;
  const columnCount = 7 + (canSeeCost ? 1 : 0);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/categories/options'), api.get('/brands/options')])
      .then(([cats, brs]) => {
        if (!active) return;
        setCategories(cats.data.map((c) => ({ value: c.id, label: c.name })));
        setBrands(brs.data.map((b) => ({ value: b.id, label: b.name })));
      })
      .catch(() => {}); // the filters simply stay empty; the list itself reports its own errors
    return () => {
      active = false;
    };
  }, []);

  const toggleStatus = async (product) => {
    setTogglingId(product.id);
    try {
      const nextStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await api.patch(`/products/${product.id}/status`, { status: nextStatus });
      toast.success(res.message);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await api.delete(`/products/${deleting.id}`);
      toast.success(res.message);
      setDeleting(null);
      list.reload();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const hasFilters = Boolean(params.search || params.category || params.brand || params.status || params.stockStatus);
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };
  const total = pagination?.totalItems;

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everything you sell, with prices and stock levels.
            {total !== undefined && total !== null && (
              <span className="ml-2 rounded-full bg-[#ece9f8] px-2.5 py-0.5 text-xs font-medium text-[#6b5fb0]">
                {formatNumber(total)} total
              </span>
            )}
          </p>
        </div>
        {canCreate && (
          <Link href="/products/new" className={DARK_BUTTON}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New product
          </Link>
        )}
      </header>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
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
            aria-label="Filter by brand"
            placeholder="All brands"
            options={brands}
            value={params.brand || ''}
            onChange={(e) => list.setFilter('brand', e.target.value)}
            className="lg:w-44"
          />
          <Select
            aria-label="Filter by stock"
            placeholder="Any stock level"
            options={STOCK_STATUS_OPTIONS}
            value={params.stockStatus || ''}
            onChange={(e) => list.setFilter('stockStatus', e.target.value)}
            className="lg:w-44"
          />
          {canUpdate && (
            <Select
              aria-label="Filter by status"
              placeholder="All statuses"
              options={RECORD_STATUS_OPTIONS}
              value={params.status || ''}
              onChange={(e) => list.setFilter('status', e.target.value)}
              className="lg:w-40"
            />
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[#f6f4fc]">
                <tr>
                  <SortableTh label="Product" field="name" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Category
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Brand
                  </th>
                  {canSeeCost && <SortableTh label="Cost" field="purchasePrice" {...sortProps} />}
                  <SortableTh label="Price" field="sellingPrice" {...sortProps} />
                  <SortableTh label="Stock" field="currentStock" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Status
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={8} cols={columnCount} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((product) => (
                    <tr key={product.id} className="border-t border-black/5 transition-colors hover:bg-[#faf9fe]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumbnail src={product.image} name={product.name} />
                          <div className="min-w-0">
                            <Link
                              href={`/products/${product.id}`}
                              className="block max-w-[260px] truncate font-semibold text-ink hover:text-[#6b5fb0]"
                            >
                              {product.name}
                            </Link>
                            <p className="text-xs text-slate-500">
                              {product.sku}
                              {product.barcode ? ` · ${product.barcode}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{product.category?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{product.brand?.name || '—'}</td>
                      {canSeeCost && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatMoney(product.purchasePrice)}</td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                        {formatMoney(product.sellingPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">
                            {formatNumber(product.currentStock)}{' '}
                            <span className="text-xs font-normal text-slate-500">{product.unit}</span>
                          </span>
                          <StockBadge status={product.stockStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={product.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/products/${product.id}`}
                            className={ICON_BUTTON}
                            aria-label={`View ${product.name}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          {canUpdate && (
                            <>
                              <Link
                                href={`/products/${product.id}`}
                                className={ICON_BUTTON}
                                aria-label={`Edit ${product.name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => toggleStatus(product)}
                                disabled={togglingId === product.id}
                                className={`${ICON_BUTTON} disabled:opacity-50`}
                                aria-label={
                                  product.status === 'ACTIVE' ? `Deactivate ${product.name}` : `Activate ${product.name}`
                                }
                                title={product.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              >
                                <Power className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError('');
                                setDeleting(product);
                              }}
                              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label={`Delete ${product.name}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {!loading && items.length === 0 && (
              <EmptyState
                icon={Package}
                title="No products found"
                description={
                  hasFilters ? 'Try a different search or clear the filters.' : 'Add your first product to get started.'
                }
                action={
                  canCreate &&
                  !hasFilters && (
                    <Link href="/products/new" className={DARK_BUTTON}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New product
                    </Link>
                  )
                }
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete product?"
        message={`"${deleting?.name}" will be permanently deleted. Products that already have sales, purchases or stock history cannot be deleted: deactivate them instead.`}
        confirmLabel="Delete"
        loading={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <RequirePermission permission="products:read">
      <ProductsList />
    </RequirePermission>
  );
}