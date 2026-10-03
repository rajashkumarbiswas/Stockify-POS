/**
 * End-to-end check of Categories, Brands and Products against the RUNNING API.
 * Start the API first (npm run dev), then:   npm run catalog:test
 */
const assert = require('assert');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Activity, Product, Category, Brand, StockMovement } = require('../models');
const { ROLES } = require('../config/constants');
const { COOKIE_NAME } = require('../utils/token');

const BASE = `http://localhost:${env.port}/api`;
const PASSWORD = 'Passw0rd123';
const stamp = Date.now();
const tag = `smoke-cat-${stamp}`;
const createdUserIds = [];

const step = (message) => console.log(`✔ ${message}`);

const call = async (path, { method = 'GET', body, cookie } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
};

const expect = (response, status, label) =>
  assert.strictEqual(
    response.status,
    status,
    `${label}: expected ${status} but got ${response.status} (${response.json && response.json.message})`
  );

const makeUser = async (role, label) => {
  const user = await User.create({
    name: `Smoke ${label}`,
    email: `${tag}-${label}@test.local`,
    password: PASSWORD,
    role,
  });
  createdUserIds.push(user._id);

  const response = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: PASSWORD }),
  });
  const setCookie = response.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return { user, cookie: setCookie.split(';')[0] };
};

