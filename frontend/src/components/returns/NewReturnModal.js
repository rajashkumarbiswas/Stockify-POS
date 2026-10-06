'use client';

import { useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PAYMENT_METHOD_OPTIONS, SALE_STATUS_META } from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import useDebounce from '@/hooks/useDebounce';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { TH_CLASS } from '@/components/ui/SortableTh';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Step 1: find the invoice. Step 2: choose how many of each item come back. The server works out the refund. */
export default function NewReturnModal({ onClose, onSaved }) {
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingSale, setLoadingSale] = useState(false);
  const [sale, setSale] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Shows the latest sales first; typing narrows them down by invoice number or customer
  useEffect(() => {
    if (sale) return undefined;

    let active = true;
    setSearching(true);
    api
      .get('/sales', { search: debounced.trim(), limit: 6, sortBy: 'createdAt', sortOrder: 'desc' })
      .then((res) => active && setResults(res.data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setSearching(false));

    return () => {
      active = false;
    };
  }, [debounced, sale]);

  const pickSale = async (item) => {
    setLoadingSale(true);
    setError('');
    try {
      const res = await api.get(`/sales/${item.id}`);
      setSale(res.data);
      setQuantities({});
      setRefundMethod(res.data.paymentMethod);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSale(false);
    }
  };

  const lines = sale
    ? sale.items.map((item) => {
        const available = item.quantity - (item.returnedQuantity || 0);
        const raw = quantities[item.product] ?? '';
        const qty = raw === '' ? 0 : Number(raw);
        const invalid = raw !== '' && (!Number.isInteger(qty) || qty < 0 || qty > available);
        return { item, available, raw, qty, invalid };
      })
    : [];

  const ratio = sale && sale.subtotal > 0 ? sale.grandTotal / sale.subtotal : 0;
  const estimate = round2(
    lines.reduce((sum, line) => (line.invalid ? sum : sum + line.qty * line.item.unitPrice * ratio), 0)
  );
  const selectedCount = lines.filter((line) => !line.invalid && line.qty > 0).length;
  const hasInvalid = lines.some((line) => line.invalid);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (hasInvalid) {
      setError('Fix the quantities marked in red.');
      return;
    }
    if (selectedCount === 0) {
      setError('Enter the quantity to return for at least one item.');
      return;
    }

    const payload = {
      saleId: sale.id,
      items: lines
        .filter((line) => line.qty > 0)
        .map((line) => ({ productId: line.item.product, quantity: line.qty })),
      refundMethod,
    };
    if (reason.trim()) payload.reason = reason.trim();

    setSaving(true);
    try {
      const res = await api.post('/returns', payload);
      toast.success(res.message);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      size="lg"
      title="New return"
      description={sale ? undefined : 'Find the invoice the products were sold on.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {sale && (
            <Button type="submit" form="return-form" icon={RotateCcw} loading={saving}>
              Process return
            </Button>
          )}
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {!sale ? (
        <div>
          <SearchInput value={term} onChange={setTerm} placeholder="Search by invoice number or customer..." />

          <div className="relative mt-3 space-y-2">
            {(searching || loadingSale) && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
            )}
            {results.length === 0 && !searching ? (
              <p className="py-8 text-center text-sm text-slate-500">No sales found.</p>
            ) : (
              results.map((item) => {
                const done = item.status === 'RETURNED';
                const meta = SALE_STATUS_META[item.status];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pickSale(item)}
                    disabled={done || loadingSale}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/5 px-4 py-3 text-left transition-colors hover:bg-[#faf9fe] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{item.invoiceNumber}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {formatDateTime(item.createdAt)} · {item.customer ? item.customer.name : 'Walk-in'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
                      <span className="text-sm font-semibold text-ink">{formatMoney(item.grandTotal)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <form id="return-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f4fc] px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{sale.invoiceNumber}</p>
              <p className="truncate text-xs text-slate-500">
                {formatDateTime(sale.createdAt)} · {sale.customer ? sale.customer.name : 'Walk-in customer'} · Total{' '}
                {formatMoney(sale.grandTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSale(null);
                setError('');
              }}
              disabled={saving}
              className="shrink-0 text-sm font-medium text-[#6b5fb0] hover:underline"
            >
              Change
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-black/5">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-[#f6f4fc]">
                <tr>
                  <th scope="col" className={TH_CLASS}>
                    Item
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Sold
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Returned
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    Available
                  </th>
                  <th scope="col" className={`${TH_CLASS} w-32`}>
                    Return qty
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ item, available, raw, invalid }) => (
                  <tr key={item.product} className="border-t border-black/5 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.sku} · {formatMoney(item.unitPrice)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(item.quantity)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatNumber(item.returnedQuantity || 0)}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{formatNumber(available)}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={available}
                        step="1"
                        inputMode="numeric"
                        disabled={available === 0 || saving}
                        value={raw}
                        placeholder="0"
                        onChange={(e) => setQuantities((prev) => ({ ...prev, [item.product]: e.target.value }))}
                        aria-label={`Return quantity of ${item.name}`}
                        aria-invalid={invalid}
                        className={`h-10 w-24 rounded-lg border px-3 text-sm font-semibold text-ink focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 ${
                          invalid ? 'border-red-500' : 'border-slate-300 focus:border-ink'
                        }`}
                      />
                      {invalid && <p className="mt-1 text-xs text-red-600">0 to {available} only</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Refund method"
              options={PAYMENT_METHOD_OPTIONS}
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
            />
            <div className="rounded-2xl bg-[#f6f4fc] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estimated refund</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink">{formatMoney(estimate)}</p>
              <p className="mt-0.5 text-xs text-slate-500">The server calculates the final amount.</p>
            </div>
          </div>

          <Textarea
            label="Reason (optional)"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Damaged, wrong size, changed mind..."
          />
        </form>
      )}
    </Modal>
  );
}