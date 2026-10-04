'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { RECORD_STATUS_OPTIONS } from '@/lib/constants';
import { formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import SupplierFormModal from '@/components/suppliers/SupplierFormModal';
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
const ICON_BUTTON = 'rounded-full p-2 text-slate-500 transition-colors hover:bg-[#dcfce7] hover:text-[#15803d]';

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function SuppliersList() {
  const { can } = useAuth();
  const list = usePaginatedList('/suppliers', { initialParams: { sortBy: 'name', sortOrder: 'asc' } });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, supplier = edit
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { items, pagination, loading, error, params } = list;
  const canCreate = can('suppliers:create');
  const canUpdate = can('suppliers:update');
  const canDelete = can('suppliers:delete');
  const total = pagination?.totalItems;

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await api.delete(`/suppliers/${deleting.id}`);
      toast.success(res.message);
      setDeleting(null);
      list.reload();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const hasFilters = Boolean(params.search || params.status);
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            The businesses you buy from, with what you have bought and still owe.
            {total !== undefined && total !== null && (
              <span className="ml-2 rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-xs font-medium text-[#15803d]">
                {formatNumber(total)} total
              </span>
            )}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setEditing({})} className={DARK_BUTTON}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New supplier
          </button>
        )}
      </header>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            value={list.searchInput}
            onChange={list.setSearchInput}
            placeholder="Search name, company, phone or email..."
            className="sm:w-96"
          />
          <Select
            aria-label="Filter by status"
            placeholder="All statuses"
            options={RECORD_STATUS_OPTIONS}
            value={params.status || ''}
            onChange={(e) => list.setFilter('status', e.target.value)}
            className="sm:w-48"
          />
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#f0fdf4]">
                <tr>
                  <SortableTh label="Supplier" field="name" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Contact
                  </th>
                  <SortableTh label="Total purchases" field="totalPurchases" {...sortProps} />
                  <SortableTh label="Due amount" field="dueAmount" {...sortProps} />
                  <SortableTh label="Status" field="status" {...sortProps} />
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={6} cols={6} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((supplier) => (
                    <tr key={supplier.id} className="border-t border-black/5 transition-colors hover:bg-[#f7fdf9]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#dcfce7] text-xs font-bold text-[#15803d]">
                            {initials(supplier.name)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/suppliers/${supplier.id}`}
                              className="block truncate font-semibold text-ink hover:text-[#15803d]"
                            >
                              {supplier.name}
                            </Link>
                            {supplier.company && <p className="text-xs text-slate-500">{supplier.company}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {supplier.phone || '—'}
                        {supplier.email && <p className="text-xs text-slate-500">{supplier.email}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatMoney(supplier.totalPurchases)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          supplier.dueAmount > 0 ? 'text-red-600' : 'text-slate-700'
                        }`}
                      >
                        {formatMoney(supplier.dueAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={supplier.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {supplier.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/suppliers/${supplier.id}`}
                            className={ICON_BUTTON}
                            aria-label={`View ${supplier.name}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => setEditing(supplier)}
                              className={ICON_BUTTON}
                              aria-label={`Edit ${supplier.name}`}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError('');
                                setDeleting(supplier);
                              }}
                              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label={`Delete ${supplier.name}`}
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
                icon={Truck}
                title="No suppliers found"
                description={
                  hasFilters
                    ? 'Try a different search or clear the filters.'
                    : 'Add your first supplier to start recording purchases.'
                }
                action={
                  canCreate &&
                  !hasFilters && (
                    <button type="button" onClick={() => setEditing({})} className={DARK_BUTTON}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New supplier
                    </button>
                  )
                }
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />

      {editing && (
        <SupplierFormModal
          key={editing.id || 'new'}
          supplier={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete supplier?"
        message={`"${deleting?.name}" will be permanently deleted. A supplier with purchases on record cannot be deleted: set it to inactive instead.`}
        confirmLabel="Delete"
        loading={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <RequirePermission permission="suppliers:read">
      <SuppliersList />
    </RequirePermission>
  );
}