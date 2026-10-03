'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import RequirePermission from '@/components/auth/RequirePermission';
import ProductForm from '@/components/catalog/ProductForm';
import StockBadge from '@/components/catalog/StockBadge';
import Badge from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-black/5 py-3 first:border-t-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function ProductDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/products/${id}`);
      setProduct(res.data);
      setImageFailed(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const canUpdate = can('products:update');
  const canSeeCost = can('products:view_cost');

  const back = (
    <Link
      href="/products"
      className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#bbf7d0]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to products
    </Link>
  );

  if (loading) {
    return (
      <div>
        {back}
        <div className="grid gap-4 lg:grid-cols-5" aria-busy="true">
          <div className="h-96 animate-pulse rounded-3xl bg-slate-100 lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-3xl bg-slate-100 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {back}
        <div className="rounded-3xl bg-white shadow-card">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {back}

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{product.name}</h1>
          <p className="mt-1 text-sm text-slate-500">SKU {product.sku}</p>
        </div>
        <div className="flex items-center gap-2">
          <StockBadge status={product.stockStatus} />
          <Badge tone={product.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-3xl bg-white p-5 shadow-card sm:p-6 lg:col-span-2">
          <div className="mb-5 flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-[#f0fdf4]">
            {product.image && !imageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image}
                alt={product.name}
                onError={() => setImageFailed(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <Package className="h-12 w-12 text-[#86efac]" aria-hidden="true" />
            )}
          </div>

          <dl>
            <DetailRow label="Category">{product.category?.name || '—'}</DetailRow>
            <DetailRow label="Brand">{product.brand?.name || '—'}</DetailRow>
            <DetailRow label="Barcode">{product.barcode || '—'}</DetailRow>
            {canSeeCost && <DetailRow label="Purchase price">{formatMoney(product.purchasePrice)}</DetailRow>}
            <DetailRow label="Selling price">{formatMoney(product.sellingPrice)}</DetailRow>
            <DetailRow label="Current stock">
              {formatNumber(product.currentStock)} {product.unit}
            </DetailRow>
            <DetailRow label="Minimum stock">
              {formatNumber(product.minStockLevel)} {product.unit}
            </DetailRow>
            <DetailRow label="Created">{formatDateTime(product.createdAt)}</DetailRow>
            <DetailRow label="Last updated">{formatDateTime(product.updatedAt)}</DetailRow>
          </dl>

          {product.description && (
            <p className="mt-4 border-t border-black/5 pt-4 text-sm text-slate-700">{product.description}</p>
          )}
        </section>

        {canUpdate && (
          <section className="rounded-3xl bg-white p-5 shadow-card sm:p-6 lg:col-span-3">
            <h2 className="mb-5 text-lg font-semibold text-ink">Edit product</h2>
            <ProductForm
              key={product.updatedAt}
              mode="edit"
              product={product}
              onSaved={(updated) => {
                setProduct(updated);
                setImageFailed(false);
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <RequirePermission permission="products:read">
      <ProductDetails />
    </RequirePermission>
  );
}