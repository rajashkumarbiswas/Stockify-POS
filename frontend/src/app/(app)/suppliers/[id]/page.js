'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, ReceiptText, ShoppingCart, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import usePaginatedList from '@/hooks/usePaginatedList';
import RequirePermission from '@/components/auth/RequirePermission';
import { PaymentStatusBadge, PurchaseStatusBadge } from '@/components/purchases/StatusBadges';
import SupplierFormModal from '@/components/suppliers/SupplierFormModal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import SortableTh, { TH_CLASS } from '@/components/ui/SortableTh';
import StatCard from '@/components/ui/StatCard';
import TableSkeleton from '@/components/ui/TableSkeleton';

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-black/5 py-3 first:border-t-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function PurchaseHistory({ supplierId }) {
  const list = usePaginatedList(`/suppliers/${supplierId}/purchases`, {
    initialParams: { sortBy: 'purchaseDate', sortOrder: 'desc', limit: 5 },
  });
  const { items, pagination, loading, error, params } = list;
  const sortProps = { sortBy: params.sortBy, sortOrder: params.sortOrder, onSort: list.setSort };

  return (
    <section className="card overflow-hidden">
      <h2 className="px-5 pb-2 pt-5 text-lg font-semibold text-ink">Purchase history</h2>
      {error ? (
        <ErrorState message={error} onRetry={list.reload} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <SortableTh label="Invoice" field="invoiceNumber" {...sortProps} />
                <SortableTh label="Date" field="purchaseDate" {...sortProps} />
                <SortableTh label="Total" field="grandTotal" {...sortProps} />
                <th scope="col" className={TH_CLASS}>
                  Due
                </th>
                <th scope="col" className={TH_CLASS}>
                  Status
                </th>
                <th scope="col" className={TH_CLASS}>
                  Payment
                </th>
              </tr>
            </thead>
            {loading && items.length === 0 ? (
              <TableSkeleton rows={4} cols={6} />
            ) : (
              <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                {items.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-black/5 hover:bg-white/60">
                    <td className="px-4 py-3">
                      <Link href={`/purchases/${purchase.id}`} className="font-semibold text-ink hover:underline">
                        {purchase.invoiceNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(purchase.purchaseDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{formatMoney(purchase.grandTotal)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {purchase.status === 'RECEIVED' ? formatMoney(purchase.dueAmount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <PurchaseStatusBadge status={purchase.status} />
                    </td>
                    <td className="px-4 py-3">
                      {purchase.status === 'RECEIVED' ? <PaymentStatusBadge status={purchase.paymentStatus} /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && items.length === 0 && (
            <EmptyState icon={ShoppingCart} title="No purchases yet" description="Purchases from this supplier will appear here." />
          )}
        </div>
      )}
      <div className="px-5 pb-4">
        <Pagination pagination={pagination} onPageChange={list.setPage} />
      </div>
    </section>
  );
}

function PaymentHistory({ supplierId }) {
  const list = usePaginatedList(`/suppliers/${supplierId}/payments`, { initialParams: { limit: 5 } });
  const { items, pagination, loading, error } = list;

  return (
    <section className="card overflow-hidden">
      <h2 className="px-5 pb-2 pt-5 text-lg font-semibold text-ink">Payment history</h2>
      {error ? (
        <ErrorState message={error} onRetry={list.reload} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                {['Date', 'Invoice', 'Amount', 'Method', 'Recorded by', 'Note'].map((label) => (
                  <th key={label} scope="col" className={TH_CLASS}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            {loading && items.length === 0 ? (
              <TableSkeleton rows={3} cols={6} />
            ) : (
              <tbody className={loading ? 'opacity-60 transition-opacity' : ''}>
                {items.map((payment, index) => (
                  <tr key={`${payment.purchaseId}-${index}`} className="border-t border-black/5 hover:bg-white/60">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(payment.date)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/purchases/${payment.purchaseId}`} className="font-semibold text-ink hover:underline">
                        {payment.invoiceNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-700">
                      {formatMoney(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</td>
                    <td className="px-4 py-3 text-slate-700">{payment.recordedBy || '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">{payment.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && items.length === 0 && (
            <EmptyState icon={Wallet} title="No payments yet" description="Payments made to this supplier will appear here." />
          )}
        </div>
      )}
      <div className="px-5 pb-4">
        <Pagination pagination={pagination} onPageChange={list.setPage} />
      </div>
    </section>
  );
}

function SupplierDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/suppliers/${id}`);
      setSupplier(res.data);
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
    <Link href="/suppliers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to suppliers
    </Link>
  );

  if (loading && !supplier) {
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
        title={supplier.name}
        description={supplier.company || undefined}
        actions={
          <>
            <Badge tone={supplier.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {supplier.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </Badge>
            {can('suppliers:update') && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can('purchases:create') && supplier.status === 'ACTIVE' && (
              <Link href={`/purchases/new?supplier=${supplier.id}`}>
                <Button icon={Plus}>New purchase</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total purchased" value={formatMoney(supplier.totalPurchases)} icon={ShoppingCart} />
        <StatCard
          title="Amount due"
          value={formatMoney(supplier.dueAmount)}
          icon={Wallet}
          hint={supplier.dueAmount > 0 ? 'Still to be paid to this supplier' : 'Nothing owed'}
        />
        <StatCard title="Purchases" value={String(supplier.stats.purchaseCount)} icon={ReceiptText} />
        <StatCard
          title="Pending orders"
          value={String(supplier.stats.pendingCount)}
          icon={ShoppingCart}
          hint={supplier.stats.lastPurchaseAt ? `Last purchase ${formatDate(supplier.stats.lastPurchaseAt)}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card h-fit p-5">
          <h2 className="mb-2 text-lg font-semibold text-ink">Details</h2>
          <dl>
            <InfoRow label="Phone">{supplier.phone || '—'}</InfoRow>
            <InfoRow label="Email">{supplier.email || '—'}</InfoRow>
            <InfoRow label="Address">{supplier.address || '—'}</InfoRow>
            <InfoRow label="Added">{formatDateTime(supplier.createdAt)}</InfoRow>
          </dl>
        </section>

        <div className="space-y-4 lg:col-span-2">
          <PurchaseHistory supplierId={supplier.id} />
          <PaymentHistory supplierId={supplier.id} />
        </div>
      </div>

      {editing && (
        <SupplierFormModal
          supplier={supplier}
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

export default function SupplierDetailPage() {
  return (
    <RequirePermission permission="suppliers:read">
      <SupplierDetails />
    </RequirePermission>
  );
}