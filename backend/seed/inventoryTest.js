/**
 * End-to-end check of the inventory module against the RUNNING API.
 * Start the API first (npm run dev), then:   npm run inventory:test
 */
const assert = require('assert');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Activity, Product, Category, StockMovement, Notification } = require('../models');
const { ROLES } = require('../config/constants');
const { COOKIE_NAME } = require('../utils/token');
const { withTransaction } = require('../utils/transaction');
const inventoryService = require('../services/inventory.service');

const BASE = `http://localhost:${env.port}/api`;
const PASSWORD = 'Passw0rd123';
const stamp = Date.now();
const tag = `smoke-inv-${stamp}`;
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

  const manager = await makeUser(ROLES.MANAGER, 'manager');
  const staff = await makeUser(ROLES.SALES_STAFF, 'staff');

  let r = await call('/categories', { method: 'POST', cookie: manager.cookie, body: { name: `${tag} Cat` } });
  expect(r, 201, 'create category');
  const categoryId = r.json.data.id;

  const productBody = (suffix, extra = {}) => ({
    name: `${tag} Item ${suffix}`,
    sku: `INV-${stamp}-${suffix}`,
    category: categoryId,
    purchasePrice: 100,
    sellingPrice: 150,
    minStockLevel: 5,
    ...extra,
  });

  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: productBody('A') });
  expect(r, 201, 'create product A');
  const p1 = r.json.data;
  assert.strictEqual(p1.currentStock, 0);

  const adjust = (body, who = manager) =>
    call('/inventory/adjust', { method: 'POST', cookie: who.cookie, body: { productId: p1.id, ...body } });
  const stockOf = async () => (await Product.findById(p1.id)).currentStock;
  const movementCount = () => StockMovement.countDocuments({ product: p1.id });
  const notificationCount = (type) => Notification.countDocuments({ entityId: p1.id, type });

  // ---------- Permissions ----------
  expect(await call('/inventory'), 401, 'inventory without token');
  expect(await call('/inventory', { cookie: staff.cookie }), 403, 'staff list inventory');
  expect(await call('/inventory/summary', { cookie: staff.cookie }), 403, 'staff summary');
  expect(await call('/inventory/movements', { cookie: staff.cookie }), 403, 'staff movements');
  expect(await adjust({ type: 'MANUAL_INCREASE', quantity: 5, reason: 'staff attempt' }, staff), 403, 'staff adjust');
  assert.strictEqual(await stockOf(), 0);
  step('Permissions: no token -> 401; sales staff cannot view inventory or change stock (403)');

  // ---------- Increase ----------
  r = await adjust({ type: 'MANUAL_INCREASE', quantity: 20, reason: 'Initial count' });
  expect(r, 200, 'increase');
  assert.strictEqual(r.json.data.product.currentStock, 20);
  assert.strictEqual(r.json.data.movement.previousStock, 0);
  assert.strictEqual(r.json.data.movement.newStock, 20);
  assert.strictEqual(r.json.data.movement.quantity, 20);
  assert.strictEqual(r.json.data.movement.type, 'MANUAL_INCREASE');
  assert.strictEqual(await stockOf(), 20);
  assert.strictEqual(await movementCount(), 1);
  assert.ok(await Activity.exists({ action: 'STOCK_ADJUSTED', entityId: p1.id }));
  step('Increase: stock 0 -> 20, movement saved (previous 0, new 20), activity logged');

  // ---------- Decrease ----------
  r = await adjust({ type: 'MANUAL_DECREASE', quantity: 5, reason: 'Damaged items' });
  expect(r, 200, 'decrease');
  assert.strictEqual(r.json.data.movement.previousStock, 20);
  assert.strictEqual(r.json.data.movement.newStock, 15);
  assert.strictEqual(await stockOf(), 15);
  assert.strictEqual(await movementCount(), 2);
  step('Decrease: stock 20 -> 15 with the correct previous/new values');

  // ---------- Insufficient stock ----------
  r = await adjust({ type: 'MANUAL_DECREASE', quantity: 100, reason: 'Too many' });
  expect(r, 400, 'insufficient stock');
  assert.match(r.json.message, /Insufficient stock/);
  assert.strictEqual(await stockOf(), 15);
  assert.strictEqual(await movementCount(), 2);
  step('Insufficient stock: request fails (400), stock and movements are untouched');

  // ---------- Validation ----------
  expect(await adjust({ type: 'MANUAL_INCREASE', quantity: 5 }), 400, 'missing reason');
  expect(await adjust({ type: 'MANUAL_INCREASE', quantity: 5, reason: 'ab' }), 400, 'short reason');
  expect(await adjust({ type: 'MANUAL_INCREASE', quantity: 0, reason: 'zero qty' }), 400, 'zero quantity');
  expect(await adjust({ type: 'MANUAL_INCREASE', quantity: 1.5, reason: 'fraction' }), 400, 'fractional quantity');
  expect(await adjust({ type: 'MANUAL_INCREASE', quantity: -3, reason: 'negative' }), 400, 'negative quantity');
  expect(await adjust({ type: 'SALE', quantity: 1, reason: 'fake sale' }), 400, 'SALE is not a manual type');
  expect(await adjust({ type: 'MANUAL_INCREASE', quantity: 1, reason: 'extra field', currentStock: 999 }), 400, 'unknown field');
  expect(
    await call('/inventory/adjust', {
      method: 'POST',
      cookie: manager.cookie,
      body: { productId: '507f1f77bcf86cd799439011', type: 'MANUAL_INCREASE', quantity: 1, reason: 'ghost' },
    }),
    404,
    'unknown product'
  );
  expect(
    await call('/inventory/adjust', {
      method: 'POST',
      cookie: manager.cookie,
      body: { productId: 'nope', type: 'MANUAL_INCREASE', quantity: 1, reason: 'bad id' },
    }),
    400,
    'invalid id'
  );
  assert.strictEqual(await stockOf(), 15);
  step('Validation: missing/short reason, zero, fractional, negative, SALE type, unknown field, bad/unknown product');

  // ---------- Stock take (ADJUSTMENT) + notifications ----------
  r = await adjust({ type: 'ADJUSTMENT', quantity: 3, reason: 'Stock take' });
  expect(r, 200, 'adjustment to 3');
  assert.strictEqual(r.json.data.movement.type, 'ADJUSTMENT');
  assert.strictEqual(r.json.data.movement.quantity, 12, 'quantity is the size of the difference');
  assert.strictEqual(r.json.data.movement.previousStock, 15);
  assert.strictEqual(r.json.data.movement.newStock, 3);
  assert.strictEqual(await notificationCount('LOW_STOCK'), 1);
  step('Stock take: counted 3 (was 15) -> ADJUSTMENT of 12 and one LOW_STOCK notification');

  expect(await adjust({ type: 'ADJUSTMENT', quantity: 3, reason: 'Same again' }), 400, 'adjustment no change');
  r = await adjust({ type: 'ADJUSTMENT', quantity: 2, reason: 'Recount' });
  expect(r, 200, 'adjustment to 2');
  assert.strictEqual(await notificationCount('LOW_STOCK'), 1, 'still low: no second notification');
  step('Notifications: no duplicate alert while the product stays low; "no change" adjustment rejected');

  r = await adjust({ type: 'ADJUSTMENT', quantity: 0, reason: 'Nothing left' });
  expect(r, 200, 'adjustment to 0');
  assert.strictEqual(await notificationCount('OUT_OF_STOCK'), 1);
  const outNotification = await Notification.findOne({ entityId: p1.id, type: 'OUT_OF_STOCK' });
  assert.strictEqual(outNotification.severity, 'DANGER');
  assert.deepStrictEqual([...outNotification.targetRoles].sort(), ['ADMIN', 'MANAGER']);
  step('Notifications: OUT_OF_STOCK (danger) is created for admins and managers');

  r = await adjust({ type: 'MANUAL_INCREASE', quantity: 20, reason: 'Restocked' });
  expect(r, 200, 'restock');
  assert.strictEqual(await notificationCount('OUT_OF_STOCK'), 1, 'restocking creates no alert');
  r = await adjust({ type: 'MANUAL_DECREASE', quantity: 16, reason: 'Big order' });
  expect(r, 200, 'drop to low again');
  assert.strictEqual(await notificationCount('LOW_STOCK'), 2, 'a new LOW alert after recovering and dropping again');
  step('Notifications: restocking is silent; dropping to low again alerts again');

  // ---------- Overselling protection ----------
  assert.strictEqual(await stockOf(), 4);
  const parallel = await Promise.all(
    Array.from({ length: 8 }, () => adjust({ type: 'MANUAL_DECREASE', quantity: 1, reason: `parallel ${tag}` }))
  );
  const statuses = parallel.map((x) => x.status);
  assert.strictEqual(statuses.filter((s) => s === 200).length, 4, `statuses: ${statuses}`);
  assert.strictEqual(statuses.filter((s) => s === 400).length, 4, `statuses: ${statuses}`);
  assert.strictEqual(await stockOf(), 0, 'stock must never go below zero');
  assert.strictEqual(await StockMovement.countDocuments({ product: p1.id, reason: `parallel ${tag}` }), 4);
  assert.strictEqual(await notificationCount('OUT_OF_STOCK'), 2, 'exactly one alert for the move to zero');
  step('Overselling: 8 simultaneous requests for 4 units -> exactly 4 succeed, 4 fail, stock ends at 0');

  // ---------- Transaction rollback (service level) ----------
  await Product.updateOne({ _id: p1.id }, { currentStock: 10 });
  const movementsBefore = await movementCount();
  await assert.rejects(
    () =>
      withTransaction(async (session) => {
        await inventoryService.adjustStock(
          { productId: p1.id, type: 'MANUAL_INCREASE', quantity: 5, reason: `rollback ${tag}`, user: manager.user },
          session
        );
        await inventoryService.adjustStock(
          { productId: p1.id, type: 'MANUAL_DECREASE', quantity: 1000, reason: `rollback ${tag}`, user: manager.user },
          session
        );
      }),
    /Insufficient stock/
  );
  assert.strictEqual(await stockOf(), 10, 'the +5 must be rolled back');
  assert.strictEqual(await movementCount(), movementsBefore, 'the movement of the +5 must be rolled back');
  step('Transaction: when a later step fails, the earlier stock change and its movement are rolled back');

  // ---------- Opening stock ----------
  r = await call('/products', { method: 'POST', cookie: manager.cookie, body: productBody('B', { purchasePrice: 100, openingStock: 12 }) });
  expect(r, 201, 'create with opening stock');
  const p2 = r.json.data;
  assert.strictEqual(p2.currentStock, 12);
  const opening = await StockMovement.findOne({ product: p2.id });
  assert.strictEqual(opening.type, 'MANUAL_INCREASE');
  assert.strictEqual(opening.reason, 'Opening stock');
  assert.strictEqual(opening.previousStock, 0);
  assert.strictEqual(opening.newStock, 12);
  expect(await call('/products', { method: 'POST', cookie: manager.cookie, body: productBody('C', { openingStock: -1 }) }), 400, 'negative opening stock');
  expect(await call('/products', { method: 'POST', cookie: manager.cookie, body: productBody('D', { openingStock: 1.5 }) }), 400, 'fractional opening stock');
  expect(await call(`/products/${p2.id}`, { method: 'PATCH', cookie: manager.cookie, body: { openingStock: 99 } }), 400, 'opening stock on update');
  assert.strictEqual((await Product.findById(p2.id)).currentStock, 12);
  step('Opening stock: product + movement created together; invalid values rejected; cannot be used on update');

  // ---------- Stock list and summary ----------
  const q = encodeURIComponent(tag);
  r = await call(`/inventory?search=${q}&limit=50`, { cookie: manager.cookie });
  expect(r, 200, 'inventory list');
  assert.strictEqual(r.json.meta.pagination.totalItems, 2);
  assert.ok(r.json.data.every((p) => typeof p.purchasePrice === 'number' && p.stockStatus));
  r = await call(`/inventory?search=${q}&stockStatus=IN_STOCK`, { cookie: manager.cookie });
  assert.strictEqual(r.json.meta.pagination.totalItems, 2);
  r = await call(`/inventory?search=${q}&stockStatus=OUT_OF_STOCK`, { cookie: manager.cookie });
  assert.strictEqual(r.json.meta.pagination.totalItems, 0);
  r = await call(`/inventory?search=${q}&sortBy=currentStock&sortOrder=desc&limit=1`, { cookie: manager.cookie });
  assert.strictEqual(r.json.data[0].id, p2.id);
  assert.strictEqual(r.json.meta.pagination.totalPages, 2);
  step('Stock list: search, stock-status filter, sorting and pagination work');

  r = await call('/inventory/summary', { cookie: manager.cookie });
  expect(r, 200, 'summary');
  const s = r.json.data;
  assert.strictEqual(s.inStock + s.lowStock + s.outOfStock, s.totalProducts);
  assert.ok(s.stockValueCost >= 10 * 100 + 12 * 100);
  assert.ok(s.stockValueRetail >= 10 * 150 + 12 * 150);
  step('Summary: counts add up and stock value includes the test products');

  // ---------- Movements list ----------
  const total = await movementCount();
  r = await call(`/inventory/movements?product=${p1.id}&limit=5&page=1`, { cookie: manager.cookie });
  expect(r, 200, 'movements list');
  assert.strictEqual(r.json.meta.pagination.totalItems, total);
  assert.strictEqual(r.json.data.length, 5);
  assert.ok(r.json.data[0].product.name.includes(tag));
  assert.ok(r.json.data[0].user.name.startsWith('Smoke'));
  assert.ok(new Date(r.json.data[0].createdAt) >= new Date(r.json.data[1].createdAt), 'newest first');

  const adjustmentCount = await StockMovement.countDocuments({ product: p1.id, type: 'ADJUSTMENT' });
  r = await call(`/inventory/movements?product=${p1.id}&type=ADJUSTMENT`, { cookie: manager.cookie });
  assert.strictEqual(r.json.meta.pagination.totalItems, adjustmentCount);

  r = await call(`/inventory/movements?product=${p1.id}&range=today`, { cookie: manager.cookie });
  assert.strictEqual(r.json.meta.pagination.totalItems, total);
  r = await call(`/inventory/movements?product=${p1.id}&range=custom&from=2000-01-01&to=2000-01-02`, { cookie: manager.cookie });
  assert.strictEqual(r.json.meta.pagination.totalItems, 0);
  expect(await call(`/inventory/movements?range=custom`, { cookie: manager.cookie }), 400, 'custom without dates');
  expect(await call(`/inventory/movements?type=NOPE`, { cookie: manager.cookie }), 400, 'bad type');
  step('Movements: product/type/date filters, newest first, pagination, details of product and user');

  console.log('\nAll inventory checks passed.');
};

const cleanup = async () => {
  const nameTag = new RegExp(tag);
  const products = await Product.find({ name: nameTag }).select('_id');
  const productIds = products.map((p) => p._id);

  await StockMovement.deleteMany({ product: { $in: productIds } });
  await Notification.deleteMany({ entityId: { $in: productIds } });
  await Product.deleteMany({ _id: { $in: productIds } });
  await Category.deleteMany({ name: nameTag });
  await Activity.deleteMany({ $or: [{ user: { $in: createdUserIds } }, { description: nameTag }] });
  await User.deleteMany({ _id: { $in: createdUserIds } });
};

run()
  .catch((error) => {
    console.error('\n✘ Inventory test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });