'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { RECORD_STATUS_OPTIONS } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';

const FIELDS = ['name', 'company', 'phone', 'email', 'address'];

/**
 * Create / edit a supplier in a popup.
 * supplier = {} means "new"; a supplier object means "edit".
 * Totals (totalPurchases, dueAmount) are NOT editable: the server calculates them.
 */
export default function SupplierFormModal({ supplier, onClose, onSaved }) {
  const isEdit = Boolean(supplier?.id);
  const [form, setForm] = useState({
    name: supplier?.name || '',
    company: supplier?.company || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    status: supplier?.status || 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const buildBody = () => {
    const body = { name: form.name.trim() };

    FIELDS.filter((key) => key !== 'name').forEach((key) => {
      const value = form[key].trim();
      // Send an empty value only when the user cleared something that existed before
      if (value || (isEdit && supplier[key])) body[key] = value;
    });

    if (isEdit) body.status = form.status;
    return body;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (form.name.trim().length < 2) {
      setFieldErrors({ name: 'Name must be at least 2 characters' });
      return;
    }

    setSaving(true);
    try {
      const body = buildBody();
      const res = isEdit ? await api.patch(`/suppliers/${supplier.id}`, body) : await api.post('/suppliers', body);
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
      title={isEdit ? 'Edit supplier' : 'New supplier'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" icon={Save} loading={saving}>
            {isEdit ? 'Save changes' : 'Create supplier'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Field label="Supplier name" value={form.name} onChange={update('name')} error={fieldErrors.name} autoFocus />
        <Field
          label="Company (optional)"
          value={form.company}
          onChange={update('company')}
          error={fieldErrors.company}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Phone (optional)"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={update('phone')}
            error={fieldErrors.phone}
          />
          <Field
            label="Email (optional)"
            type="email"
            value={form.email}
            onChange={update('email')}
            error={fieldErrors.email}
          />
        </div>

        <Textarea
          label="Address (optional)"
          value={form.address}
          onChange={update('address')}
          error={fieldErrors.address}
        />

        {isEdit && (
          <Select label="Status" options={RECORD_STATUS_OPTIONS} value={form.status} onChange={update('status')} />
        )}
      </form>
    </Modal>
  );
}