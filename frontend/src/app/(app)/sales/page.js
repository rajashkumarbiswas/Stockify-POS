'use client';

import { useState } from 'react';
import { Eye, Receipt } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  DATE_RANGE_OPTIONS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  SALE_STATUS_META,
  SALE_STATUS_OPTIONS,
} from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';
import InvoiceModal from '@/components/sales/InvoiceModal';

const ICON_BUTTON = 'rounded-full p-2 text-slate-500 transition-colors hover:bg-[#ece9f8] hover:text-[#6b5fb0]';

// "Custom range" needs two date inputs, so it is left out of this first version
const RANGE_OPTIONS = DATE_RANGE_OPTIONS.filter((option) => option.value !== 'custom');

function StatusBadge({ status }) {
  const meta = SALE_STATUS_META[status] || { label: status, tone: 'neutral' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const countUnits = (sale) => sale.items.reduce((sum, item) => sum + item.quantity, 0);

function InfoRow({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-ink">{children}</div>
    </div>
  );
}

function TotalRow({ label, value, strong, danger }) {
  return (
    <div
      className={`flex items-center justify-between py-1 text-sm ${
        strong ? 'border-t border-black/10 pt-2 text-base font-semibold text-ink' : 'text-slate-600'
      } ${danger ? 'font-semibold text-red-600' : ''}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SaleDetailModal({ sale, onClose, canSeeCost }) {
  const discountLabel =
    sale.discount?.type === 'PERCENT' ? `Discount (${sale.discount.value}%)` : 'Discount';

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sale ${sale.invoiceNumber}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Date">{formatDateTime(sale.createdAt)}</InfoRow>
          <InfoRow label="Status">
            <StatusBadge status={sale.status} />
          </InfoRow>
          <InfoRow label="Customer">
            {sale.customer ? (
              <>
                {sale.customer.name}
                {sale.customer.phone && <span className="block text-xs font-normal text-slate-500">{sale.customer.phone}</span>}
              </>
            ) : (
              <span className="font-normal text-slate-500">Walk-in customer</span>
            )}
          </InfoRow>
          <InfoRow label="Cashier">{sale.cashier?.name || '—'}</InfoRow>
          <InfoRow label="Payment">{PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}</InfoRow>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/5">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-[#f6f4fc]">
              <tr>
                <th scope="col" className={TH_CLASS}>
                  Item
                </th>
                <th scope="col" className={TH_CLASS}>
                  Qty
                </th>
                <th scope="col" className={TH_CLASS}>
                  Price
                </th>
                {canSeeCost && (
                  <th scope="col" className={TH_CLASS}>
                    Cost
                  </th>
                )}
                <th scope="col" className={`${TH_CLASS} text-right`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={`${item.product}-${item.sku}`} className="border-t border-black/5">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{formatNumber(item.quantity)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{formatMoney(item.unitPrice)}</td>
                  {canSeeCost && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                      {item.costPrice !== undefined ? formatMoney(item.costPrice) : '—'}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink">
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <TotalRow label="Subtotal" value={formatMoney(sale.subtotal)} />
          {sale.discount?.amount > 0 && (
            <TotalRow label={discountLabel} value={`− ${formatMoney(sale.discount.amount)}`} />
          )}
          {sale.taxAmount > 0 && <TotalRow label={`Tax (${sale.taxRate}%)`} value={formatMoney(sale.taxAmount)} />}
          <TotalRow label="Grand total" value={formatMoney(sale.grandTotal)} strong />
          <TotalRow label="Paid" value={formatMoney(sale.amountPaid)} />
          {sale.dueAmount > 0 && <TotalRow label="Due" value={formatMoney(sale.dueAmount)} danger />}
        </div>

        {sale.notes && (
          <div className="rounded-2xl bg-[#f6f4fc] px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-ink">Notes: </span>
            {sale.notes}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SalesList() {
  const { can } = useAuth();
  const list = usePaginatedList('/sales', { initialParams: { sortBy: 'createdAt', sortOrder: 'desc' } });
  const [viewing, setViewing] = useState(null);

  const { items, pagination, loading, error, params } = list;
  const canReadAll = can('sales:read_all');
  const canSeeCost = can('products:view_cost');
  const columnCount = 8 + (canReadAll ? 1 : 0);
  const total = pagination?.totalItems;
  const hasFilters = Boolean(params.search || params.paymentMethod || params.status || params.range);
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Sales</h1>
        <p className="mt-1 text-sm text-slate-500">
          {canReadAll ? 'Every sale made at the counter.' : 'The sales you have made.'}
          {total !== undefined && total !== null && (
            <span className="ml-2 rounded-full bg-[#ece9f8] px-2.5 py-0.5 text-xs font-medium text-[#6b5fb0]">
              {formatNumber(total)} total
            </span>
          )}
        </p>
      </header>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
          <SearchInput
            value={list.searchInput}
            onChange={list.setSearchInput}
            placeholder="Search invoice or customer..."
            className="lg:w-80"
          />
          <Select
            aria-label="Filter by date"
            placeholder="Any date"
            options={RANGE_OPTIONS}
            value={params.range || ''}
            onChange={(e) => list.setFilter('range', e.target.value)}
            className="lg:w-44"
          />
          <Select
            aria-label="Filter by payment method"
            placeholder="All payment methods"
            options={PAYMENT_METHOD_OPTIONS}
            value={params.paymentMethod || ''}
            onChange={(e) => list.setFilter('paymentMethod', e.target.value)}
            className="lg:w-52"
          />
          <Select
            aria-label="Filter by status"
            placeholder="All statuses"
            options={SALE_STATUS_OPTIONS}
            value={params.status || ''}
            onChange={(e) => list.setFilter('status', e.target.value)}
            className="lg:w-48"
          />
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
                  <SortableTh label="Invoice" field="invoiceNumber" {...sortProps} />
                  <SortableTh label="Date" field="createdAt" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Customer
                  </th>
                  {canReadAll && (
                    <th scope="col" className={TH_CLASS}>
                      Cashier
                    </th>
                  )}
                  <th scope="col" className={TH_CLASS}>
                    Items
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Payment
                  </th>
                  <SortableTh label="Total" field="grandTotal" {...sortProps} />
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
                  {items.map((sale) => (
                    <tr key={sale.id} className="border-t border-black/5 transition-colors hover:bg-[#faf9fe]">
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-ink">{sale.invoiceNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        {sale.customer ? (
                          <>
                            <p className="max-w-[180px] truncate text-slate-700">{sale.customer.name}</p>
                            {sale.customer.phone && <p className="text-xs text-slate-500">{sale.customer.phone}</p>}
                          </>
                        ) : (
                          <span className="text-slate-400">Walk-in</span>
                        )}
                      </td>
                      {canReadAll && <td className="px-4 py-3.5 text-slate-700">{sale.cashier?.name || '—'}</td>}
                      <td className="px-4 py-3.5 text-slate-700">{formatNumber(countUnits(sale))}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                        {PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-ink">
                        {formatMoney(sale.grandTotal)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={sale.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setViewing(sale)}
                            className={ICON_BUTTON}
                            aria-label={`View sale ${sale.invoiceNumber}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {!loading && items.length === 0 && (
              <EmptyState
                icon={Receipt}
                title="No sales found"
                description={
                  hasFilters ? 'Try a different search or clear the filters.' : 'Sales made in the POS will appear here.'
                }
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />

            {viewing && <InvoiceModal sale={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export default function SalesPage() {
  // Everyone who can read sales (including managers and admins) also has "sales:read_own"
  return (
    <RequirePermission permission="sales:read_own">
      <SalesList />
    </RequirePermission>
  );
}