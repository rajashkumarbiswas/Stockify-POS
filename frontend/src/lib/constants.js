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

// Stock movement types (must match MOVEMENT_TYPES in the backend)
export const MOVEMENT_TYPE_META = {
  PURCHASE: { label: 'Purchase', tone: 'info' },
  SALE: { label: 'Sale', tone: 'neutral' },
  MANUAL_INCREASE: { label: 'Manual increase', tone: 'success' },
  MANUAL_DECREASE: { label: 'Manual decrease', tone: 'danger' },
  RETURN: { label: 'Return', tone: 'lime' },
  ADJUSTMENT: { label: 'Stock take', tone: 'warning' },
};

export const MOVEMENT_TYPE_OPTIONS = Object.entries(MOVEMENT_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const DATE_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

// Payment methods (must match PAYMENT_METHODS in the backend)
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_BANKING', label: 'Mobile banking' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label])
);

// Purchase statuses
export const PURCHASE_STATUS_META = {
  PENDING: { label: 'Pending', tone: 'warning' },
  RECEIVED: { label: 'Received', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const PURCHASE_STATUS_OPTIONS = Object.entries(PURCHASE_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const PAYMENT_STATUS_META = {
  PAID: { label: 'Paid', tone: 'success' },
  PARTIAL: { label: 'Partial', tone: 'warning' },
  UNPAID: { label: 'Unpaid', tone: 'danger' },
};

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));