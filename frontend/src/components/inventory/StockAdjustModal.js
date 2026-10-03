'use client';

import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import StockBadge from '@/components/catalog/StockBadge';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

const TYPE_OPTIONS = [
  { value: 'MANUAL_INCREASE', label: 'Add stock' },
  { value: 'MANUAL_DECREASE', label: 'Remove stock' },
  { value: 'ADJUSTMENT', label: 'Set counted quantity (stock take)' },
];

const QUANTITY_LABEL = {
  MANUAL_INCREASE: 'Quantity to add',
  MANUAL_DECREASE: 'Quantity to remove',
  ADJUSTMENT: 'Counted quantity',
};

const REASON_SUGGESTIONS = {
  MANUAL_INCREASE: ['Found stock', 'Supplier delivery', 'Customer return'],
  MANUAL_DECREASE: ['Damaged', 'Expired', 'Lost or stolen', 'Internal use'],
  ADJUSTMENT: ['Monthly stock take', 'Recount', 'Shelf audit'],
};

/**
 * "Adjust stock" dialog. The new stock shown here is only a PREVIEW:
 * the backend calculates and stores the real value and records the movement.
 */
export default function StockAdjustModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'MANUAL_INCREASE', quantity: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const quantity = form.quantity === '' ? null : Number(form.quantity);

  const preview = useMemo(() => {
    if (quantity === null || !Number.isFinite(quantity)) return null;
    if (form.type === 'MANUAL_INCREASE') return product.currentStock + quantity;
    if (form.type === 'MANUAL_DECREASE') return product.currentStock - quantity;
    return quantity;
  }, [form.type, quantity, product.currentStock]);

  const validate = () => {
    const errors = {};
    const minimum = form.type === 'ADJUSTMENT' ? 0 : 1;
    if (form.quantity === '' || !Number.isInteger(quantity) || quantity < minimum) {
      errors.quantity = `Enter a whole number (${minimum} or more)`;
    } else if (preview !== null && preview < 0) {
      errors.quantity = `Only ${formatNumber(product.currentStock)} ${product.unit} in stock`;
    }
    if (form.reason.trim().length < 3) errors.reason = 'Please give a short reason (at least 3 characters)';
    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await api.post('/inventory/adjust', {
        productId: product.id,
        type: form.type,
        quantity,
        reason: form.reason.trim(),
      });
      toast.success(res.message);
      onSaved();
    } catch (err) {
      setError(err.message);
      setFieldErrors(Object.fromEntries((err.errors || []).map((e) => [e.field, e.message])));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="Adjust stock"
      description={`${product.name} · ${product.sku}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-form" icon={Save} loading={saving}>
            Save adjustment
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-tile px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">Current stock</p>
          <p className="text-xl font-bold text-ink">
            {formatNumber(product.currentStock)} <span className="text-sm font-normal text-slate-500">{product.unit}</span>
          </p>
        </div>
        <StockBadge status={product.stockStatus} />
      </div>

      <form id="adjust-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Select
          label="What do you want to do?"
          options={TYPE_OPTIONS}
          value={form.type}
          onChange={update('type')}
          error={fieldErrors.type}
        />

        <Field
          label={QUANTITY_LABEL[form.type]}
          type="number"
          min={form.type === 'ADJUSTMENT' ? 0 : 1}
          step="1"
          inputMode="numeric"
          value={form.quantity}
          onChange={update('quantity')}
          error={fieldErrors.quantity}
          autoFocus
        />

        {preview !== null && preview >= 0 && (
          <p className="text-sm text-slate-600">
            Stock after this change:{' '}
            <strong className="text-ink">
              {formatNumber(preview)} {product.unit}
            </strong>{' '}
            <span className="text-xs text-slate-500">(final value is calculated by the server)</span>
          </p>
        )}

        <div>
          <Field
            label="Reason"
            value={form.reason}
            onChange={update('reason')}
            error={fieldErrors.reason}
            placeholder="Why is the stock changing?"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REASON_SUGGESTIONS[form.type].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, reason }))}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-ink hover:text-ink"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}