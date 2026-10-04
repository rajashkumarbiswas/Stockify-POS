/**
 * End-to-end check of Customers and Sales (POS) against the RUNNING API.
 * Start the API first (npm run dev), then:   npm run sales:test
 */
const assert = require('assert');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Activity, Product, Category, StockMovement, Notification, Customer, Sale } = require('../models');
const { ROLES } = require('../config/constants');
const { COOKIE_NAME } = require('../utils/token');
const { round2 } = require('../utils/money');

const BASE = `http://localhost:${env.port}/api`;
const PASSWORD = 'Passw0rd123';
const stamp = Date.now();
const tag = `smoke-sale-${stamp}`;
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
  const staff2 = await makeUser(ROLES.SALES_STAFF, 'staff2');
  const asManager = { cookie: manager.cookie };
  const asStaff = { cookie: staff.cookie };

  // ---------- Permissions ----------
  expect(await call('/customers'), 401, 'customers without token');
  expect(await call('/sales'), 401, 'sales without token');
  expect(await call('/sales', { method: 'POST', ...asStaff, body: {} }), 400, 'empty sale body');
  step('Permissions: no token -> 401; an empty sale is rejected (400)');

  // ---------- Customers ----------
  const phone1 = `018${String(stamp).slice(-8)}`;
  const email1 = `${tag}@shop.example.com`;
  let r = await call('/customers', {
    method: 'POST',
    ...asStaff,
    body: { name: `${tag} Customer`, phone: phone1, email: email1, address: 'Dhaka' },
  });
  expect(r, 201, 'staff creates customer');
  const c1 = r.json.data.id;
  assert.strictEqual(r.json.data.totalSpent, 0);
  assert.strictEqual(r.json.data.totalPurchases, 0);

  expect(await call('/customers', { method: 'POST', ...asStaff, body: { name: `${tag} Dup`, phone: phone1 } }), 409, 'duplicate phone');
  expect(await call('/customers', { method: 'POST', ...asStaff, body: { name: `${tag} Dup`, email: email1 } }), 409, 'duplicate email');
  expect(await call('/customers', { method: 'POST', ...asStaff, body: { name: `${tag} Bad`, email: 'nope' } }), 400, 'bad email');
  expect(await call('/customers', { method: 'POST', ...asStaff, body: { name: `${tag} Bad`, phone: 'abc' } }), 400, 'bad phone');
  expect(await call('/customers', { method: 'POST', ...asStaff, body: { name: 'x' } }), 400, 'short name');
  expect(await call(`/customers/${c1}`, { method: 'PATCH', ...asStaff, body: { totalSpent: 999 } }), 400, 'set totalSpent');
  expect(await call(`/customers/${c1}`, { method: 'PATCH', ...asStaff, body: { dueAmount: 5 } }), 400, 'set dueAmount');
  expect(await call(`/customers/${c1}`, { method: 'PATCH', ...asStaff, body: { address: 'Chattogram' } }), 200, 'staff updates customer');
  expect(await call(`/customers/${c1}`, { method: 'DELETE', ...asStaff }), 403, 'staff deletes customer');

  r = await call(`/customers?search=${encodeURIComponent(tag)}`, asStaff);
  assert.strictEqual(r.json.meta.pagination.totalItems, 1);
  r = await call(`/customers?search=${phone1}`, asStaff);
  assert.strictEqual(r.json.data[0].id, c1, 'search by phone');
  step('Customers: sales staff can create/update/search; duplicates -> 409; totals cannot be set; staff cannot delete (403)');

  // ---------- Products ----------
  r = await call('/categories', { method: 'POST', ...asManager, body: { name: `${tag} Cat` } });
  expect(r, 201, 'create category');
  const categoryId = r.json.data.id;

  const mkProduct = async (suffix, extra = {}) => {
    const res = await call('/products', {
      method: 'POST',
      ...asManager,
      body: {
        name: `${tag} Item ${suffix}`,
        sku: `SAL-${stamp}-${suffix}`,
        category: categoryId,
        purchasePrice: 100,
        sellingPrice: 150,
        minStockLevel: 2,
        ...extra,
      },
    });
    expect(res, 201, `create product ${suffix}`);
    return res.json.data;
  };
  const A = await mkProduct('A');
  const B = await mkProduct('B', { purchasePrice: 50, sellingPrice: 80 });
  const C = await mkProduct('C', { sellingPrice: 100 });
  const D = await mkProduct('D', { status: 'INACTIVE' });

  // Stock comes from the inventory service in real life; here we set it directly for the test
  await Product.updateOne({ _id: A.id }, { currentStock: 10 });
  await Product.updateOne({ _id: B.id }, { currentStock: 5 });
  await Product.updateOne({ _id: C.id }, { currentStock: 1 });
  await Product.updateOne({ _id: D.id }, { currentStock: 5 });

  const stockOf = async (id) => (await Product.findById(id)).currentStock;
  const sell = (body, who = asStaff) => call('/sales', { method: 'POST', ...who, body: { paymentMethod: 'CASH', ...body } });

  // ---------- Sale 1: server calculates everything ----------
  r = await sell({
    customerId: c1,
    items: [
      { productId: A.id, quantity: 2 },
      { productId: B.id, quantity: 1 },
    ],
    discount: { type: 'FIXED', value: 20 },
    notes: 'First sale',
  });
  expect(r, 201, 'create sale');
  const S1 = r.json.data;
  assert.match(S1.invoiceNumber, /^INV-/);
  assert.strictEqual(S1.items.length, 2);
  assert.strictEqual(S1.items[0].unitPrice, 150, 'price comes from the database');
  assert.strictEqual(S1.items[0].lineTotal, 300);
  assert.strictEqual(S1.items[1].lineTotal, 80);
  assert.strictEqual(S1.subtotal, 380);
  assert.strictEqual(S1.discount.amount, 20);
  assert.strictEqual(S1.taxAmount, round2((360 * S1.taxRate) / 100));
  assert.strictEqual(S1.grandTotal, round2(360 + S1.taxAmount));
  assert.strictEqual(S1.amountPaid, S1.grandTotal);
  assert.strictEqual(S1.dueAmount, 0);
  assert.strictEqual(S1.status, 'COMPLETED');
  assert.strictEqual(S1.cashier.name, 'Smoke staff');
  assert.strictEqual(S1.customer.name, `${tag} Customer`);
  step('Sale: invoice number, prices from the database, subtotal, discount and grand total are calculated by the server');

  assert.ok(S1.items.every((i) => !('costPrice' in i)), 'sales staff must never receive the cost price');
  r = await call(`/sales/${S1.id}`, asManager);
  expect(r, 200, 'manager opens the sale');
  assert.strictEqual(r.json.data.items[0].costPrice, 100);
  step('Roles: the cost price is hidden from sales staff and visible to managers');

  assert.strictEqual(await stockOf(A.id), 8);
  assert.strictEqual(await stockOf(B.id), 4);
  const movements = await StockMovement.find({ referenceId: S1.id }).sort({ createdAt: 1 });
  assert.strictEqual(movements.length, 2);
  assert.ok(movements.every((m) => m.type === 'SALE' && m.referenceModel === 'Sale'));
  assert.strictEqual(movements[0].previousStock, 10);
  assert.strictEqual(movements[0].newStock, 8);
  assert.ok(await Notification.exists({ type: 'SALE_COMPLETED', entityId: S1.id }));
  assert.ok(await Activity.exists({ action: 'SALE_COMPLETED', entityId: S1.id }));
  step('Sale: stock decreased (10 -> 8, 5 -> 4), SALE movements recorded, notification and activity log created');

  // ---------- Sale 2: percentage discount ----------
  r = await sell({ customerId: c1, items: [{ productId: A.id, quantity: 1 }], discount: { type: 'PERCENT', value: 10 }, paymentMethod: 'MOBILE_BANKING' });
  expect(r, 201, 'percent discount sale');
  const S2 = r.json.data;
  assert.strictEqual(S2.subtotal, 150);
  assert.strictEqual(S2.discount.amount, 15);
  assert.strictEqual(S2.paymentMethod, 'MOBILE_BANKING');
  assert.strictEqual(await stockOf(A.id), 7);

  const customerNow = await Customer.findById(c1);
  assert.strictEqual(customerNow.totalPurchases, 2);
  assert.strictEqual(customerNow.totalSpent, round2(S1.grandTotal + S2.grandTotal));
  step('Sale: 10% discount = 15 off 150; customer totals follow the real sales (2 sales)');

  // ---------- The server is the only source of truth ----------
  const one = [{ productId: A.id, quantity: 1 }];
  const tampered = [
    ['grandTotal', { items: one, grandTotal: 1 }],
    ['subtotal', { items: one, subtotal: 1 }],
    ['taxAmount', { items: one, taxAmount: 0 }],
    ['amountPaid', { items: one, amountPaid: 1 }],
    ['cashier', { items: one, cashier: manager.user._id }],
    ['unitPrice inside an item', { items: [{ productId: A.id, quantity: 1, unitPrice: 1 }] }],
  ];
  for (const [label, body] of tampered) expect(await sell(body), 400, `client-sent ${label}`);
  step('Security: prices, totals, tax, paid amount and cashier sent by the client are rejected (400)');

  // ---------- Validation: nothing is saved ----------
  const invalid = [
    ['empty items', { items: [] }],
    ['duplicate product', { items: [one[0], one[0]] }],
    ['zero quantity', { items: [{ productId: A.id, quantity: 0 }] }],
    ['fractional quantity', { items: [{ productId: A.id, quantity: 1.5 }] }],
    ['negative discount', { items: one, discount: { type: 'FIXED', value: -5 } }],
    ['percent above 100', { items: one, discount: { type: 'PERCENT', value: 150 } }],
    ['discount above subtotal', { items: one, discount: { type: 'FIXED', value: 5000 } }],
    ['bad payment method', { items: one, paymentMethod: 'CRYPTO' }],
    ['inactive product', { items: [{ productId: D.id, quantity: 1 }] }],
    ['unknown product', { items: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }] }],
    ['unknown customer', { items: one, customerId: '507f1f77bcf86cd799439011' }],
  ];
  for (const [label, body] of invalid) expect(await sell(body), 400, label);
  assert.strictEqual(await stockOf(A.id), 7);
  assert.strictEqual(await stockOf(D.id), 5);
  assert.strictEqual(await Sale.countDocuments({ cashier: staff.user._id }), 2);
  step('Validation: 11 invalid sales all fail with 400 and leave stock and sales untouched');

  // ---------- Not enough stock: the whole sale is rolled back ----------
  r = await sell({ items: [{ productId: B.id, quantity: 1 }, { productId: A.id, quantity: 100 }] });
  expect(r, 400, 'insufficient stock');
  assert.match(r.json.message, /Insufficient stock/);
  assert.strictEqual(await stockOf(A.id), 7);
  assert.strictEqual(await stockOf(B.id), 4, 'the first item must also be rolled back');
  assert.strictEqual(await Sale.countDocuments({ cashier: staff.user._id }), 2);
  step('Insufficient stock: the sale is refused and EVERY item is rolled back (nothing saved)');

  // ---------- Two cashiers, one last item ----------
  const race = await Promise.all([
    sell({ items: [{ productId: C.id, quantity: 1 }] }, asStaff),
    sell({ items: [{ productId: C.id, quantity: 1 }] }, { cookie: staff2.cookie }),
  ]);
  assert.deepStrictEqual(race.map((x) => x.status).sort(), [201, 400], `statuses: ${race.map((x) => x.status)}`);
  assert.strictEqual(await stockOf(C.id), 0);
  assert.strictEqual(await StockMovement.countDocuments({ product: C.id, type: 'SALE' }), 1);
  assert.ok(await Notification.exists({ type: 'OUT_OF_STOCK', entityId: C.id }));
  step('Concurrency: two cashiers sell the last item at once -> exactly one succeeds, stock is 0 (never negative), out-of-stock alert created');

  // ---------- Who can see which sales ----------
  r = await call('/sales?limit=50', { cookie: staff2.cookie });
  expect(r, 200, 'staff2 list');
  assert.ok(r.json.data.every((s) => s.cashier.name === 'Smoke staff2'), 'staff2 sees only their own sales');
  expect(await call(`/sales/${S1.id}`, { cookie: staff2.cookie }), 404, 'staff2 opens another cashier sale');

  r = await call(`/sales?customer=${c1}`, asStaff);
  assert.strictEqual(r.json.meta.pagination.totalItems, 2);
    r = await call(`/sales?cashier=${staff2.user._id}&limit=50`, asStaff);
  assert.strictEqual(r.json.meta.pagination.totalItems, await Sale.countDocuments({ cashier: staff.user._id }));
  assert.ok(r.json.data.every((s) => s.cashier.name === 'Smoke staff'), 'staff cannot widen the view with a cashier filter');
  r = await call(`/sales?customer=${c1}`, asManager);
  assert.strictEqual(r.json.meta.pagination.totalItems, 2);
  step('Roles: sales staff see only their own sales (list and details); managers see everyone\'s');

  // ---------- Lists, filters, search ----------
  r = await call(`/sales?customer=${c1}&limit=1&page=1&sortBy=grandTotal&sortOrder=desc`, asManager);
  assert.deepStrictEqual(r.json.meta.pagination, {
    currentPage: 1, totalPages: 2, totalItems: 2, limit: 1, hasNextPage: true, hasPreviousPage: false,
  });
  assert.strictEqual(r.json.data[0].id, S1.id, 'largest total first');
  assert.strictEqual((await call(`/sales?customer=${c1}&paymentMethod=CASH`, asManager)).json.meta.pagination.totalItems, 1);
  assert.strictEqual((await call(`/sales?customer=${c1}&paymentMethod=MOBILE_BANKING`, asManager)).json.meta.pagination.totalItems, 1);
  assert.strictEqual((await call(`/sales?customer=${c1}&range=today`, asManager)).json.meta.pagination.totalItems, 2);
  assert.strictEqual((await call(`/sales?customer=${c1}&range=custom&from=2000-01-01&to=2000-01-02`, asManager)).json.meta.pagination.totalItems, 0);
  assert.strictEqual((await call(`/sales?search=${encodeURIComponent(S1.invoiceNumber)}`, asManager)).json.meta.pagination.totalItems, 1);
  assert.strictEqual((await call(`/sales?search=${encodeURIComponent(tag)}`, asManager)).json.meta.pagination.totalItems, 2, 'search by customer name');
  expect(await call('/sales?paymentMethod=NOPE', asManager), 400, 'bad filter');
  expect(await call('/sales/not-an-id', asManager), 400, 'invalid id');
  expect(await call('/sales/507f1f77bcf86cd799439011', asManager), 404, 'unknown sale');
  step('Sales list: pagination, sorting, payment/date filters and search by invoice or customer name');

  r = await call(`/customers/${c1}`, asStaff);
  expect(r, 200, 'customer details');
  assert.strictEqual(r.json.data.stats.saleCount, 2);
  assert.ok(r.json.data.stats.lastSaleAt);
  step('Customer details show the number of sales and the last sale date');

  // ---------- Delete rules ----------
  expect(await call(`/customers/${c1}`, { method: 'DELETE', ...asManager }), 409, 'delete customer with sales');
  r = await call('/customers', { method: 'POST', ...asManager, body: { name: `${tag} Unused` } });
  expect(r, 201, 'create unused customer');
  expect(await call(`/customers/${r.json.data.id}`, { method: 'DELETE', ...asManager }), 200, 'delete unused customer');
  step('Delete rules: a customer with sales cannot be deleted (409); an unused one can');

  console.log('\nAll customer and sales checks passed.');
};

const cleanup = async () => {
  const nameTag = new RegExp(tag);
  const products = await Product.find({ name: nameTag }).select('_id');
  const productIds = products.map((p) => p._id);
  const sales = await Sale.find({ cashier: { $in: createdUserIds } }).select('_id');
  const saleIds = sales.map((s) => s._id);

  await StockMovement.deleteMany({ product: { $in: productIds } });
  await Notification.deleteMany({ entityId: { $in: [...productIds, ...saleIds] } });
  await Sale.deleteMany({ _id: { $in: saleIds } });
  await Customer.deleteMany({ name: nameTag });
  await Product.deleteMany({ _id: { $in: productIds } });
  await Category.deleteMany({ name: nameTag });
  await Activity.deleteMany({ $or: [{ user: { $in: createdUserIds } }, { description: nameTag }] });
  await User.deleteMany({ _id: { $in: createdUserIds } });
};

run()
  .catch((error) => {
    console.error('\n✘ Sales test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });