import {
  BarChart3,
  Bookmark,
  Boxes,
  Package,
  Receipt,
  ScanBarcode,
  ScrollText,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Undo2,
  LayoutDashboard,
  Users,
} from 'lucide-react';

/**
 * Single source of truth for navigation.
 * - permission / anyOf: item is hidden when the user lacks it (UI only; the backend enforces access)
 * - primary: shown in the top bar; the rest go under the side rail
 * - ready: set to true when the page is built (until then it shows as "coming soon")
 */
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, primary: true, ready: true },
  { href: '/pos', label: 'POS', icon: ScanBarcode, permission: 'sales:create', primary: true, ready: false },
  {
    href: '/sales',
    label: 'Sales',
    icon: Receipt,
    anyOf: ['sales:read_all', 'sales:read_own'],
    primary: true,
    ready: false,
  },
  { href: '/products', label: 'Products', icon: Package, permission: 'products:read', primary: true, ready: true },
  { href: '/inventory', label: 'Inventory', icon: Boxes, permission: 'inventory:read', primary: true, ready: true },
  {
    href: '/purchases',
    label: 'Purchases',
    icon: ShoppingCart,
    permission: 'purchases:read',
    primary: true,
    ready: true,
  },
  { href: '/customers', label: 'Customers', icon: Users, permission: 'customers:read', primary: true, ready: false },
  { href: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports:view', primary: true, ready: false },

  { href: '/categories', label: 'Categories', icon: Tags, permission: 'categories:read', ready: true },
  { href: '/brands', label: 'Brands', icon: Bookmark, permission: 'brands:read', ready: true },
  { href: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers:read', ready: true },
  { href: '/returns', label: 'Returns', icon: Undo2, permission: 'returns:read', ready: false },
  { href: '/activity-logs', label: 'Activity logs', icon: ScrollText, permission: 'activities:view', ready: false },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings:update', ready: false },
];

export const isItemAllowed = (item, can, canAny) => {
  if (item.anyOf) return canAny(...item.anyOf);
  if (item.permission) return can(item.permission);
  return true;
};

export const isActivePath = (pathname, href) => pathname === href || pathname.startsWith(`${href}/`);