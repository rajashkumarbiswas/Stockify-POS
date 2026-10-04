'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Banknote, Check, Wallet, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import RequirePermission from '@/components/auth/RequirePermission';
import PaymentModal from '@/components/purchases/PaymentModal';
import { PaymentStatusBadge, PurchaseStatusBadge } from '@/components/purchases/StatusBadges';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import { TH_CLASS } from '@/components/ui/SortableTh';

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-black/5 py-3 first:border-t-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function PurchaseDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const [purchase, setPurchase] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // 'receive' | 'cancel' | 'payment'
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await api.get(`/purchases/${id}`);
        setPurchase(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (action) => {
    setBusy(true);
    setActionError('');
    try {
      const res = await api.patch(`/purchases/${id}/${action}`);
      toast.success(res.message);
      setDialog(null);
      await load(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openDialog = (name) => {
    setActionError('');
    setDialog(name);
  };

  const back = (
    <Link href="/purchases" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to purchases
    </Link>
  );

  if (loading && !purchase) {
    return (
      <div>
        {back}
        <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
          <div className="card h-96 animate-pulse lg:col-span-2" />
          <div className="card h-96 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {back}
        <div className="card">
          <ErrorState message={error} onRetry={() => load()} />
        </div>
      </div>
    );
  }

  const canUpdate = can('purchases:update');
  const isPending = purchase.status === 'PENDING';
  const isReceived = purchase.status === 'RECEIVED';

  return (
    <div>
      {back}
      <PageHeader
        title={purchase.invoiceNumber}
        description={`${purchase.supplier?.name || ''}${purchase.supplier?.company ? ` · ${purchase.supplier.company}` : ''}`}
        actions={
          <>
            <PurchaseStatusBadge status={purchase.status} />
            {isReceived && <PaymentStatusBadge status={purchase.paymentStatus} />}
            {canUpdate && isPending && (
              <>
                <Button variant="secondary" icon={X} onClick={() => openDialog('cancel')}>
                  Cancel order
                </Button>
                <Button icon={Check} onClick={() => openDialog('receive')}>
                  Mark as received
                </Button>
              </>
            )}
            {canUpdate && isReceived && purchase.dueAmount > 0 && (
              <Button icon={Banknote} onClick={() => openDialog('payment')}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card overflow-hidden">
            <h2 className="px-5 pb-2 pt-5 text-lg font-semibold text-ink">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={TH_CLASS}>
                      Product
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Quantity
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Unit cost
                    </th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>
                      Line total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items.map((item, index) => (
                    <tr key={`${item.product}-${index}`} className="border-t border-black/5">
                      <td className="px-4 py-3">
                        <Link href={`/products/${item.product}`} className="font-semibold text-ink hover:underline">
                          {item.name}
                        </Link>
                        <p className="text-xs text-slate-500">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatNumber(item.quantity)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatMoney(item.purchasePrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">
                        {formatMoney(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto max-w-xs space-y-2 px-5 py-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="font-medium text-ink">{formatMoney(purchase.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Discount</dt>
                <dd className="font-medium text-ink">− {formatMoney(purchase.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Tax</dt>
                <dd className="font-medium text-ink">{formatMoney(purchase.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-black/10 pt-3 text-base">
                <dt className="font-semibold text-ink">Grand total</dt>
                <dd className="font-bold text-ink">{formatMoney(purchase.grandTotal)}</dd>
              </div>
            </dl>
          </section>

          <section className="card overflow-hidden">
            <h2 className="px-5 pb-2 pt-5 text-lg font-semibold text-ink">Payments</h2>
            {purchase.payments.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-slate-600">
                {isReceived ? 'No payments recorded yet.' : 'Payments can be recorded after the purchase is received.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr>
                      {['Date', 'Amount', 'Method', 'Recorded by', 'Note'].map((label) => (
                        <th key={label} scope="col" className={TH_CLASS}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.payments.map((payment, index) => (
                      <tr key={index} className="border-t border-black/5">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(payment.date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-700">
                          {formatMoney(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{payment.recordedBy?.name || '—'}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">{payment.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-ink">Balance</h2>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Total</dt>
                <dd className="font-medium text-ink">{formatMoney(purchase.grandTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Paid</dt>
                <dd className="font-medium text-emerald-700">{formatMoney(purchase.paidAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-black/10 pt-2">
                <dt className="font-semibold text-ink">Due</dt>
                <dd className={`font-bold ${isReceived && purchase.dueAmount > 0 ? 'text-red-600' : 'text-ink'}`}>
                  {isReceived ? formatMoney(purchase.dueAmount) : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-2 text-lg font-semibold text-ink">Details</h2>
            <dl>
              <InfoRow label="Supplier">
                {purchase.supplier ? (
                  <Link href={`/suppliers/${purchase.supplier.id}`} className="hover:underline">
                    {purchase.supplier.name}
                  </Link>
                ) : (
                  '—'
                )}
              </InfoRow>
              <InfoRow label="Purchase date">{formatDate(purchase.purchaseDate)}</InfoRow>
              <InfoRow label="Received">{purchase.receivedAt ? formatDateTime(purchase.receivedAt) : '—'}</InfoRow>
              <InfoRow label="Created by">{purchase.createdBy?.name || '—'}</InfoRow>
              <InfoRow label="Created">{formatDateTime(purchase.createdAt)}</InfoRow>
            </dl>
            {purchase.notes && <p className="mt-3 border-t border-black/5 pt-3 text-sm text-slate-700">{purchase.notes}</p>}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'receive'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('receive')}
        title="Mark as received?"
        message="The stock of every item in this purchase will increase and the supplier balance will be updated. This cannot be undone."
        confirmLabel="Receive purchase"
        tone="primary"
        loading={busy}
        error={dialog === 'receive' ? actionError : ''}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('cancel')}
        title="Cancel this order?"
        message="This purchase order will be cancelled. No stock is changed. A cancelled order cannot be received later."
        confirmLabel="Cancel order"
        loading={busy}
        error={dialog === 'cancel' ? actionError : ''}
      />
      {dialog === 'payment' && (
        <PaymentModal
          purchase={purchase}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}

export default function PurchaseDetailPage() {
  return (
    <RequirePermission permission="purchases:read">
      <PurchaseDetails />
    </RequirePermission>
  );
}