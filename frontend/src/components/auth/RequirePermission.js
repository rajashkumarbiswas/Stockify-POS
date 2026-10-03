'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * Wrap a page: <RequirePermission permission="products:create">...</RequirePermission>
 * or <RequirePermission anyOf={['sales:read_all', 'sales:read_own']}>...</RequirePermission>
 * This only improves the experience. The backend still blocks unauthorized API calls.
 */
export default function RequirePermission({ permission, anyOf, children }) {
  const { can, canAny } = useAuth();
  const allowed = anyOf ? canAny(...anyOf) : can(permission);

  if (allowed) return children;

  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-slate-900">Access denied</h2>
      <p className="mt-2 text-sm text-slate-600">
        Your role does not have permission to view this page.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}