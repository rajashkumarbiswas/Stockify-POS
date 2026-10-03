'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const TABS = [
  { href: '/inventory', label: 'Stock levels' },
  { href: '/inventory/movements', label: 'Stock movements' },
];

export default function InventoryTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 inline-flex rounded-full bg-black/5 p-1" aria-label="Inventory sections">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              active ? 'bg-ink text-white' : 'text-slate-700 hover:text-ink'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}