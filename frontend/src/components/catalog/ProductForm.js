'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PRODUCT_UNITS, RECORD_STATUS_OPTIONS } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';

const UNIT_OPTIONS = PRODUCT_UNITS.map((unit) => ({ value: unit, label: unit }));

const toFormState = (product) => ({
  name: product?.name || '',
  sku: product?.sku || '',
  barcode: product?.barcode || '',
  category: product?.category?.id || '',
  brand: product?.brand?.id || '',
  purchasePrice: product?.purchasePrice !== undefined ? String(product.purchasePrice) : '',
  sellingPrice: product?.sellingPrice !== undefined ? String(product.sellingPrice) : '',
  minStockLevel: product?.minStockLevel !== undefined ? String(product.minStockLevel) : '5',
  openingStock: '',
  unit: product?.unit || 'pcs',
  image: product?.image || '',
  description: product?.description || '',
  status: product?.status || 'ACTIVE',
});

/**
 * Create / edit form.
 * There is no "current stock" field: stock only changes through inventory operations,
 * purchases, sales and returns. The only exception is the optional "Opening stock" when
 * creating a product, which the backend records as a stock movement.
 */
export default function ProductForm({ mode, product, onSaved }) {
  const isEdit = mode === 'edit';
  const { can } = useAuth();
  const canSetOpeningStock = !isEdit && can('inventory:adjust');

  const [form, setForm] = useState(() => toFormState(product));
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [optionsError, setOptionsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/categories/options'), api.get('/brands/options')])
      .then(([cats, brs]) => {
        if (!active) return;
        setCategories(cats.data);
        setBrands(brs.data);
      })
      .catch((err) => active && setOptionsError(err.message));
    return () => {
      active = false;
    };
  }, []);

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const brandOptions = useMemo(() => brands.map((b) => ({ value: b.id, label: b.name })), [brands]);

  const cost = Number(form.purchasePrice);
  const price = Number(form.sellingPrice);
  const showMargin = form.purchasePrice !== '' && form.sellingPrice !== '' && cost >= 0 && price >= 0;
  const profit = price - cost;
  const marginPercent = price > 0 ? (profit / price) * 100 : 0;

  const validate = () => {
    const errors = {};
    if (form.name.trim().length < 2) errors.name = 'Product name is required';
    if (!form.sku.trim()) errors.sku = 'SKU is required';
    if (!form.category) errors.category = 'Choose a category';
    if (form.purchasePrice === '' || Number(form.purchasePrice) < 0) errors.purchasePrice = 'Enter a valid price';
    if (form.sellingPrice === '' || Number(form.sellingPrice) < 0) errors.sellingPrice = 'Enter a valid price';
    if (!Number.isInteger(Number(form.minStockLevel)) || Number(form.minStockLevel) < 0) {
      errors.minStockLevel = 'Enter a whole number (0 or more)';
    }
    if (
      canSetOpeningStock &&
      form.openingStock !== '' &&
      (!Number.isInteger(Number(form.openingStock)) || Number(form.openingStock) < 0)
    ) {
      errors.openingStock = 'Enter a whole number (0 or more)';
    }
    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      category: form.category,
      brand: form.brand || null,
      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      minStockLevel: Number(form.minStockLevel),
      unit: form.unit,
      image: form.image.trim(),
      description: form.description.trim(),
      status: form.status,
    };
    if (canSetOpeningStock && form.openingStock !== '' && Number(form.openingStock) > 0) {
      payload.openingStock = Number(form.openingStock);
    }

    setSaving(true);
    try {
      const res = isEdit ? await api.patch(`/products/${product.id}`, payload) : await api.post('/products', payload);
      toast.success(res.message);
      onSaved(res.data);
    } catch (err) {
      setError(err.message);
      setFieldErrors(Object.fromEntries((err.errors || []).map((e) => [e.field, e.message])));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {(error || optionsError) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error || optionsError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          className="sm:col-span-2"
          label="Product name"
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          placeholder="e.g. Samsung Galaxy A15 128GB"
        />
        <Field
          label="SKU"
          value={form.sku}
          onChange={update('sku')}
          error={fieldErrors.sku}
          hint="Unique code. Saved in capital letters."
          placeholder="e.g. PHN-SAM-A15"
        />
        <Field
          label="Barcode (optional)"
          value={form.barcode}
          onChange={update('barcode')}
          error={fieldErrors.barcode}
          hint="Scan with a barcode reader or type it."
        />
        <Select
          label="Category"
          placeholder="Select a category"
          options={categoryOptions}
          value={form.category}
          onChange={update('category')}
          error={fieldErrors.category}
          hint={categories.length === 0 && !optionsError ? 'No active categories yet. Create one first.' : undefined}
        />
        <Select
          label="Brand (optional)"
          placeholder="No brand"
          options={brandOptions}
          value={form.brand}
          onChange={update('brand')}
          error={fieldErrors.brand}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Purchase price"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.purchasePrice}
          onChange={update('purchasePrice')}
          error={fieldErrors.purchasePrice}
        />
        <Field
          label="Selling price"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={form.sellingPrice}
          onChange={update('sellingPrice')}
          error={fieldErrors.sellingPrice}
        />
        {showMargin && (
          <p className="text-sm text-slate-600 sm:col-span-2">
            Profit per unit:{' '}
            <strong className={profit < 0 ? 'text-red-600' : 'text-emerald-700'}>
              {formatMoney(profit)} ({marginPercent.toFixed(1)}%)
            </strong>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Minimum stock level"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={form.minStockLevel}
          onChange={update('minStockLevel')}
          error={fieldErrors.minStockLevel}
          hint="Low-stock alert at or below this."
        />
        <Select label="Unit" options={UNIT_OPTIONS} value={form.unit} onChange={update('unit')} />
        <Select label="Status" options={RECORD_STATUS_OPTIONS} value={form.status} onChange={update('status')} />
      </div>

      {canSetOpeningStock && (
        <Field
          className="sm:max-w-xs"
          label="Opening stock (optional)"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={form.openingStock}
          onChange={update('openingStock')}
          error={fieldErrors.openingStock}
          hint="Units you already have. Saved as a stock movement."
        />
      )}

      <Field
        label="Image URL (optional)"
        type="url"
        value={form.image}
        onChange={update('image')}
        error={fieldErrors.image}
        placeholder="https://..."
      />
      <Textarea
        label="Description (optional)"
        rows={4}
        value={form.description}
        onChange={update('description')}
        error={fieldErrors.description}
      />

      <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-card">
        {isEdit
          ? 'Stock quantity cannot be edited here. Use Inventory to add, remove or count stock.'
          : 'Stock is never typed in directly. Opening stock is recorded as a stock movement, and later changes go through Purchases, Sales, Returns or Inventory adjustments.'}
      </p>

      <div className="flex justify-end">
        <Button type="submit" icon={Save} loading={saving}>
          {isEdit ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}