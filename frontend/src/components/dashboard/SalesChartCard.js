'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { api } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';

const PERIODS = [
  { value: 'daily', label: 'Daily', hint: 'Last 14 days' },
  { value: 'weekly', label: 'Weekly', hint: 'Last 8 weeks (from Monday)' },
  { value: 'monthly', label: 'Monthly', hint: 'Last 6 months' },
];

const formatLabel = (period, key) => {
  const [year, month, day] = key.split('-').map(Number);
  if (period === 'monthly') {
    return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  }
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

/** Daily / weekly / monthly sales bars. The numbers come from the backend (MongoDB). */
export default function SalesChartCard({ refreshKey = 0 }) {
  const [period, setPeriod] = useState('daily');
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api
      .get('/dashboard/sales-chart', { period })
      .then((res) => active && setState({ loading: false, error: '', data: res.data }))
      .catch((err) => active && setState({ loading: false, error: err.message, data: null }));
    return () => {
      active = false;
    };
  }, [period, refreshKey]);

  const { loading, error, data } = state;
  const current = PERIODS.find((item) => item.value === period);
  const hasSales = Boolean(data && data.periodCount > 0);
  const chartData = data
    ? data.buckets.map((bucket) => ({ label: formatLabel(data.period, bucket.key), total: bucket.total, count: bucket.count }))
    : [];

  return (
    <div className="tile-dark p-5 ring-1 ring-white/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Sales overview</h2>
          <p className="mt-0.5 text-xs text-white/60">{current.hint}</p>
        </div>
        <div className="flex gap-1 rounded-full bg-white/10 p-1" role="group" aria-label="Chart period">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              aria-pressed={period === item.value}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                period === item.value ? 'bg-white text-ink' : 'text-white/80 hover:bg-white/10'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {hasSales ? (
        <>
          <p className="mt-3 text-sm text-white/80">
            <span className="text-xl font-semibold text-white">{formatMoney(data.periodTotal)}</span> from{' '}
            {formatNumber(data.periodCount)} {data.periodCount === 1 ? 'order' : 'orders'}
          </p>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                  contentStyle={{
                    background: '#0b110e',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value, name, item) => [formatMoney(value), `Sales · ${item.payload.count} order(s)`]}
                />
                <Bar dataKey="total" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <BarChart3 className="h-5 w-5 text-white/70" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-medium">
            {loading ? 'Loading sales...' : error ? 'Could not load sales' : 'No sales in this period'}
          </p>
          {!loading && !error && <p className="mt-1 text-xs text-white/60">Completed sales from the POS show up here.</p>}
          {error && <p className="mt-1 max-w-xs text-xs text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}