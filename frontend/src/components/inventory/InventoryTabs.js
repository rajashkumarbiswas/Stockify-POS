'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const TABS = [
  { href: '/inventory', label: 'Stock levels' },
  { href: '/inventory/movements', label: 'Stock movements' },
];

/** Inventory pages always sit on the dark gradient, so the tabs use light colours. */
export default function InventoryTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 inline-flex rounded-full bg-white/10 p-1 backdrop-blur-sm" aria-label="Inventory sections">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              active ? 'bg-white text-ink' : 'text-white/80 hover:text-white'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}