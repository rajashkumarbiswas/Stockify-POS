'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, SALE_STATUS_META } from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { printInvoice } from '@/lib/invoice';
import useBusinessSettings from '@/hooks/useBusinessSettings';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

function TotalRow({ label, value, strong, danger }) {
  return (
    <div
      className={`flex items-center justify-between py-1 text-sm ${
        strong ? 'mt-1 border-t border-black/10 pt-2 text-base font-bold text-ink' : 'text-slate-600'
      } ${danger ? 'font-semibold text-red-600' : ''}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  );
}

/** Invoice / receipt. Shows the business info from Settings and can be printed. */
export default function InvoiceModal({ sale, onClose, title, closeLabel = 'Close' }) {
  const settings = useBusinessSettings();
  const [detail, setDetail] = useState(null);

  // The list only carries a short customer record; fetch the full sale for the invoice
  useEffect(() => {
    let active = true;
    api
      .get(`/sales/${sale.id}`)
      .then((res) => active && setDetail(res.data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sale.id]);

  const data = detail || sale;
  const status = SALE_STATUS_META[data.status];
  const discountLabel = data.discount?.type === 'PERCENT' ? `Discount (${data.discount.value}%)` : 'Discount';

  const handlePrint = () => {
    if (!printInvoice(data, settings)) toast.error('Allow pop-ups for this site to print the invoice.');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title || `Invoice ${data.invoiceNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {closeLabel}
          </Button>
          <Button icon={Printer} onClick={handlePrint}>
            Print invoice
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-lg font-bold text-ink">{settings?.businessName || 'Invoice'}</p>
          {settings?.address && <p className="text-xs text-slate-600">{settings.address}</p>}
          {(settings?.phone || settings?.email) && (
            <p className="text-xs text-slate-600">{[settings.phone, settings.email].filter(Boolean).join(' · ')}</p>
          )}
          {settings?.taxId && <p className="text-xs text-slate-600">Tax ID: {settings.taxId}</p>}
        </div>

        <div className="rounded-2xl bg-[#f6f4fc] px-4 py-3">
          <MetaRow label="Invoice">{data.invoiceNumber}</MetaRow>
          <MetaRow label="Date">{formatDateTime(data.createdAt)}</MetaRow>
          <MetaRow label="Customer">
            {data.customer ? (
              <>
                {data.customer.name}
                {data.customer.phone && <span className="block text-xs font-normal text-slate-500">{data.customer.phone}</span>}
              </>
            ) : (
              'Walk-in customer'
            )}
          </MetaRow>
          <MetaRow label="Cashier">{data.cashier?.name || '—'}</MetaRow>
          <MetaRow label="Payment">{PAYMENT_METHOD_LABELS[data.paymentMethod] || data.paymentMethod}</MetaRow>
          {status && (
            <MetaRow label="Status">
              <Badge tone={status.tone}>{status.label}</Badge>
            </MetaRow>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/5">
          <table className="w-full min-w-[360px] text-sm">
            <thead className="bg-[#f6f4fc] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={`${item.product}-${item.sku}`} className="border-t border-black/5">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{formatNumber(item.quantity)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatMoney(item.unitPrice)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <TotalRow label="Subtotal" value={formatMoney(data.subtotal)} />
          {data.discount?.amount > 0 && <TotalRow label={discountLabel} value={`− ${formatMoney(data.discount.amount)}`} />}
          {data.taxAmount > 0 && <TotalRow label={`Tax (${data.taxRate}%)`} value={formatMoney(data.taxAmount)} />}
          <TotalRow label="Grand total" value={formatMoney(data.grandTotal)} strong />
          <TotalRow label="Paid" value={formatMoney(data.amountPaid)} />
          {data.dueAmount > 0 && <TotalRow label="Due" value={formatMoney(data.dueAmount)} danger />}
          {data.totalRefunded > 0 && <TotalRow label="Refunded" value={formatMoney(data.totalRefunded)} />}
        </div>

        {data.notes && (
          <p className="rounded-2xl bg-[#f6f4fc] px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-ink">Notes: </span>
            {data.notes}
          </p>
        )}

        <p className="text-center text-xs text-slate-500">{settings?.invoiceFooter || 'Thank you for your purchase!'}</p>
      </div>
    </Modal>
  );
}