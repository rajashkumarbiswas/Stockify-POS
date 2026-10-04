'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Bell, ChevronDown, LogOut, Menu, Search, UserCircle2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/lib/constants';
import { NAV_ITEMS, isActivePath, isItemAllowed } from '@/lib/navigation';
import useClickOutside from '@/hooks/useClickOutside';
import Logo from '@/components/ui/Logo';

const getInitials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function TopNavItem({ item, active }) {
  const base = 'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors';

  if (!item.ready) {
    return (
      <span title="Coming soon" aria-disabled="true" className={clsx(base, 'cursor-not-allowed text-slate-400')}>
        {item.label}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={clsx(base, active ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-black/5')}
    >
      {item.label}
    </Link>
  );
}

function RailTooltip({ children }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full z-20 ml-3 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-pill ring-1 ring-white/20 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

const RAIL_BASE =
  'group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors';

function RailItem({ item, active, dark }) {
  const Icon = item.icon;

  if (!item.ready) {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} (coming soon)`}
        className={clsx(
          RAIL_BASE,
          'cursor-not-allowed',
          dark ? 'bg-white/5 text-white/30' : 'bg-black/5 text-slate-400'
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        <RailTooltip>{item.label} (soon)</RailTooltip>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        RAIL_BASE,
        active
          ? dark
            ? 'bg-white text-ink'
            : 'bg-ink text-white'
          : dark
            ? 'bg-white/10 text-white hover:bg-white/20'
            : 'bg-black/5 text-ink hover:bg-black/10'
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      <RailTooltip>{item.label}</RailTooltip>
    </Link>
  );
}

function UserMenu({ user, onLogout, signingOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition-colors hover:bg-black/5"
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-sm font-bold text-white"
          aria-hidden="true"
        >
          {getInitials(user.name)}
        </span>
        <ChevronDown
          className={clsx('h-4 w-4 text-slate-500 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-3 w-60 rounded-2xl border border-black/5 bg-white p-2 shadow-pill"
        >
          <div className="border-b border-black/5 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={close}
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-black/5"
          >
            <UserCircle2 className="h-4 w-4" aria-hidden="true" />
            My profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

function MobileDrawer({ open, onClose, items, pathname, user, onLogout, signingOut }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col rounded-r-[28px] bg-white p-4 shadow-pill">
        <div className="flex items-center justify-between px-2 py-2">
          <Logo variant="ink" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-600 hover:bg-black/5"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          {items.map((item) => {
            const Icon = item.icon;
            const row = 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium';
            const active = isActivePath(pathname, item.href);
            return item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(row, active ? 'bg-accent text-white' : 'text-slate-700 hover:bg-black/5')}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            ) : (
              <span key={item.href} aria-disabled="true" className={clsx(row, 'cursor-not-allowed text-slate-400')}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Soon
                </span>
              </span>
            );
          })}
        </nav>

        <div className="mt-3 space-y-1 border-t border-black/5 pt-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-black/5"
          >
            <UserCircle2 className="h-5 w-5" aria-hidden="true" />
            My profile
          </Link>
          <button
            type="button"
            onClick={onLogout}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            {signingOut ? 'Signing out...' : `Sign out (${user.name.split(' ')[0]})`}
          </button>
        </div>
      </aside>
    </div>
  );
}

/**
 * Signed-in page frame.
 * - Dashboard: light rounded frame on a dark backdrop (as before).
 * - Every other page: full-screen green-to-black gradient background, white menu pill on top,
 *   light-coloured side rail. The gradient is defined once in globals.css (.page-gradient).
 */
export default function AppShell({ children }) {
  const { user, can, canAny, logout } = useAuth();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const dark = !isDashboard;

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => isItemAllowed(item, can, canAny)),
    [can, canAny]
  );
  const primaryItems = visibleItems.filter((item) => item.primary);
  const railItems = visibleItems.filter((item) => !item.primary);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
  };

  return (
    <div className={clsx('relative min-h-screen', dark ? 'surface-dark bg-night' : 'bg-shell p-2 sm:p-5')}>
      {dark && (
        <div
          key={pathname}
          aria-hidden="true"
          className="page-gradient page-gradient-reveal pointer-events-none fixed inset-0 z-0"
        />
      )}

      <div
        className={clsx(
          'mx-auto flex w-full max-w-[1560px] flex-col p-4 sm:p-6',
          dark
            ? 'relative z-10 min-h-screen'
            : 'min-h-[calc(100vh-1rem)] rounded-[28px] bg-frame sm:min-h-[calc(100vh-2.5rem)]'
        )}
      >
        <header
          className={clsx(
            'flex items-center justify-between gap-3',
            dark && 'rounded-full bg-white px-3 py-2 shadow-pill sm:px-5'
          )}
        >
          <div className="flex items-center gap-3 xl:gap-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-full p-2.5 text-ink hover:bg-black/5 xl:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link href="/dashboard" aria-label="Stockify home">
              <Logo variant="ink" />
            </Link>
            <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
              {primaryItems.map((item) => (
                <TopNavItem key={item.href} item={item} active={isActivePath(pathname, item.href)} />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <span
              aria-disabled="true"
              title="Notifications are coming soon"
              className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full bg-black/5 text-slate-400"
            >
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <UserMenu user={user} onLogout={handleLogout} signingOut={signingOut} />
          </div>
        </header>

        <div className="mt-6 flex flex-1 gap-6">
          <aside className="hidden w-11 shrink-0 flex-col items-center gap-3 lg:flex" aria-label="Shortcuts">
            {can('products:read') && (
              <Link
                href="/products"
                aria-label="Search products"
                className={clsx(
                  RAIL_BASE,
                  'mb-2 h-12 w-12',
                  dark ? 'bg-white text-ink hover:bg-white/90' : 'bg-ink text-white hover:bg-ink-800'
                )}
              >
                <Search className="h-5 w-5" aria-hidden="true" />
                <RailTooltip>Search products</RailTooltip>
              </Link>
            )}

            {railItems.map((item) => (
              <RailItem key={item.href} item={item} active={isActivePath(pathname, item.href)} dark={dark} />
            ))}

            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              aria-label="Sign out"
              className={clsx(
                RAIL_BASE,
                'mt-auto disabled:opacity-60',
                dark
                  ? 'bg-white/10 text-white hover:bg-red-500/25 hover:text-red-200'
                  : 'bg-black/5 text-ink hover:bg-red-50 hover:text-red-600'
              )}
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
              <RailTooltip>Sign out</RailTooltip>
            </button>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={visibleItems}
        pathname={pathname}
        user={user}
        onLogout={handleLogout}
        signingOut={signingOut}
      />
    </div>
  );
}