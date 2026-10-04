'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/constants';
import { formatMoney, formatNumber } from '@/lib/format';
import ProductPicker from '@/components/purchases/ProductPicker';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { Package } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: 'Received now (stock is added immediately)' },
  { value: 'PENDING', label: 'Pending order (stock is added when received)' },
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/**
 * Create-purchase form. Quantities, unit costs, discount and tax are inputs; every total shown here
 * is only a PREVIEW. The server recalculates subtotal, line totals and grand total and updates stock.
 */
export default function PurchaseForm({ initialSupplierId = '' }) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [optionsError, setOptionsError] = useState('');
  const [form, setForm] = useState({
    supplierId: initialSupplierId,
    purchaseDate: todayLocal(),
    status: 'RECEIVED',
    discount: '',
    tax: '',
    notes: '',
    payAmount: '',
    payMethod: 'CASH',
    payNote: '',
  });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [itemErrors, setItemErrors] = useState({});

  useEffect(() => {
    let active = true;
    api
      .get('/suppliers/options')
      .then((res) => active && setSuppliers(res.data))
      .catch((err) => active && setOptionsError(err.message));
    return () => {
      active = false;
    };
  }, []);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.company ? `${s.name} (${s.company})` : s.name })),
    [suppliers]
  );

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const addProduct = (product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: String(Number(item.quantity || 0) + 1) } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          currentStock: product.currentStock,
          quantity: '1',
          purchasePrice: String(product.purchasePrice ?? 0),
        },
      ];
    });
    setFieldErrors((prev) => ({ ...prev, items: undefined }));
  };

  const updateItem = (productId, key, value) =>
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, [key]: value } : item)));

  const removeItem = (productId) => setItems((prev) => prev.filter((item) => item.productId !== productId));

  const subtotal = round2(
    items.reduce((sum, item) => {
      const q = Number(item.quantity);
      const p = Number(item.purchasePrice);
      return Number.isFinite(q) && Number.isFinite(p) ? sum + q * p : sum;
    }, 0)
  );
  const discountNum = Number(form.discount) || 0;
  const taxNum = Number(form.tax) || 0;
  const grandTotal = round2(subtotal - discountNum + taxNum);
  const payNum = Number(form.payAmount) || 0;

  const validate = () => {
    const errors = {};
    const perItem = {};

    if (!form.supplierId) errors.supplierId = 'Choose a supplier';
    if (!form.purchaseDate) errors.purchaseDate = 'Choose the purchase date';
    if (items.length === 0) errors.items = 'Add at least one product';

    items.forEach((item) => {
      const e = {};
      const q = Number(item.quantity);
      const p = Number(item.purchasePrice);
      if (item.quantity === '' || !Number.isInteger(q) || q < 1) e.quantity = 'Whole number, 1 or more';
      if (item.purchasePrice === '' || !Number.isFinite(p) || p < 0) e.purchasePrice = 'Enter a valid price';
      if (Object.keys(e).length > 0) perItem[item.productId] = e;
    });

    if (form.discount !== '' && (!Number.isFinite(Number(form.discount)) || Number(form.discount) < 0)) {
      errors.discount = 'Enter a valid amount';
    } else if (discountNum > subtotal) {
      errors.discount = 'Discount cannot be greater than the subtotal';
    }
    if (form.tax !== '' && (!Number.isFinite(Number(form.tax)) || Number(form.tax) < 0)) {
      errors.tax = 'Enter a valid amount';
    }
    if (form.status === 'RECEIVED' && form.payAmount !== '') {
      if (!Number.isFinite(payNum) || payNum < 0) errors.payAmount = 'Enter a valid amount';
      else if (payNum > grandTotal) errors.payAmount = 'Payment cannot be more than the grand total';
    }

    return { errors, perItem };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const { errors, perItem } = validate();
    setFieldErrors(errors);
    setItemErrors(perItem);
    if (Object.keys(errors).length > 0 || Object.keys(perItem).length > 0) return;

    const payload = {
      supplierId: form.supplierId,
      status: form.status,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        purchasePrice: Number(item.purchasePrice),
      })),
      discount: discountNum,
      tax: taxNum,
      notes: form.notes.trim(),
    };
    // Today's purchases use the server clock; only a different date is sent
    if (form.purchaseDate !== todayLocal()) payload.purchaseDate = form.purchaseDate;
    if (form.status === 'RECEIVED' && payNum > 0) {
      payload.payment = { amount: payNum, method: form.payMethod, note: form.payNote.trim() };
    }

    setSaving(true);
    try {
      const res = await api.post('/purchases', payload);
      toast.success(res.message);
      router.push(`/purchases/${res.data.id}`);
    } catch (err) {
      setError(err.message);
      setFieldErrors(Object.fromEntries((err.errors || []).map((e) => [e.field, e.message])));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {(error || optionsError) && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error || optionsError}</span>
          </div>
        )}

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Purchase details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Supplier"
              placeholder="Select a supplier"
              options={supplierOptions}
              value={form.supplierId}
              onChange={update('supplierId')}
              error={fieldErrors.supplierId}
              hint={suppliers.length === 0 && !optionsError ? 'No active suppliers yet. Create one first.' : undefined}
            />
            <Field
              label="Purchase date"
              type="date"
              value={form.purchaseDate}
              max={todayLocal()}
              onChange={update('purchaseDate')}
              error={fieldErrors.purchaseDate}
            />
            <Select
              className="sm:col-span-2"
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={update('status')}
            />
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Products</h2>
          <ProductPicker onSelect={addProduct} />
          {fieldErrors.items && <p className="mt-2 text-sm text-red-600">{fieldErrors.items}</p>}

          {items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products added"
              description="Search above and pick the products you are buying."
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Product</th>
                    <th className="w-28 px-2 py-2">Quantity</th>
                    <th className="w-36 px-2 py-2">Unit cost</th>
                    <th className="w-32 px-2 py-2 text-right">Line total</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const errors = itemErrors[item.productId] || {};
                    const lineTotal = round2((Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0));
                    return (
                      <tr key={item.productId} className="border-t border-black/5 align-top">
                        <td className="px-2 py-3">
                          <p className="font-semibold text-ink">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.sku} · in stock {formatNumber(item.currentStock)} {item.unit}
                          </p>
                        </td>
                        <td className="px-2 py-3">
                          <Field
                            aria-label={`Quantity of ${item.name}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.productId, 'quantity', e.target.value)}
                            error={errors.quantity}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <Field
                            aria-label={`Unit cost of ${item.name}`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={item.purchasePrice}
                            onChange={(e) => updateItem(item.productId, 'purchasePrice', e.target.value)}
                            error={errors.purchasePrice}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-5 text-right font-semibold text-ink">
                          {formatMoney(lineTotal)}
                        </td>
                        <td className="px-2 py-4">
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <Textarea
            label="Notes (optional)"
            rows={3}
            value={form.notes}
            onChange={update('notes')}
            error={fieldErrors.notes}
            placeholder="Supplier invoice number, delivery details..."
          />
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card p-5 sm:p-6 lg:sticky lg:top-4">
          <h2 className="mb-4 text-lg font-semibold text-ink">Summary</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="font-medium text-ink">{formatMoney(subtotal)}</dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field
              label="Discount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.discount}
              onChange={update('discount')}
              error={fieldErrors.discount}
            />
            <Field
              label="Tax"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.tax}
              onChange={update('tax')}
              error={fieldErrors.tax}
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
            <span className="font-semibold text-ink">Grand total</span>
            <span className="text-2xl font-bold tracking-tight text-ink">{formatMoney(grandTotal)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Preview only. The server calculates the final totals.</p>

          {form.status === 'RECEIVED' && (
            <div className="mt-5 space-y-3 border-t border-black/10 pt-4">
              <h3 className="text-sm font-semibold text-ink">Payment now (optional)</h3>
              <Field
                label="Amount paid"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.payAmount}
                onChange={update('payAmount')}
                error={fieldErrors.payAmount || fieldErrors.payment}
                hint="Leave empty to pay later."
              />
              {payNum > 0 && (
                <>
                  <Select
                    label="Method"
                    options={PAYMENT_METHOD_OPTIONS}
                    value={form.payMethod}
                    onChange={update('payMethod')}
                  />
                  <Field label="Note (optional)" value={form.payNote} onChange={update('payNote')} />
                  <p className="text-xs text-slate-500">
                    Remaining after this payment:{' '}
                    <strong className="text-ink">{formatMoney(Math.max(0, grandTotal - payNum))}</strong>
                  </p>
                </>
              )}
            </div>
          )}

          <Button type="submit" size="lg" icon={Save} loading={saving} className="mt-6 w-full">
            {form.status === 'RECEIVED' ? 'Complete purchase' : 'Create purchase order'}
          </Button>
        </section>
      </aside>
    </form>
  );
}