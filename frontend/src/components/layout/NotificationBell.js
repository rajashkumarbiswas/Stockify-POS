'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Bell, BellOff, CheckCheck, CheckCircle2, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import useClickOutside from '@/hooks/useClickOutside';

const SEVERITY_STYLE = {
  INFO: { icon: Info, className: 'bg-sky-50 text-sky-600' },
  SUCCESS: { icon: CheckCircle2, className: 'bg-green-50 text-green-600' },
  WARNING: { icon: AlertTriangle, className: 'bg-amber-50 text-amber-600' },
  DANGER: { icon: AlertTriangle, className: 'bg-red-50 text-red-600' },
};

const POLL_INTERVAL_MS = 60000;

const timeAgo = (value) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDateTime(value);
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const refreshCount = useCallback(() => {
    api
      .get('/notifications/unread-count')
      .then((res) => setUnread(res.data.count))
      .catch(() => {}); // the badge simply keeps its last value
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/notifications', { limit: 10 });
      setItems(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // The number on the bell is refreshed every minute
  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshCount]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      loadItems();
      refreshCount();
    }
  };

  const markRead = (item) => {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setUnread((count) => Math.max(0, count - 1));
    api.patch(`/notifications/${item.id}/read`).catch(() => {
      refreshCount();
      loadItems();
    });
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-black/5 text-ink transition-colors hover:bg-black/10"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-black/5 bg-white p-2 shadow-pill">
          <div className="flex items-center justify-between px-3 pb-2 pt-2">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#6b5fb0] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto border-t border-black/5">
            {error ? (
              <p role="alert" className="px-3 py-6 text-center text-sm text-red-600">
                {error}
              </p>
            ) : loading && items.length === 0 ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className="block h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-3 py-10 text-center">
                <BellOff className="h-6 w-6 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-ink">No notifications</p>
                <p className="mt-0.5 text-xs text-slate-500">Stock alerts and sales will show up here.</p>
              </div>
            ) : (
              items.map((item) => {
                const style = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.INFO;
                const Icon = style.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markRead(item)}
                    className={clsx(
                      'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-black/5',
                      !item.read && 'bg-[#f6f4fc]'
                    )}
                  >
                    <span className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', style.className)}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{item.title}</span>
                        {!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#6b5fb0]" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-600">{item.message}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(item.createdAt)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}