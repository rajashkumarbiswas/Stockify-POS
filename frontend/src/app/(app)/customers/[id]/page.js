'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, Eye, Pencil, Receipt, ShoppingBag, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, SALE_STATUS_META } from '@/lib/constants';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import CustomerFormModal from '@/components/customers/CustomerFormModal';
import InvoiceModal from '@/components/sales/InvoiceModal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import StatCard from '@/components/ui/StatCard';
import TableSkeleton from '@/components/ui/TableSkeleton';

const ICON_BUTTON = 'rounded-full p-2 text-slate-500 transition-colors hover:bg-[#ece9f8] hover:text-[#6b5fb0]';

const countUnits = (sale) => sale.items.reduce((sum, item) => sum + item.quantity, 0);

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-black/5 py-3 first:border-t-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Every invoice of this customer. The backend limits sales staff to the sales they made themselves. */
function PurchaseHistory({ customerId }) {
  const list = usePaginatedList('/sales', {
    initialParams: { customer: customerId, sortBy: 'createdAt', sortOrder: 'desc', limit: 5 },
  });
  const [viewing, setViewing] = useState(null);
  const { items, pagination, loading, error, params } = list;
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <section className="card overflow-hidden">
      <h2 className="px-5 pb-2 pt-5 text-lg font-semibold text-ink">Purchase history and invoices</h2>
      {error ? (
        <ErrorState message={error} onRetry={list.reload} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <SortableTh label="Invoice" field="invoiceNumber" {...sortProps} />
                <SortableTh label="Date" field="createdAt" {...sortProps} />
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
                  Invoice
                </th>
              </tr>
            </thead>
            {loading && items.length === 0 ? (
              <TableSkeleton rows={4} cols={7} />
            ) : (
              <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                {items.map((sale) => {
                  const status = SALE_STATUS_META[sale.status];
                  return (
                    <tr key={sale.id} className="border-t border-black/5 hover:bg-white/60">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setViewing(sale)}
                          className="font-semibold text-ink hover:underline"
                        >
                          {sale.invoiceNumber}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNumber(countUnits(sale))}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{formatMoney(sale.grandTotal)}</td>
                      <td className="px-4 py-3">
                        {status ? <Badge tone={status.tone}>{status.label}</Badge> : sale.status}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setViewing(sale)}
                            className={ICON_BUTTON}
                            aria-label={`View invoice ${sale.invoiceNumber}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
          {!loading && items.length === 0 && (
            <EmptyState
              icon={Receipt}
              title="No purchases yet"
              description="Sales made to this customer will appear here."
            />
          )}
        </div>
      )}
      <div className="px-5 pb-4">
        <Pagination pagination={pagination} onPageChange={list.setPage} />
      </div>

      {viewing && <InvoiceModal sale={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

function CustomerDetails() {
  const { id } = useParams();
  const { can, canAny } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const canSeeSales = canAny('sales:read_all', 'sales:read_own');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const back = (
    <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to customers
    </Link>
  );

  if (loading && !customer) {
    return (
      <div>
        {back}
        <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-36 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {back}
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {back}
      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.email].filter(Boolean).join(' · ') || undefined}
        actions={
          can('customers:update') && (
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total spent" value={formatMoney(customer.totalSpent)} icon={Wallet} hint="After refunds" />
        <StatCard title="Purchases" value={formatNumber(customer.totalPurchases)} icon={ShoppingBag} />
        <StatCard
          title="Amount due"
          value={formatMoney(customer.dueAmount)}
          icon={Receipt}
          hint={customer.dueAmount > 0 ? 'Still to be paid by this customer' : 'Nothing owed'}
        />
        <StatCard
          title="Last purchase"
          value={customer.stats.lastSaleAt ? formatDate(customer.stats.lastSaleAt) : '—'}
          icon={Clock}
          hint={`${formatNumber(customer.stats.saleCount)} invoice(s)`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card h-fit p-5">
          <h2 className="mb-2 text-lg font-semibold text-ink">Details</h2>
          <dl>
            <InfoRow label="Phone">{customer.phone || '—'}</InfoRow>
            <InfoRow label="Email">{customer.email || '—'}</InfoRow>
            <InfoRow label="Address">{customer.address || '—'}</InfoRow>
            <InfoRow label="Added">{formatDateTime(customer.createdAt)}</InfoRow>
          </dl>
        </section>

        <div className="lg:col-span-2">{canSeeSales && <PurchaseHistory key={customer.id} customerId={customer.id} />}</div>
      </div>

      {editing && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <RequirePermission permission="customers:read">
      <CustomerDetails />
    </RequirePermission>
  );
}