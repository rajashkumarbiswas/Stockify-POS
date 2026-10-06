'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import RequirePermission from '@/components/auth/RequirePermission';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import Field from '@/components/ui/Field';
import Textarea from '@/components/ui/Textarea';

const toForm = (setting) => ({
  businessName: setting.businessName || '',
  address: setting.address || '',
  phone: setting.phone || '',
  email: setting.email || '',
  taxId: setting.taxId || '',
  taxRate: String(setting.taxRate ?? 0),
  invoiceFooter: setting.invoiceFooter || '',
});

function SettingsForm() {
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await api.get('/settings');
      setForm(toForm(res.data));
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    const errors = {};
    const taxRate = Number(form.taxRate);
    if (form.businessName.trim().length < 2) errors.businessName = 'Business name must be at least 2 characters';
    if (form.taxRate === '' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      errors.taxRate = 'Enter a number between 0 and 100';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch('/settings', {
        businessName: form.businessName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        taxId: form.taxId.trim(),
        taxRate,
        invoiceFooter: form.invoiceFooter.trim(),
      });
      setForm(toForm(res.data));
      toast.success(res.message);
    } catch (err) {
      setError(err.message);
      setFieldErrors(Object.fromEntries((err.errors || []).map((e) => [e.field, e.message])));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Business details shown on invoices, and the tax added to every sale.</p>
      </header>

      {loadError ? (
        <div className="rounded-3xl bg-white shadow-card">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      ) : !form ? (
        <div className="space-y-4">
          <span className="block h-64 animate-pulse rounded-3xl bg-white/60" />
          <span className="block h-40 animate-pulse rounded-3xl bg-white/60" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 lg:grid-cols-2">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 lg:col-span-2"
            >
              {error}
            </p>
          )}

          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Business information</h2>
            <Field
              label="Business name"
              value={form.businessName}
              onChange={update('businessName')}
              error={fieldErrors.businessName}
            />
            <Textarea label="Address" rows={3} value={form.address} onChange={update('address')} error={fieldErrors.address} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" value={form.phone} onChange={update('phone')} error={fieldErrors.phone} />
              <Field label="Email" type="email" value={form.email} onChange={update('email')} error={fieldErrors.email} />
            </div>
            <Field label="Tax ID (optional)" value={form.taxId} onChange={update('taxId')} error={fieldErrors.taxId} />
          </section>

          <section className="space-y-4 rounded-3xl bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Tax and invoice</h2>
            <Field
              label="Tax rate (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={form.taxRate}
              onChange={update('taxRate')}
              error={fieldErrors.taxRate}
              hint="Added to every new sale. Enter 0 for no tax. Old invoices keep the rate they were sold with."
            />
            <Textarea
              label="Invoice footer"
              rows={3}
              value={form.invoiceFooter}
              onChange={update('invoiceFooter')}
              error={fieldErrors.invoiceFooter}
            />
            <Button type="submit" icon={Save} loading={saving} className="w-full sm:w-auto">
              Save settings
            </Button>
          </section>
        </form>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequirePermission permission="settings:update">
      <SettingsForm />
    </RequirePermission>
  );
}