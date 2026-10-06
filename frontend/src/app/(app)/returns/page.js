'use client';

import { useState } from 'react';
import { Eye, Plus, Undo2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DATE_RANGE_OPTIONS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import NewReturnModal from '@/components/returns/NewReturnModal';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import TableSkeleton from '@/components/ui/TableSkeleton';

const DARK_BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-full bg-[#1c1c20] px-5 text-sm font-medium text-white transition-colors hover:bg-black';
const ICON_BUTTON = 'rounded-full p-2 text-slate-500 transition-colors hover:bg-[#ece9f8] hover:text-[#6b5fb0]';

// "Custom range" needs two date inputs, so it is left out of this first version
const RANGE_OPTIONS = DATE_RANGE_OPTIONS.filter((option) => option.value !== 'custom');

const countUnits = (item) => item.items.reduce((sum, line) => sum + line.quantity, 0);

function ReturnDetailModal({ item, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Return ${item.returnNumber}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-[#f6f4fc] px-4 py-3 text-sm">
          {[
            ['Invoice', item.invoiceNumber],
            ['Date', formatDateTime(item.createdAt)],
            ['Customer', item.customer ? item.customer.name : 'Walk-in customer'],
            ['Processed by', item.processedBy?.name || '—'],
            ['Refund method', PAYMENT_METHOD_LABELS[item.refundMethod] || item.refundMethod],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-0.5">
              <span className="text-slate-500">{label}</span>
              <span className="text-right font-medium text-ink">{value}</span>
            </div>
          ))}
        </div>

        <ul className="divide-y divide-black/5 text-sm">
          {item.items.map((line) => (
            <li key={`${line.product}-${line.sku}`} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{line.name}</span>
                <span className="block text-xs text-slate-500">
                  {line.sku} · {formatNumber(line.quantity)} × {formatMoney(line.unitRefund)}
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold text-ink">{formatMoney(line.lineRefund)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-black/10 pt-3 text-base font-bold text-ink">
          <span>Refund total</span>
          <span>{formatMoney(item.refundAmount)}</span>
        </div>

        {item.reason && (
          <p className="rounded-2xl bg-[#f6f4fc] px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-ink">Reason: </span>
            {item.reason}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ReturnsList() {
  const { can } = useAuth();
  const list = usePaginatedList('/returns', { initialParams: { sortBy: 'createdAt', sortOrder: 'desc' } });
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);

  const { items, pagination, loading, error, params } = list;
  const canCreate = can('returns:create');
  const total = pagination?.totalItems;
  const hasFilters = Boolean(params.search || params.range);
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Returns</h1>
          <p className="mt-1 text-sm text-slate-500">
            Products brought back by customers, with the money refunded.
            {total !== undefined && total !== null && (
              <span className="ml-2 rounded-full bg-[#ece9f8] px-2.5 py-0.5 text-xs font-medium text-[#6b5fb0]">
                {formatNumber(total)} total
              </span>
            )}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setCreating(true)} className={DARK_BUTTON}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New return
          </button>
        )}
      </header>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            value={list.searchInput}
            onChange={list.setSearchInput}
            placeholder="Search return or invoice number..."
            className="sm:w-80"
          />
          <Select
            aria-label="Filter by date"
            placeholder="Any date"
            options={RANGE_OPTIONS}
            value={params.range || ''}
            onChange={(e) => list.setFilter('range', e.target.value)}
            className="sm:w-44"
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
                  <SortableTh label="Return" field="returnNumber" {...sortProps} />
                  <SortableTh label="Date" field="createdAt" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Invoice
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Customer
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Items
                  </th>
                  <SortableTh label="Refund" field="refundAmount" {...sortProps} />
                  <th scope="col" className={TH_CLASS}>
                    Method
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Processed by
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>

              {loading && items.length === 0 ? (
                <TableSkeleton rows={8} cols={9} />
              ) : (
                <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-black/5 transition-colors hover:bg-[#faf9fe]">
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-ink">{item.returnNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{formatDateTime(item.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">{item.invoiceNumber}</td>
                      <td className="px-4 py-3.5">
                        {item.customer ? (
                          <span className="block max-w-[180px] truncate text-slate-700">{item.customer.name}</span>
                        ) : (
                          <span className="text-slate-400">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{formatNumber(countUnits(item))}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-ink">
                        {formatMoney(item.refundAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                        {PAYMENT_METHOD_LABELS[item.refundMethod] || item.refundMethod}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{item.processedBy?.name || '—'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setViewing(item)}
                            className={ICON_BUTTON}
                            aria-label={`View return ${item.returnNumber}`}
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
                icon={Undo2}
                title="No returns found"
                description={hasFilters ? 'Try a different search or clear the filters.' : 'Processed returns will appear here.'}
                action={
                  canCreate &&
                  !hasFilters && (
                    <button type="button" onClick={() => setCreating(true)} className={DARK_BUTTON}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New return
                    </button>
                  )
                }
              />
            )}
          </div>
        )}
      </div>

      <Pagination pagination={pagination} onPageChange={list.setPage} />

      {creating && (
        <NewReturnModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}

      {viewing && <ReturnDetailModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <RequirePermission permission="returns:read">
      <ReturnsList />
    </RequirePermission>
  );
}