'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PAYMENT_METHOD_LABELS, PURCHASE_STATUS_META } from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import SalesChartCard from '@/components/dashboard/SalesChartCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';

const percentOf = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

// null = the user may not see this number
const show = (value, format = formatNumber) => (value === null || value === undefined ? '—' : format(value));

function Skeleton({ className = 'h-8 w-20' }) {
  return <span className={`inline-block animate-pulse rounded-full bg-white/25 ${className}`} aria-hidden="true" />;
}

function StatItem({ label, value, loading }) {
  return (
    <div className="min-w-0">
      <p className="break-words text-2xl font-medium tracking-tight sm:text-3xl">{loading ? <Skeleton /> : value}</p>
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

function Panel({ title, href, className = '', children }) {
  return (
    <div className={`tile-dark p-5 ring-1 ring-white/10 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white">
            View all <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className="block h-10 animate-pulse rounded-xl bg-white/10" />
      ))}
    </div>
  );
}

function EmptyNote({ text }) {
  return <p className="py-8 text-center text-sm text-white/60">{text}</p>;
}

function Row({ title, subtitle, right, rightSub }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-white/60">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">{right}</p>
        {rightSub && <div className="mt-0.5 text-xs text-white/60">{rightSub}</div>}
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user.name.split(' ')[0];

  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await api.get('/dashboard/summary');
      setState({ loading: false, error: '', data: res.data });
    } catch (err) {
      setState({ loading: false, error: err.message, data: null });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshKey((key) => key + 1); // also reloads the chart
    load();
  };

  const { loading, error, data } = state;

  const refreshButton = (
    <Button variant="secondary" icon={RefreshCw} onClick={refresh} loading={loading} size="sm">
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

  const stats = data?.stats;
  const totalProducts = stats?.totalProducts ?? 0;
  const lowStock = stats?.lowStock ?? 0;
  const outOfStock = stats?.outOfStock ?? 0;
  const inStock = Math.max(0, totalProducts - lowStock - outOfStock);
  const topMax = Math.max(1, ...(data?.topProducts || []).map((product) => product.quantity));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${firstName}. ${data?.scope === 'own' ? 'Here are your sales at a glance.' : 'Here is your business at a glance.'}`}
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
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="tile-glass p-5 ring-1 ring-white/10 sm:p-6">
              <h2 className="text-lg font-medium">{data?.scope === 'own' ? 'My sales' : 'Sales'}</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <StatItem label="Today's sales" value={show(stats?.todaySales, formatMoney)} loading={loading} />
                <StatItem label="Today's orders" value={show(stats?.todayOrders)} loading={loading} />
                <StatItem label="Total revenue" value={show(stats?.totalRevenue, formatMoney)} loading={loading} />
              </div>
            </div>

            <div className="tile-glass p-5 ring-1 ring-white/10 sm:p-6">
              <h2 className="text-lg font-medium">Business</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatItem label="Total products" value={show(stats?.totalProducts)} loading={loading} />
                <StatItem label="Low stock" value={show(stats?.lowStock)} loading={loading} />
                <StatItem label="Pending purchases" value={show(stats?.pendingPurchases)} loading={loading} />
                <StatItem label="Total customers" value={show(stats?.totalCustomers)} loading={loading} />
              </div>
            </div>
          </div>

          <div className="flex items-end justify-end lg:col-span-5">
            <div className="tile-glass w-full p-5 ring-1 ring-white/10 sm:p-6 lg:max-w-sm">
              <h2 className="text-lg font-medium">Stock health</h2>
              <p className="mt-0.5 text-sm text-white/85">
                {loading ? 'Counting...' : stats?.totalProducts === null ? 'Not available' : `${formatNumber(totalProducts)} active products`}
              </p>
              <div className="mt-5 flex items-end gap-3">
                <HealthBar label="In stock" percent={percentOf(inStock, totalProducts)} loading={loading} />
                <HealthBar label="Low stock" percent={percentOf(lowStock, totalProducts)} loading={loading} />
                <HealthBar label="Out" percent={percentOf(outOfStock, totalProducts)} loading={loading} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Charts and lists */}
      <section className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SalesChartCard refreshKey={refreshKey} />
        </div>

        <Panel title="Top selling products" className="lg:col-span-5">
          <p className="mt-0.5 text-xs text-white/60">Units sold, last 30 days</p>
          {loading ? (
            <ListSkeleton />
          ) : data.topProducts.length === 0 ? (
            <EmptyNote text="No sales yet." />
          ) : (
            <ul className="mt-4 space-y-4">
              {data.topProducts.map((product) => (
                <li key={product.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="shrink-0 text-sm font-semibold">{formatNumber(product.quantity)} sold</p>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-accent-glow"
                      style={{ width: `${Math.max(4, (product.quantity / topMax) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-white/60">
                    {product.sku} · {formatMoney(product.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent sales" href="/sales" className="lg:col-span-7">
          {loading ? (
            <ListSkeleton />
          ) : data.recentSales.length === 0 ? (
            <EmptyNote text="No sales yet." />
          ) : (
            <ul className="mt-2 divide-y divide-white/10">
              {data.recentSales.map((sale) => (
                <Row
                  key={sale.id}
                  title={sale.invoiceNumber}
                  subtitle={`${sale.customer?.name || 'Walk-in'} · ${formatDateTime(sale.createdAt)}`}
                  right={formatMoney(sale.grandTotal)}
                  rightSub={PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}
                />
              ))}
            </ul>
          )}
        </Panel>

        {data?.lowStockProducts && (
          <Panel title="Low-stock products" href="/inventory" className="lg:col-span-5">
            {loading ? (
              <ListSkeleton />
            ) : data.lowStockProducts.length === 0 ? (
              <EmptyNote text="All products have enough stock." />
            ) : (
              <ul className="mt-2 divide-y divide-white/10">
                {data.lowStockProducts.map((product) => (
                  <Row
                    key={product.id}
                    title={product.name}
                    subtitle={`${product.sku} · minimum ${formatNumber(product.minStockLevel)}`}
                    right={`${formatNumber(product.currentStock)} ${product.unit}`}
                    rightSub={
                      <Badge tone={product.stockStatus === 'OUT_OF_STOCK' ? 'danger' : 'warning'}>
                        {product.stockStatus === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock'}
                      </Badge>
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>
        )}

        {data?.recentPurchases && (
          <Panel title="Recent purchases" href="/purchases" className="lg:col-span-7">
            {data.recentPurchases.length === 0 ? (
              <EmptyNote text="No purchases yet." />
            ) : (
              <ul className="mt-2 divide-y divide-white/10">
                {data.recentPurchases.map((purchase) => {
                  const meta = PURCHASE_STATUS_META[purchase.status];
                  return (
                    <Row
                      key={purchase.id}
                      title={purchase.invoiceNumber}
                      subtitle={`${purchase.supplier?.name || '—'} · ${formatDateTime(purchase.createdAt)}`}
                      right={formatMoney(purchase.grandTotal)}
                      rightSub={meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : purchase.status}
                    />
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {data?.recentActivities && (
          <Panel title="Recent activities" href="/activity-logs" className="lg:col-span-5">
            {data.recentActivities.length === 0 ? (
              <EmptyNote text="No activity yet." />
            ) : (
              <ul className="mt-2 divide-y divide-white/10">
                {data.recentActivities.map((activity) => (
                  <li key={activity.id} className="py-3">
                    <p className="text-sm">{activity.description}</p>
                    <p className="mt-0.5 text-xs text-white/60">
                      {activity.user?.name || 'System'} · {formatDateTime(activity.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </section>
    </div>
  );
}