const run = async () => {
  try {
    await fetch(`${BASE}/health`);
  } catch {
    throw new Error(`API is not reachable at ${BASE}. Start it first with "npm run dev".`);
  }
  await connectDB();

  const admin = await makeUser(ROLES.ADMIN, 'admin');
  const manager = await makeUser(ROLES.MANAGER, 'manager');
  const staff = await makeUser(ROLES.SALES_STAFF, 'staff');

  expect(await call('/products'), 401, 'products without token');
  step('Products API requires a valid login (401 without a token)');

  // ---------- Categories ----------
  let r = await call('/categories', { method: 'POST', cookie: staff.cookie, body: { name: `${tag} Phones` } });
  expect(r, 403, 'staff create category');
  r = await call('/categories', { method: 'POST', cookie: manager.cookie, body: { name: `${tag} Phones` } });
  expect(r, 201, 'manager create category');
  const categoryId = r.json.data.id;
  assert.strictEqual(r.json.data.productCount, 0);

  r = await call('/categories', { method: 'POST', cookie: manager.cookie, body: { name: `${tag} PHONES` } });
  expect(r, 409, 'duplicate category (different case)');
  step('Categories: sales staff blocked (403), manager can create, duplicate name (any case) -> 409');

  r = await call(`/categories?search=${encodeURIComponent(tag)}`, { cookie: staff.cookie });
  expect(r, 200, 'staff list categories');
  assert.ok(r.json.meta.pagination.totalItems >= 1);
  r = await call('/categories', { method: 'POST', cookie: manager.cookie, body: { name: 'x' } });
  expect(r, 400, 'category name too short');
  step('Categories: list + search work for staff (read only), invalid input -> 400');

  // ---------- Brands ----------
  r = await call('/brands', { method: 'POST', cookie: manager.cookie, body: { name: `${tag} Acme` } });
  expect(r, 201, 'create brand');
  const brandId = r.json.data.id;
  r = await call('/brands', { method: 'POST', cookie: manager.cookie, body: { name: `${tag} acme` } });
  expect(r, 409, 'duplicate brand');
  step('Brands: create and duplicate protection');

  // ---------- Products: create & validation ----------
  const sku1 = `SKU-${stamp}-A`;
  const barcode1 = `${stamp}1`;
  const baseProduct = {
    name: `${tag} Phone A`,
    sku: sku1.toLowerCase(),
    barcode: barcode1,
    category: categoryId,
    brand: brandId,
    purchasePrice: 100.456,
    sellingPrice: 150,
    minStockLevel: 5,
  };

  r = await call('/products', { method: 'POST', cookie: staff.cookie, body: baseProduct });
  expect(r, 403, 'staff create product');

  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: baseProduct });
  expect(r, 201, 'manager create product');
  const p1 = r.json.data;
  assert.strictEqual(p1.sku, sku1.toUpperCase(), 'SKU is uppercased');
  assert.strictEqual(p1.purchasePrice, 100.46, 'price rounded to 2 decimals');
  assert.strictEqual(p1.currentStock, 0, 'new product starts with zero stock');
  assert.strictEqual(p1.stockStatus, 'OUT_OF_STOCK');
  assert.strictEqual(p1.category.name, `${tag} Phones`);
  step('Products: create works, SKU uppercased, price rounded, stock always starts at 0');

  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: { ...baseProduct, sku: `X-${stamp}`, barcode: `${stamp}9`, currentStock: 500 } });
  expect(r, 400, 'create with currentStock');
  r = await call(`/products/${p1.id}`, { method: 'PATCH', cookie: manager.cookie, body: { currentStock: 999 } });
  expect(r, 400, 'update currentStock');
  assert.strictEqual((await Product.findById(p1.id)).currentStock, 0);
  step('Products: the client can NOT set currentStock (create and update both rejected with 400)');

  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: { ...baseProduct, barcode: `${stamp}8` } });
  expect(r, 409, 'duplicate SKU');
  assert.match(r.json.message, /SKU/);
  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: { ...baseProduct, sku: `Y-${stamp}` } });
  expect(r, 409, 'duplicate barcode');
  assert.match(r.json.message, /Barcode/);
  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: { ...baseProduct, sku: `Z-${stamp}`, barcode: `${stamp}7`, sellingPrice: -5 } });
  expect(r, 400, 'negative price');
  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: { ...baseProduct, sku: `W-${stamp}`, barcode: `${stamp}6`, category: '507f1f77bcf86cd799439011' } });
  expect(r, 400, 'unknown category');
  step('Products: duplicate SKU/barcode -> 409 with clear message; negative price and unknown category -> 400');

  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: { ...baseProduct, name: `${tag} Phone B`, sku: `${sku1}-B`, barcode: `${stamp}2`, brand: undefined } });
  expect(r, 201, 'create product B');
  const p2 = r.json.data;
  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: { ...baseProduct, name: `${tag} Phone C`, sku: `${sku1}-C`, barcode: '' } });
  expect(r, 201, 'create product C (no barcode, no extra fields)');
  const p3 = r.json.data;
  assert.strictEqual(p3.barcode, undefined);
  step('Products: brand and barcode are optional');

  // ---------- Roles: cost price & visibility ----------
  r = await call(`/products?search=${encodeURIComponent(tag)}&limit=50`, { cookie: manager.cookie });
  expect(r, 200, 'manager list');
  assert.strictEqual(r.json.data.length, 3);
  assert.ok(r.json.data.every((p) => typeof p.purchasePrice === 'number'));

  r = await call(`/products?search=${encodeURIComponent(tag)}&limit=50`, { cookie: staff.cookie });
  expect(r, 200, 'staff list');
  assert.strictEqual(r.json.data.length, 3);
  assert.ok(r.json.data.every((p) => !('purchasePrice' in p)), 'staff must never receive the cost price');
  step('Roles: manager sees the cost price; sales staff never receives purchasePrice');

  r = await call(`/products/${p3.id}/status`, { method: 'PATCH', cookie: staff.cookie, body: { status: 'INACTIVE' } });
  expect(r, 403, 'staff change status');
  r = await call(`/products/${p3.id}/status`, { method: 'PATCH', cookie: manager.cookie, body: { status: 'INACTIVE' } });
  expect(r, 200, 'manager deactivate');

  r = await call(`/products?search=${encodeURIComponent(tag)}&limit=50`, { cookie: staff.cookie });
  assert.strictEqual(r.json.data.length, 2, 'staff does not see inactive products');
  expect(await call(`/products/${p3.id}`, { cookie: staff.cookie }), 404, 'staff open inactive product');
  expect(await call(`/products/lookup?code=${p3.sku}`, { cookie: staff.cookie }), 404, 'staff lookup inactive');
  r = await call(`/products?search=${encodeURIComponent(tag)}&limit=50`, { cookie: manager.cookie });
  assert.strictEqual(r.json.data.length, 3, 'manager still sees inactive products');
  step('Roles: inactive products are hidden from sales staff (list, details, lookup) but visible to managers');

  // ---------- Pagination, search, sort, filter ----------
  const q = encodeURIComponent(tag);
  r = await call(`/products?search=${q}&limit=2&page=1&sortBy=name&sortOrder=asc`, { cookie: manager.cookie });
  assert.strictEqual(r.json.data.length, 2);
  assert.deepStrictEqual(r.json.meta.pagination, {
    currentPage: 1, totalPages: 2, totalItems: 3, limit: 2, hasNextPage: true, hasPreviousPage: false,
  });
  assert.ok(r.json.data[0].name.endsWith('Phone A'));
  r = await call(`/products?search=${q}&limit=2&page=2&sortBy=name&sortOrder=asc`, { cookie: manager.cookie });
  assert.strictEqual(r.json.data.length, 1);
  assert.strictEqual(r.json.meta.pagination.hasNextPage, false);
  assert.strictEqual(r.json.meta.pagination.hasPreviousPage, true);
  r = await call(`/products?search=${q}&sortBy=name&sortOrder=desc&limit=1`, { cookie: manager.cookie });
  assert.ok(r.json.data[0].name.endsWith('Phone C'));
  expect(await call('/products?limit=500', { cookie: manager.cookie }), 400, 'limit too large');
  step('Pagination: pages, totals, hasNext/hasPrevious and sorting are handled by MongoDB');

  r = await call(`/products?search=${encodeURIComponent('.*')}`, { cookie: manager.cookie });
  assert.strictEqual(r.json.meta.pagination.totalItems, 0, '".*" is searched literally');
  r = await call(`/products?search=${encodeURIComponent(sku1.toLowerCase())}`, { cookie: manager.cookie });
  assert.ok(r.json.data.some((p) => p.id === p1.id), 'search by SKU, any case');
  r = await call(`/products?search=${barcode1}`, { cookie: manager.cookie });
  assert.ok(r.json.data.some((p) => p.id === p1.id), 'search by barcode');
  r = await call(`/products?search=${q}&category=${categoryId}&brand=${brandId}`, { cookie: manager.cookie });
  assert.strictEqual(r.json.meta.pagination.totalItems, 2, 'filter by category and brand (A and C have the brand)');
  step('Search: literal regex characters, SKU, barcode; filters: category and brand');

  // Simulate what the inventory service will do in Phase 6 (direct DB update, not through the API)
  await Product.updateOne({ _id: p1.id }, { currentStock: 50 });
  await Product.updateOne({ _id: p2.id }, { currentStock: 3 });
  const countFor = async (stockStatus) =>
    (await call(`/products?search=${q}&stockStatus=${stockStatus}`, { cookie: manager.cookie })).json.data.map((p) => p.id);
  assert.deepStrictEqual(await countFor('IN_STOCK'), [p1.id]);
  assert.deepStrictEqual(await countFor('LOW_STOCK'), [p2.id]);
  assert.deepStrictEqual(await countFor('OUT_OF_STOCK'), [p3.id]);
  step('Stock status filters (IN_STOCK / LOW_STOCK / OUT_OF_STOCK) match the stockStatus value');

  // ---------- POS lookup ----------
  r = await call(`/products/lookup?code=${sku1.toLowerCase()}`, { cookie: staff.cookie });
  expect(r, 200, 'lookup by SKU');
  assert.strictEqual(r.json.data.id, p1.id);
  assert.ok(!('purchasePrice' in r.json.data));
  r = await call(`/products/lookup?code=${barcode1}`, { cookie: staff.cookie });
  assert.strictEqual(r.json.data.id, p1.id);
  expect(await call('/products/lookup?code=DOES-NOT-EXIST', { cookie: staff.cookie }), 404, 'lookup unknown');
  expect(await call('/products/not-an-id', { cookie: manager.cookie }), 400, 'invalid id');
  step('POS lookup: exact SKU (any case) and barcode work, unknown code -> 404, bad id -> 400');

  // ---------- Update, price history, permissions ----------
  r = await call(`/products/${p1.id}`, { method: 'PATCH', cookie: staff.cookie, body: { sellingPrice: 1 } });
  expect(r, 403, 'staff update');
  expect(await call(`/products/${p1.id}`, { method: 'DELETE', cookie: staff.cookie }), 403, 'staff delete');

  r = await call(`/products/${p1.id}`, { method: 'PATCH', cookie: manager.cookie, body: { sellingPrice: 175, brand: null, barcode: '' } });
  expect(r, 200, 'manager update price');
  assert.strictEqual(r.json.data.sellingPrice, 175);
  assert.strictEqual(r.json.data.brand, undefined, 'brand can be cleared');
  assert.strictEqual(r.json.data.barcode, undefined, 'barcode can be cleared');
  assert.ok(await Activity.exists({ action: 'PRODUCT_PRICE_CHANGED', entityId: p1.id }));
  assert.ok(await Activity.exists({ action: 'PRODUCT_CREATED', entityId: p1.id }));
  step('Update: price change is written to the activity log; optional fields can be cleared; staff blocked');

  // ---------- Delete rules ----------
  expect(await call(`/categories/${categoryId}`, { method: 'DELETE', cookie: manager.cookie }), 409, 'delete used category');
  expect(await call(`/brands/${brandId}`, { method: 'DELETE', cookie: manager.cookie }), 409, 'delete used brand');
  step('Delete: a category/brand that is used by products cannot be deleted (409)');

  await StockMovement.create({
    product: p1.id, type: 'ADJUSTMENT', quantity: 1, previousStock: 49, newStock: 50, reason: `smoke ${tag}`, user: admin.user._id,
  });
  r = await call(`/products/${p1.id}`, { method: 'DELETE', cookie: manager.cookie });
  expect(r, 409, 'delete product with history');
  step('Delete: a product with stock/sales/purchase history cannot be deleted (409)');

  expect(await call(`/products/${p2.id}`, { method: 'DELETE', cookie: manager.cookie }), 200, 'delete p2');
  expect(await call(`/products/${p3.id}`, { method: 'DELETE', cookie: manager.cookie }), 200, 'delete p3');
  expect(await call(`/products/${p2.id}`, { cookie: manager.cookie }), 404, 'p2 gone');

  r = await call('/categories', { method: 'POST', cookie: manager.cookie, body: { name: `${tag} Temp` } });
  expect(await call(`/categories/${r.json.data.id}`, { method: 'DELETE', cookie: manager.cookie }), 200, 'delete unused category');
  step('Delete: unused products and categories are deleted normally');

  console.log('\nAll catalog checks passed.');
};

const cleanup = async () => {
  const nameTag = new RegExp(tag);
  await StockMovement.deleteMany({ reason: nameTag });
  await Product.deleteMany({ name: nameTag });
  await Category.deleteMany({ name: nameTag });
  await Brand.deleteMany({ name: nameTag });
  await Activity.deleteMany({ $or: [{ user: { $in: createdUserIds } }, { description: nameTag }] });
  await User.deleteMany({ _id: { $in: createdUserIds } });
};

run()
  .catch((error) => {
    console.error('\n✘ Catalog test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });