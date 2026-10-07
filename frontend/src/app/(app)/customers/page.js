'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import CustomerFormModal from '@/components/customers/CustomerFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';

const DARK_BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-full bg-[#1c1c20] px-5 text-sm font-medium text-white transition-colors hover:bg-black';
const ICON_BUTTON = 'rounded-full p-2 text-slate-500 transition-colors hover:bg-[#ece9f8] hover:text-[#6b5fb0]';

function CustomersList() {
  const { can } = useAuth();
  const list = usePaginatedList('/customers', { initialParams: { sortBy: 'name', sortOrder: 'asc' } });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, customer = edit
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { items, pagination, loading, error, params } = list;
  const canCreate = can('customers:create');
  const canUpdate = can('customers:update');
  const canDelete = can('customers:delete');
  const total = pagination?.totalItems;
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await api.delete(`/customers/${deleting.id}`);
      toast.success(res.message);
      setDeleting(null);
      list.reload();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your regular buyers, with their purchase history and dues.
            {total !== undefined && total !== null && (
              <span className="ml-2 rounded-full bg-[#ece9f8] px-2.5 py-0.5 text-xs font-medium text-[#6b5fb0]">
                {formatNumber(total)} total
              </span>
            )}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setEditing({})} className={DARK_BUTTON}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New customer
          </button>
        )}
      </header>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search name, phone or email..."
          className="sm:w-80"
        />
      </section>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#f6f4fc]">
                <tr>
                  <SortableTh label="Customer" field="name" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Contact
                  </th>
                  <SortableTh label="Purchases" field="totalPurchases" {...sortProps} />
                  <SortableTh label="Total spent" field="totalSpent" {...sortProps} />
                  <SortableTh label="Due" field="dueAmount" {...sortProps} />
                  <SortableTh label="Joined" field="createdAt" {...sortProps} />
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={8} cols={7} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((customer) => (
                    <tr key={customer.id} className="border-t border-black/5 transition-colors hover:bg-[#faf9fe]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ece9f8] text-xs font-bold text-[#6b5fb0]">
                            {customer.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/customers/${customer.id}`}
                              className="block max-w-[220px] truncate font-semibold text-ink hover:text-[#6b5fb0]"
                            >
                              {customer.name}
                            </Link>
                            {customer.address && (
                              <p className="max-w-[220px] truncate text-xs text-slate-500">{customer.address}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-700">{customer.phone || '—'}</p>
                        {customer.email && <p className="max-w-[200px] truncate text-xs text-slate-500">{customer.email}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{formatNumber(customer.totalPurchases)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-ink">
                        {formatMoney(customer.totalSpent)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3.5 ${
                          customer.dueAmount > 0 ? 'font-semibold text-red-600' : 'text-slate-500'
                        }`}
                      >
                        {formatMoney(customer.dueAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{formatDate(customer.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/customers/${customer.id}`}
                            className={ICON_BUTTON}
                            aria-label={`View ${customer.name}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => setEditing(customer)}
                              className={ICON_BUTTON}
                              aria-label={`Edit ${customer.name}`}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError('');
                                setDeleting(customer);
                              }}
                              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label={`Delete ${customer.name}`}
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
                icon={Users}
                title="No customers found"
                description={params.search ? 'Try a different search.' : 'Add your first customer to get started.'}
                action={
                  canCreate &&
                  !params.search && (
                    <button type="button" onClick={() => setEditing({})} className={DARK_BUTTON}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New customer
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
        <CustomerFormModal
          key={editing.id || 'new'}
          customer={editing}
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
        title="Delete customer?"
        message={`"${deleting?.name}" will be permanently deleted. Customers who already have sales cannot be deleted.`}
        confirmLabel="Delete"
        loading={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}

export default function CustomersPage() {
  return (
    <RequirePermission permission="customers:read">
      <CustomersList />
    </RequirePermission>
  );
}