'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { api } from '@/lib/api';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import RequirePermission from '@/components/auth/RequirePermission';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import { TH_CLASS } from '@/components/ui/SortableTh';

const TABS = [
  { value: 'sales', label: 'Sales' },
  { value: 'products', label: 'Products' },
  { value: 'purchases', label: 'Purchases' },
];

const dayLabel = (isoDate) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const periodLabel = (period) =>
  `${formatDate(period.start)} – ${formatDate(new Date(new Date(period.end).getTime() - 1))}`;

function StatTile({ label, value, hint, tone }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-card">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={clsx('mt-2 break-words text-2xl font-bold tracking-tight', tone === 'danger' ? 'text-red-600' : 'text-ink')}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Card({ title, subtitle, className = '', children }) {
  return (
    <section className={`rounded-3xl bg-white p-5 shadow-card sm:p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DataTable({ columns, rows, emptyText }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-slate-500">{emptyText}</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5">
      <table className="w-full min-w-[380px] text-sm">
        <thead className="bg-[#f6f4fc]">
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={clsx(TH_CLASS, column.right && 'text-right')}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.method} className="border-t border-black/5">
              {columns.map((column) => (
                <td key={column.label} className={clsx('px-4 py-3', column.right && 'text-right')}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const productCell = (row) => (
  <>
    <p className="font-semibold text-ink">{row.name}</p>
    <p className="text-xs text-slate-500">{row.sku}</p>
  </>
);

function LoadingBlocks() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="block h-28 animate-pulse rounded-3xl bg-white/60" />
        ))}
      </div>
      <span className="block h-72 animate-pulse rounded-3xl bg-white/60" />
    </div>
  );
}

/* ---------------- Sales ---------------- */
function SalesReport({ data }) {
  const { summary, daily, byPaymentMethod } = data;
  const chartData = daily.map((day) => ({ label: dayLabel(day.date), total: day.total, count: day.count }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total sales" value={formatMoney(summary.totalSales)} hint="Invoice totals, tax included" />
        <StatTile label="Total orders" value={formatNumber(summary.totalOrders)} hint={`Average ${formatMoney(summary.averageOrder)}`} />
        <StatTile label="Total discount" value={formatMoney(summary.totalDiscount)} />
        <StatTile label="Total tax" value={formatMoney(summary.totalTax)} />
        <StatTile label="Refunds" value={formatMoney(summary.totalRefunded)} hint="Money given back on returns" />
        <StatTile label="Net revenue" value={formatMoney(summary.netRevenue)} hint="Total sales minus refunds" />
      </div>

      <Card title="Sales by day" subtitle="Net of refunds">
        {summary.totalOrders > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,0.05)' }}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  formatter={(value, name, item) => [formatMoney(value), `Sales · ${item.payload.count} order(s)`]}
                />
                <Bar dataKey="total" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <BarChart3 className="h-6 w-6 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-ink">No sales in this period</p>
          </div>
        )}
      </Card>

      <Card title="Payment methods">
        <DataTable
          emptyText="No sales in this period."
          rows={byPaymentMethod}
          columns={[
            { label: 'Method', render: (row) => <span className="font-semibold text-ink">{PAYMENT_METHOD_LABELS[row.method] || row.method}</span> },
            { label: 'Orders', render: (row) => formatNumber(row.count) },
            { label: 'Total', right: true, render: (row) => <span className="font-semibold text-ink">{formatMoney(row.total)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

/* ---------------- Products ---------------- */
function ProductsReport({ data }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Best-selling products" subtitle="By units sold in the selected period">
          <DataTable
            emptyText="No sales in this period."
            rows={data.bestSelling}
            columns={[
              { label: 'Product', render: productCell },
              { label: 'Sold', right: true, render: (row) => <span className="font-semibold text-ink">{formatNumber(row.quantity)}</span> },
              { label: 'Revenue', right: true, render: (row) => formatMoney(row.revenue) },
            ]}
          />
        </Card>

        <Card title="Highest revenue products" subtitle="By money earned in the selected period">
          <DataTable
            emptyText="No sales in this period."
            rows={data.highestRevenue}
            columns={[
              { label: 'Product', render: productCell },
              { label: 'Revenue', right: true, render: (row) => <span className="font-semibold text-ink">{formatMoney(row.revenue)}</span> },
              { label: 'Sold', right: true, render: (row) => formatNumber(row.quantity) },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Low-stock products (${formatNumber(data.lowStock.count)})`} subtitle="Current stock, not affected by the date">
          <DataTable
            emptyText="No product is running low."
            rows={data.lowStock.items}
            columns={[
              { label: 'Product', render: productCell },
              { label: 'Stock', right: true, render: (row) => <span className="font-semibold text-amber-600">{formatNumber(row.currentStock)} {row.unit}</span> },
              { label: 'Minimum', right: true, render: (row) => formatNumber(row.minStockLevel) },
            ]}
          />
        </Card>

        <Card title={`Out-of-stock products (${formatNumber(data.outOfStock.count)})`} subtitle="Current stock, not affected by the date">
          <DataTable
            emptyText="No product is out of stock."
            rows={data.outOfStock.items}
            columns={[
              { label: 'Product', render: productCell },
              { label: 'Stock', right: true, render: (row) => <span className="font-semibold text-red-600">0 {row.unit}</span> },
              { label: 'Minimum', right: true, render: (row) => formatNumber(row.minStockLevel) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Purchases ---------------- */
function PurchasesReport({ data }) {
  const { summary, suppliers } = data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total purchases" value={formatNumber(summary.totalPurchases)} hint="Received purchases" />
        <StatTile label="Purchase cost" value={formatMoney(summary.purchaseCost)} />
        <StatTile label="Paid to suppliers" value={formatMoney(summary.totalPaid)} />
        <StatTile label="Still owed" value={formatMoney(summary.totalDue)} tone={summary.totalDue > 0 ? 'danger' : undefined} />
        <StatTile label="Total discount" value={formatMoney(summary.totalDiscount)} />
        <StatTile label="Total tax" value={formatMoney(summary.totalTax)} />
        <StatTile label="Pending orders" value={formatNumber(summary.pendingOrders)} hint="Ordered, not received yet" />
      </div>

      <Card title="Supplier-wise purchases" subtitle="Received purchases in the selected period">
        <DataTable
          emptyText="No received purchases in this period."
          rows={suppliers}
          columns={[
            {
              label: 'Supplier',
              render: (row) => (
                <>
                  <p className="font-semibold text-ink">{row.name}</p>
                  {row.company && <p className="text-xs text-slate-500">{row.company}</p>}
                </>
              ),
            },
            { label: 'Purchases', right: true, render: (row) => formatNumber(row.count) },
            { label: 'Total', right: true, render: (row) => <span className="font-semibold text-ink">{formatMoney(row.total)}</span> },
            { label: 'Paid', right: true, render: (row) => formatMoney(row.paid) },
            {
              label: 'Due',
              right: true,
              render: (row) => <span className={row.due > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}>{formatMoney(row.due)}</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

/* ---------------- Page ---------------- */
function ReportsView() {
  const [tab, setTab] = useState('sales');
  const [filter, setFilter] = useState({ range: 'this_month', from: '', to: '' });
  // `tab` inside the state tells which report the data belongs to
  const [state, setState] = useState({ loading: true, error: '', data: null, tab: 'sales' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: '', data: null, tab });
    api
      .get(`/reports/${tab}`, filter)
      .then((res) => active && setState({ loading: false, error: '', data: res.data, tab }))
      .catch((err) => active && setState({ loading: false, error: err.message, data: null, tab }));
    return () => {
      active = false;
    };
  }, [tab, filter, reloadKey]);

  // "Custom range" sends an empty range until both dates are chosen: keep the current report until then
  const handleRange = (value) => {
    if (value.range) setFilter(value);
  };

  const { loading, error, data } = state;

  // Right after clicking another tab, the old tab's data is still in the state for one render.
  // It must never be shown in the new tab, so only use data that belongs to the current tab.
  const sameTab = state.tab === tab;
  const ready = sameTab && !loading && Boolean(data);

  return (
    <div>
      <PageHeader title="Reports" description="Sales, products and purchases, calculated from your database." />

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="flex gap-1.5" role="tablist" aria-label="Report type">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                onClick={() => setTab(item.value)}
                className={clsx(
                  'h-11 rounded-full px-5 text-sm font-medium transition-colors',
                  tab === item.value ? 'bg-ink text-white' : 'bg-slate-100 text-ink hover:bg-slate-200'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <DateRangeFilter allowAll={false} initialChoice="this_month" onChange={handleRange} className="lg:w-48" />
        </div>
        {ready && <p className="mt-3 text-xs text-slate-500">Showing {periodLabel(data.period)}</p>}
      </section>

      {sameTab && error ? (
        <div className="rounded-3xl bg-white shadow-card">
          <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      ) : !ready ? (
        <LoadingBlocks />
      ) : tab === 'sales' ? (
        <SalesReport data={data} />
      ) : tab === 'products' ? (
        <ProductsReport data={data} />
      ) : (
        <PurchasesReport data={data} />
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequirePermission permission="reports:view">
      <ReportsView />
    </RequirePermission>
  );
}