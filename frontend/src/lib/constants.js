// Must match COOKIE_NAME in backend/utils/token.js
export const AUTH_COOKIE_NAME = 'stockify_token';

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES_STAFF: 'Sales Staff',
};

// Shown in front of prices. A Settings page (Phase 13) will make this configurable.
export const CURRENCY_SYMBOL = '৳';

// Must match PRODUCT_UNITS in backend/config/constants.js
export const PRODUCT_UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack', 'dozen'];

export const RECORD_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const STOCK_STATUS_OPTIONS = [
  { value: 'IN_STOCK', label: 'In stock' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
];