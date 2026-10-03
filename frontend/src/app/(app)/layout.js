'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import PageLoader from '@/components/ui/PageLoader';

/** Guards every signed-in page, then wraps it in the app frame. */
export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) return <PageLoader label="Loading your workspace..." />;

  return <AppShell>{children}</AppShell>;
}