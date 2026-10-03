const { ROLES } = require('./constants');

/**
 * Single source of truth for authorization.
 *
 * Routes check PERMISSIONS (authorize('products:create')), never role names,
 * so every rule lives in this one file. The frontend receives the permission
 * list of the logged-in user from /api/auth/me and uses it ONLY to show or
 * hide UI. The backend enforces every rule again on every request.
 */
const PERMISSIONS = Object.freeze({
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  PRODUCTS_READ: 'products:read',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_VIEW_COST: 'products:view_cost', // purchase price / profit data

  CATEGORIES_READ: 'categories:read',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  BRANDS_READ: 'brands:read',
  BRANDS_CREATE: 'brands:create',
  BRANDS_UPDATE: 'brands:update',
  BRANDS_DELETE: 'brands:delete',

  INVENTORY_READ: 'inventory:read',
  INVENTORY_ADJUST: 'inventory:adjust',

  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_UPDATE: 'suppliers:update',
  SUPPLIERS_DELETE: 'suppliers:delete',

  PURCHASES_READ: 'purchases:read',
  PURCHASES_CREATE: 'purchases:create',
  PURCHASES_UPDATE: 'purchases:update', // receive, cancel, record payments

  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',

  SALES_CREATE: 'sales:create',
  SALES_READ_ALL: 'sales:read_all',
  SALES_READ_OWN: 'sales:read_own',

  RETURNS_READ: 'returns:read',
  RETURNS_CREATE: 'returns:create',

  REPORTS_VIEW: 'reports:view',

  DASHBOARD_VIEW_ALL: 'dashboard:view_all',
  DASHBOARD_VIEW_OWN: 'dashboard:view_own',

  NOTIFICATIONS_READ: 'notifications:read',
  ACTIVITIES_VIEW: 'activities:view',

  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
});

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Things a MANAGER must NOT automatically receive
const ADMIN_ONLY = [
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.ACTIVITIES_VIEW,
  PERMISSIONS.SETTINGS_UPDATE,
];

const SALES_STAFF_PERMISSIONS = [
  PERMISSIONS.PRODUCTS_READ, // search + availability (no cost price)
  PERMISSIONS.CATEGORIES_READ,
  PERMISSIONS.BRANDS_READ,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_CREATE,
  PERMISSIONS.CUSTOMERS_UPDATE, // no delete
  PERMISSIONS.SALES_CREATE,
  PERMISSIONS.SALES_READ_OWN,
  PERMISSIONS.DASHBOARD_VIEW_OWN,
  PERMISSIONS.NOTIFICATIONS_READ,
  PERMISSIONS.SETTINGS_READ, // business info needed to print invoices
];

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.freeze([...ALL_PERMISSIONS]),
  [ROLES.MANAGER]: Object.freeze(ALL_PERMISSIONS.filter((p) => !ADMIN_ONLY.includes(p))),
  [ROLES.SALES_STAFF]: Object.freeze(SALES_STAFF_PERMISSIONS),
});

/** Unknown roles get nothing (default deny). */
const getPermissions = (role) => ROLE_PERMISSIONS[role] || [];

const hasPermission = (role, permission) => getPermissions(role).includes(permission);

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, getPermissions, hasPermission };