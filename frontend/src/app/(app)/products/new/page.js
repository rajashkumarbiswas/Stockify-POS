'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import RequirePermission from '@/components/auth/RequirePermission';
import ProductForm from '@/components/catalog/ProductForm';

export default function NewProductPage() {
  const router = useRouter();

  return (
    <RequirePermission permission="products:create">
      <Link
        href="/products"
        className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#bbf7d0]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to products
      </Link>

      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">New product</h1>
        <p className="mt-1 text-sm text-slate-500">Fill in the details. You can edit them later.</p>
      </header>

      <div className="max-w-3xl rounded-3xl bg-white p-5 shadow-card sm:p-6">
        <ProductForm mode="create" onSaved={() => router.push('/products')} />
      </div>
    </RequirePermission>
  );
}