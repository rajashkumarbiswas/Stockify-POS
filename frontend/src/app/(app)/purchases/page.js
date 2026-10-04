'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Plus, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PAYMENT_STATUS_OPTIONS, PURCHASE_STATUS_OPTIONS } from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import { PaymentStatusBadge, PurchaseStatusBadge } from '@/components/purchases/StatusBadges';
import Button from '@/components/ui/Button';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';

function PurchasesList() {
  const { can } = useAuth();
  const list = usePaginatedList('/purchases', { initialParams: { sortBy: 'purchaseDate', sortOrder: 'desc' } });
  const [suppliers, setSuppliers] = useState([]);

  const { items, pagination, loading, error, params } = list;
  const canCreate = can('purchases:create');

  useEffect(() => {
    let active = true;
    api
      .get('/suppliers/options')
      .then((res) => active && setSuppliers(res.data.map((s) => ({ value: s.id, label: s.name }))))
      .catch(() => {}); // the filter simply stays empty
    return () => {
      active = false;
    };
  }, []);

  const hasFilters = Boolean(
    params.search || params.supplier || params.status || params.paymentStatus || params.range
  );
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Stock you buy from suppliers, what you paid and what you still owe."
        actions={
          canCreate && (
            <Link href="/purchases/new">
              <Button icon={Plus}>New purchase</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap">
        <SearchInput
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search invoice number or supplier..."
          className="lg:w-80"
        />
        <Select
          aria-label="Filter by supplier"
          placeholder="All suppliers"
          options={suppliers}
          value={params.supplier || ''}
          onChange={(e) => list.setFilter('supplier', e.target.value)}
          className="lg:w-48"
        />
        <Select
          aria-label="Filter by status"
          placeholder="All statuses"
          options={PURCHASE_STATUS_OPTIONS}
          value={params.status || ''}
          onChange={(e) => list.setFilter('status', e.target.value)}
          className="lg:w-40"
        />
        <Select
          aria-label="Filter by payment"
          placeholder="Any payment"
          options={PAYMENT_STATUS_OPTIONS}
          value={params.paymentStatus || ''}
          onChange={(e) => list.setFilter('paymentStatus', e.target.value)}
          className="lg:w-40"
        />
        <DateRangeFilter onChange={list.setFilters} className="lg:w-44" />
      </div>

      <div className="card overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr>
                  <SortableTh label="Invoice" field="invoiceNumber" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Supplier
                  </th>
                  <SortableTh label="Date" field="purchaseDate" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Items
                  </th>
                  <SortableTh label="Total" field="grandTotal" {...sortProps} />
                  <SortableTh label="Paid" field="paidAmount" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Due
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Status
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Payment
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    View
                  </th>
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={8} cols={10} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((purchase) => (
                    <tr key={purchase.id} className="border-t border-black/5 hover:bg-white/60">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link href={`/purchases/${purchase.id}`} className="font-semibold text-ink hover:underline">
                          {purchase.invoiceNumber}
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">
                        {purchase.supplier?.name || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(purchase.purchaseDate)}</td>
                      <td className="px-4 py-3 text-slate-700">{purchase.items.length}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{formatMoney(purchase.grandTotal)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatMoney(purchase.paidAmount)}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 ${
                          purchase.status === 'RECEIVED' && purchase.dueAmount > 0 ? 'font-semibold text-red-600' : 'text-slate-700'
                        }`}
                      >
                        {purchase.status === 'RECEIVED' ? formatMoney(purchase.dueAmount) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <PurchaseStatusBadge status={purchase.status} />
                      </td>
                      <td className="px-4 py-3">
                        {purchase.status === 'RECEIVED' ? <PaymentStatusBadge status={purchase.paymentStatus} /> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Link
                            href={`/purchases/${purchase.id}`}
                            className="rounded-full p-2 text-slate-600 hover:bg-black/5 hover:text-ink"
                            aria-label={`View ${purchase.invoiceNumber}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {!loading && items.length === 0 && (
              <EmptyState
                icon={ShoppingCart}
                title="No purchases found"
                description={
                  hasFilters ? 'Try a different search or clear the filters.' : 'Record your first purchase to add stock.'
                }
                action={
                  canCreate &&
                  !hasFilters && (
                    <Link href="/purchases/new">
                      <Button icon={Plus}>New purchase</Button>
                    </Link>
                  )
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

export default function PurchasesPage() {
  return (
    <RequirePermission permission="purchases:read">
      <PurchasesList />
    </RequirePermission>
  );
}