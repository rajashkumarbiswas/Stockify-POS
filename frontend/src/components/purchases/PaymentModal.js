'use client';

import { useState } from 'react';
import { Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';

/** Record a payment to the supplier for one purchase. The server checks it against the real balance. */
export default function PaymentModal({ purchase, onClose, onSaved }) {
  const due = purchase.dueAmount;
  const [form, setForm] = useState({ amount: String(due), method: 'CASH', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const amount = Number(form.amount);
    if (form.amount === '' || !Number.isFinite(amount) || amount <= 0) {
      setFieldErrors({ amount: 'Enter an amount greater than zero' });
      return;
    }
    if (amount > due) {
      setFieldErrors({ amount: `Cannot be more than the amount due (${formatMoney(due)})` });
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const res = await api.post(`/purchases/${purchase.id}/payments`, {
        amount,
        method: form.method,
        note: form.note.trim(),
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
      title="Record payment"
      description={`${purchase.invoiceNumber} · ${purchase.supplier?.name || ''}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" icon={Banknote} loading={saving}>
            Save payment
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-tile px-4 py-3">
        <span className="text-sm text-slate-600">Amount due</span>
        <span className="text-xl font-bold text-ink">{formatMoney(due)}</span>
      </div>

      <form id="payment-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.amount}
          onChange={update('amount')}
          error={fieldErrors.amount}
          autoFocus
        />
        <Select label="Method" options={PAYMENT_METHOD_OPTIONS} value={form.method} onChange={update('method')} />
        <Field label="Note (optional)" value={form.note} onChange={update('note')} error={fieldErrors.note} />
      </form>
    </Modal>
  );
}