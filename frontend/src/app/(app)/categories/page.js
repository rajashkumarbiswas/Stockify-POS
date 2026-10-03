'use client';

import { Tags } from 'lucide-react';
import RequirePermission from '@/components/auth/RequirePermission';
import NamedEntityPage from '@/components/catalog/NamedEntityPage';

export default function CategoriesPage() {
  return (
    <RequirePermission permission="categories:read">
      <NamedEntityPage
        title="Categories"
        singular="Category"
        description="Group your products so they are easy to find and report on."
        endpoint="/categories"
        emptyIcon={Tags}
        permissions={{ create: 'categories:create', update: 'categories:update', delete: 'categories:delete' }}
      />
    </RequirePermission>
  );
}