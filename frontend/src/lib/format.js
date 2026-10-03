import { CURRENCY_SYMBOL } from '@/lib/constants';

export const formatMoney = (value) => {
  const number = Number(value);
  if (value === undefined || value === null || !Number.isFinite(number)) return '—';
  return `${CURRENCY_SYMBOL}${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '—';
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};