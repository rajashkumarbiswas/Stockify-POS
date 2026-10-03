'use client';

import { Bookmark } from 'lucide-react';
import RequirePermission from '@/components/auth/RequirePermission';
import NamedEntityPage from '@/components/catalog/NamedEntityPage';

export default function BrandsPage() {
  return (
    <RequirePermission permission="brands:read">
      <NamedEntityPage
        title="Brands"
        singular="Brand"
        description="Manage the brands of the products you sell."
        endpoint="/brands"
        emptyIcon={Bookmark}
        permissions={{ create: 'brands:create', update: 'brands:update', delete: 'brands:delete' }}
      />
    </RequirePermission>
  );
}