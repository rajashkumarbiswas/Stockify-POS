'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import RequirePermission from '@/components/auth/RequirePermission';
import PurchaseForm from '@/components/purchases/PurchaseForm';
import PageHeader from '@/components/ui/PageHeader';

function NewPurchaseContent() {
  const searchParams = useSearchParams();

  return (
    <>
      <Link href="/purchases" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to purchases
      </Link>
      <PageHeader title="New purchase" description="Choose a supplier, add the products you bought and the prices you paid." />
      <PurchaseForm initialSupplierId={searchParams.get('supplier') || ''} />
    </>
  );
}

export default function NewPurchasePage() {
  return (
    <RequirePermission permission="purchases:create">
      <Suspense fallback={null}>
        <NewPurchaseContent />
      </Suspense>
    </RequirePermission>
  );
}