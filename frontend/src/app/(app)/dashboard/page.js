'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BarChart3, Package, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatNumber } from '@/lib/format';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';

const STOCK_DOT = { IN_STOCK: 'bg-emerald-400', LOW_STOCK: 'bg-amber-400', OUT_OF_STOCK: 'bg-red-400' };
const STOCK_LABEL = { IN_STOCK: 'In stock', LOW_STOCK: 'Low stock', OUT_OF_STOCK: 'Out of stock' };

const percentOf = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

function Skeleton({ className = 'h-9 w-16' }) {
  return <span className={`inline-block animate-pulse rounded-full bg-white/25 ${className}`} aria-hidden="true" />;
}

function OverviewStat({ label, value, loading }) {
  return (
    <div>
      <p className="text-3xl font-medium tracking-tight sm:text-4xl">
        {loading ? <Skeleton /> : formatNumber(value)}
      </p>
      <p className="mt-1 text-xs text-white/85">{label}</p>
    </div>
  );
}

function HealthBar({ label, percent, loading }) {
  const height = 30 + percent * 0.9;
  return (
    <div className="flex flex-1 flex-col justify-end">
      <p className="mb-1.5 text-xl font-medium">{loading ? '…' : `${percent}%`}</p>
      <div
        className="flex items-end rounded-t-xl border-t-[3px] border-accent bg-gradient-to-b from-white/35 to-white/10 px-2 pb-1.5"
        style={{ height }}
      >
        <span className="text-[11px] font-medium leading-tight text-white/90">{label}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const firstName = user.name.split(' ')[0];

  const [state, setState] = useState({ loading: true, error: '', data: null });

  // Real numbers from MongoDB (through the products and categories APIs)
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [all, low, out, latest, categories] = await Promise.all([
        api.get('/products', { limit: 1, status: 'ACTIVE' }),
        api.get('/products', { limit: 1, status: 'ACTIVE', stockStatus: 'LOW_STOCK' }),
        api.get('/products', { limit: 1, status: 'ACTIVE', stockStatus: 'OUT_OF_STOCK' }),
        api.get('/products', { limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
        api.get('/categories', { limit: 1 }),
      ]);

      const total = all.meta.pagination.totalItems;
      const lowStock = low.meta.pagination.totalItems;
      const outOfStock = out.meta.pagination.totalItems;

      setState({
        loading: false,
        error: '',
        data: {
          total,
          lowStock,
          outOfStock,
          inStock: Math.max(0, total - lowStock - outOfStock),
          categories: categories.meta.pagination.totalItems,
          latest: latest.data,
        },
      });
    } catch (err) {
      setState({ loading: false, error: err.message, data: null });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { loading, error, data } = state;

  const refreshButton = (
    <Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading} size="sm">
      Refresh
    </Button>
  );

  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" description={`Welcome back, ${firstName}`} actions={refreshButton} />
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      </div>
    );
  }

  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${firstName}. Here is your catalog at a glance.`}
        actions={refreshButton}
      />

      {/* Top section: soft green glow behind the tiles (decorative) */}
      <section className="relative overflow-hidden rounded-3xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 58% 48%, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.16) 28%, rgba(34,197,94,0) 55%), radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.2px)',
            backgroundSize: '100% 100%, 14px 14px',
          }}
        />

        <div className="relative grid gap-4 lg:min-h-[340px] lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="tile-glass p-5 ring-1 ring-white/10 sm:p-6">
              <h2 className="text-lg font-medium">Overview</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <OverviewStat label="Active products" value={data?.total} loading={loading} />
                <OverviewStat label="Low stock" value={data?.lowStock} loading={loading} />
                <OverviewStat label="Out of stock" value={data?.outOfStock} loading={loading} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="tile-glass flex flex-col justify-between p-5 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-medium">Categories</h3>
                  {can('categories:read') && (
                    <Link
                      href="/categories"
                      aria-label="Open categories"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white ring-1 ring-white/20 hover:bg-ink-800"
                    >
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <p className="mt-5 text-4xl font-medium tracking-tight">
                  {loading ? <Skeleton /> : formatNumber(data.categories)}
                </p>
              </div>

              <div className="tile-glass flex flex-col justify-between p-5 ring-1 ring-white/10">
                <h3 className="text-base font-medium">Today&apos;s sales</h3>
                <div className="mt-5">
                  <p className="text-4xl font-medium tracking-tight">—</p>
                  <p className="mt-1 text-xs text-white/85">Arrives with the sales module</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-end lg:col-span-7">
            <div className="tile-glass w-full p-5 ring-1 ring-white/10 sm:p-6 lg:max-w-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Stock health</h2>
                  <p className="mt-0.5 text-sm text-white/85">
                    {loading ? 'Counting...' : `${formatNumber(total)} active products`}
                  </p>
                </div>
                {can('products:read') && (
                  <Link
                    href="/products"
                    aria-label="Open products"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white ring-1 ring-white/20 hover:bg-ink-800"
                  >
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className="mt-5 flex items-end gap-3">
                <HealthBar label="In stock" percent={percentOf(data?.inStock ?? 0, total)} loading={loading} />
                <HealthBar label="Low stock" percent={percentOf(data?.lowStock ?? 0, total)} loading={loading} />
                <HealthBar label="Out" percent={percentOf(data?.outOfStock ?? 0, total)} loading={loading} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom section */}
      <section className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="tile-dark p-5 ring-1 ring-white/10 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Latest products</h2>
            {can('products:read') && (
              <Link href="/products" className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white">
                View all <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  <th className="pb-3 pr-3">Product</th>
                  <th className="hidden pb-3 pr-3 sm:table-cell">Category</th>
                  <th className="pb-3 pr-3">Price</th>
                  <th className="pb-3">Stock</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td colSpan={4} className="py-3.5">
                        <span className="block h-4 animate-pulse rounded-full bg-white/10" />
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  data.latest.map((product) => (
                    <tr key={product.id} className="border-t border-white/10">
                      <td className="py-3 pr-3">
                        <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                          {product.name}
                        </Link>
                        <p className="text-xs text-white/60">{product.sku}</p>
                      </td>
                      <td className="hidden py-3 pr-3 text-white/80 sm:table-cell">{product.category?.name || '—'}</td>
                      <td className="whitespace-nowrap py-3 pr-3">{formatMoney(product.sellingPrice)}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <span className={`h-2 w-2 rounded-full ${STOCK_DOT[product.stockStatus]}`} aria-hidden="true" />
                          {formatNumber(product.currentStock)} {product.unit}
                          <span className="sr-only">({STOCK_LABEL[product.stockStatus]})</span>
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {!loading && data.latest.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <Package className="h-5 w-5 text-white/70" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-medium">No products yet</p>
                <p className="mt-1 text-xs text-white/60">New products will appear here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="tile-dark flex flex-1 flex-col p-5 ring-1 ring-white/10 sm:p-6">
            <h2 className="text-lg font-medium">Sales overview</h2>
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <div aria-hidden="true" className="mb-5 flex h-16 w-full max-w-xs items-end justify-between gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-t-sm border-t-2 border-accent/70 bg-white/10" />
                ))}
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <BarChart3 className="h-5 w-5 text-white/70" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-medium">Sales charts will appear here</p>
              <p className="mt-1 max-w-xs text-xs text-white/60">
                Daily, weekly and monthly revenue show up once sales are recorded.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-accent-dark via-accent to-[#0d3d22] px-5 py-4 text-white ring-1 ring-white/10">
            <p className="text-sm font-medium">
              {can('products:create') ? 'Grow your catalog: add a new product' : 'Browse the product catalog'}
            </p>
            <Link
              href={can('products:create') ? '/products/new' : '/products'}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-800"
            >
              {can('products:create') && <Plus className="h-4 w-4" aria-hidden="true" />}
              {can('products:create') ? 'New product' : 'Open'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}