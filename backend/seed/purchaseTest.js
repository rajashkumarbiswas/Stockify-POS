/**
 * End-to-end check of Suppliers and Purchases against the RUNNING API.
 * Start the API first (npm run dev), then:   npm run purchase:test
 */
const assert = require('assert');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Activity, Product, Category, StockMovement, Notification, Supplier, Purchase } = require('../models');
const { ROLES } = require('../config/constants');
const { COOKIE_NAME } = require('../utils/token');

const BASE = `http://localhost:${env.port}/api`;
const PASSWORD = 'Passw0rd123';
const stamp = Date.now();
const tag = `smoke-pur-${stamp}`;
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

const expect = (response, status, label) => {
  const actual = typeof response === 'number' ? response : response.status;
  const reason = response && response.json ? ` (${response.json.message})` : '';
  assert.strictEqual(actual, status, `${label}: expected ${status} but got ${actual}${reason}`);
};

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
  const asManager = { cookie: manager.cookie };

  // ---------- Permissions ----------
  expect(await call('/suppliers'), 401, 'suppliers without token');
  expect(await call('/purchases'), 401, 'purchases without token');
  for (const path of ['/suppliers', '/suppliers/options', '/purchases']) {
    expect(await call(path, { cookie: staff.cookie }), 403, `staff ${path}`);
  }
  expect(await call('/suppliers', { method: 'POST', cookie: staff.cookie, body: { name: 'Hacker Co' } }), 403, 'staff create supplier');
  expect(await call('/purchases', { method: 'POST', cookie: staff.cookie, body: {} }), 403, 'staff create purchase');
  step('Permissions: no token -> 401; sales staff cannot use suppliers or purchases (403)');

  // ---------- Suppliers ----------
  const phone1 = `017${String(stamp).slice(-8)}`;
  const email1 = `${tag}@supplier.test`;
  let r = await call('/suppliers', {
    method: 'POST',
    ...asManager,
    body: { name: `${tag} Supplier`, company: 'Acme Trading', phone: phone1, email: email1, address: 'Dhaka' },
  });
  expect(r, 201, 'create supplier');
  const s1 = r.json.data.id;
  assert.strictEqual(r.json.data.dueAmount, 0);
  assert.strictEqual(r.json.data.totalPurchases, 0);

  expect(await call('/suppliers', { method: 'POST', ...asManager, body: { name: `${tag} Dup`, phone: phone1 } }), 409, 'duplicate phone');
  expect(await call('/suppliers', { method: 'POST', ...asManager, body: { name: `${tag} Dup`, email: email1 } }), 409, 'duplicate email');
  expect(await call('/suppliers', { method: 'POST', ...asManager, body: { name: `${tag} Bad`, email: 'nope' } }), 400, 'bad email');
  expect(await call('/suppliers', { method: 'POST', ...asManager, body: { name: `${tag} Bad`, phone: 'abc' } }), 400, 'bad phone');
  expect(await call('/suppliers', { method: 'POST', ...asManager, body: { name: 'x' } }), 400, 'short name');

  r = await call('/suppliers', { method: 'POST', ...asManager, body: { name: `${tag} Spare` } });
  expect(r, 201, 'create spare supplier');
  const s2 = r.json.data.id;

  expect(await call(`/suppliers/${s1}`, { method: 'PATCH', ...asManager, body: { address: 'Chattogram' } }), 200, 'update supplier');
  expect(await call(`/suppliers/${s1}`, { method: 'PATCH', ...asManager, body: { dueAmount: 5 } }), 400, 'set dueAmount directly');
  expect(await call(`/suppliers/${s1}`, { method: 'PATCH', ...asManager, body: { totalPurchases: 5 } }), 400, 'set totalPurchases directly');

  r = await call(`/suppliers?search=${encodeURIComponent(tag)}&limit=10`, asManager);
  assert.strictEqual(r.json.meta.pagination.totalItems, 2);
  r = await call(`/suppliers?search=${encodeURIComponent(tag)}&status=INACTIVE`, asManager);
  assert.strictEqual(r.json.meta.pagination.totalItems, 0);
  r = await call('/suppliers/options', asManager);
  assert.ok(r.json.data.some((s) => s.id === s1));
  step('Suppliers: create/update/search/options work; duplicate phone/email -> 409; totals cannot be set by the client');

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
        sku: `PUR-${stamp}-${suffix}`,
        category: categoryId,
        purchasePrice: 100,
        sellingPrice: 150,
        minStockLevel: 5,
        ...extra,
      },
    });
    expect(res, 201, `create product ${suffix}`);
    return res.json.data;
  };
  const p1 = await mkProduct('A');
  const p2 = await mkProduct('B', { purchasePrice: 50, sellingPrice: 80 });
  const p3 = await mkProduct('C', { status: 'INACTIVE' });

  const stockOf = async (id) => (await Product.findById(id)).currentStock;
  const costOf = async (id) => (await Product.findById(id)).purchasePrice;
  const supplierNow = async () => (await call(`/suppliers/${s1}`, asManager)).json.data;
  const createPurchase = (body) => call('/purchases', { method: 'POST', ...asManager, body: { supplierId: s1, ...body } });

  // ---------- Purchase A: received immediately ----------
  r = await createPurchase({
    items: [
      { productId: p1.id, quantity: 10, purchasePrice: 90 },
      { productId: p2.id, quantity: 5, purchasePrice: 40 },
    ],
    discount: 20,
    tax: 10,
    notes: 'First delivery',
  });
  expect(r, 201, 'create received purchase');
  const A = r.json.data;
  assert.match(A.invoiceNumber, /^PUR-\d{4}-\d{6}$/);
  assert.strictEqual(A.status, 'RECEIVED');
  assert.strictEqual(A.paymentStatus, 'UNPAID');
  assert.strictEqual(A.items.length, 2);
  assert.strictEqual(A.items[0].lineTotal, 900);
  assert.strictEqual(A.items[1].lineTotal, 200);
  assert.strictEqual(A.subtotal, 1100);
  assert.strictEqual(A.grandTotal, 1090, 'subtotal 1100 - discount 20 + tax 10');
  assert.strictEqual(A.dueAmount, 1090);
  assert.ok(A.receivedAt);
  assert.strictEqual(A.supplier.name, `${tag} Supplier`);
  step('Purchase: invoice number, line totals, subtotal and grand total are calculated by the server (1100 - 20 + 10 = 1090)');

  assert.strictEqual(await stockOf(p1.id), 10);
  assert.strictEqual(await stockOf(p2.id), 5);
  const movements = await StockMovement.find({ referenceId: A.id }).sort({ createdAt: 1 });
  assert.strictEqual(movements.length, 2);
  assert.ok(movements.every((m) => m.type === 'PURCHASE' && m.referenceModel === 'Purchase'));
  assert.strictEqual(movements[0].previousStock, 0);
  assert.strictEqual(movements[0].newStock, 10);
  assert.strictEqual(await costOf(p1.id), 90, 'product cost price becomes the latest purchase price');
  assert.strictEqual(await costOf(p2.id), 40);
  step('Purchase: stock increased (10 and 5), PURCHASE movements recorded, product cost prices updated');

  let supplier = await supplierNow();
  assert.strictEqual(supplier.totalPurchases, 1090);
  assert.strictEqual(supplier.dueAmount, 1090);
  assert.ok(await Notification.exists({ type: 'PURCHASE_COMPLETED', entityId: A.id }));
  assert.ok(await Activity.exists({ action: 'PURCHASE_COMPLETED', entityId: A.id }));
  step('Purchase: supplier totals (1090 / due 1090), notification and activity log created');

  // ---------- Server is the only source of truth ----------
  for (const extra of [{ grandTotal: 1 }, { subtotal: 1 }, { items: [{ productId: p1.id, quantity: 1, purchasePrice: 10, lineTotal: 1 }] }, { currentStock: 99 }]) {
    expect((await createPurchase({ items: [{ productId: p1.id, quantity: 1, purchasePrice: 10 }], ...extra })).status, 400, `client-sent ${Object.keys(extra)[0]}`);
  }
  step('Security: totals, line totals and stock sent by the client are rejected (400)');

  // ---------- Validation: nothing is saved ----------
  const ok = { productId: p1.id, quantity: 1, purchasePrice: 10 };
  const invalid = [
    ['empty items', { items: [] }],
    ['duplicate product', { items: [ok, ok] }],
    ['zero quantity', { items: [{ ...ok, quantity: 0 }] }],
    ['fractional quantity', { items: [{ ...ok, quantity: 1.5 }] }],
    ['negative price', { items: [{ ...ok, purchasePrice: -1 }] }],
    ['discount above subtotal', { items: [ok], discount: 5000 }],
    ['negative tax', { items: [ok], tax: -1 }],
    ['unknown product', { items: [{ ...ok, productId: '507f1f77bcf86cd799439011' }] }],
    ['inactive product', { items: [{ ...ok, productId: p3.id }] }],
    ['payment above total', { items: [ok], payment: { amount: 999 } }],
    ['payment on pending', { items: [ok], status: 'PENDING', payment: { amount: 5 } }],
    ['future date', { items: [ok], purchaseDate: '2999-01-01' }],
    ['status CANCELLED', { items: [ok], status: 'CANCELLED' }],
  ];
  for (const [label, body] of invalid) {
    expect((await createPurchase(body)).status, 400, label);
  }
  expect((await call('/purchases', { method: 'POST', ...asManager, body: { supplierId: '507f1f77bcf86cd799439011', items: [ok] } })).status, 400, 'unknown supplier');
  expect((await call('/purchases', { method: 'POST', ...asManager, body: { items: [ok] } })).status, 400, 'missing supplier');
  assert.strictEqual(await stockOf(p1.id), 10);
  assert.strictEqual(await stockOf(p2.id), 5);
  assert.strictEqual(await Purchase.countDocuments({ supplier: s1 }), 1);
  step('Validation: 15 invalid requests all fail with 400 and leave stock and purchases untouched');

  // ---------- Payments on A ----------
  const pay = (id, body, who = manager) => call(`/purchases/${id}/payments`, { method: 'POST', cookie: who.cookie, body });

  expect(await pay(A.id, { amount: 100 }, staff), 403, 'staff payment');
  expect(await pay(A.id, { amount: 0 }), 400, 'zero payment');
  expect(await pay(A.id, { amount: -5 }), 400, 'negative payment');
  expect(await pay(A.id, { amount: 500, method: 'CRYPTO' }), 400, 'bad method');

  r = await pay(A.id, { amount: 500, method: 'BANK_TRANSFER', note: 'First instalment' });
  expect(r, 201, 'partial payment');
  assert.strictEqual(r.json.data.paidAmount, 500);
  assert.strictEqual(r.json.data.paymentStatus, 'PARTIAL');
  assert.strictEqual(r.json.data.dueAmount, 590);
  assert.strictEqual((await supplierNow()).dueAmount, 590);

  r = await pay(A.id, { amount: 600 });
  expect(r, 400, 'overpayment');
  assert.match(r.json.message, /exceeds the amount due/);

  r = await pay(A.id, { amount: 590 });
  expect(r, 201, 'final payment');
  assert.strictEqual(r.json.data.paymentStatus, 'PAID');
  assert.strictEqual(r.json.data.dueAmount, 0);
  assert.strictEqual((await supplierNow()).dueAmount, 0);

  expect(await pay(A.id, { amount: 1 }), 400, 'payment on a paid purchase');
  step('Payments: partial -> PARTIAL (due 590), overpayment rejected, final payment -> PAID, supplier due follows');

  r = await call(`/suppliers/${s1}/payments`, asManager);
  expect(r, 200, 'payment history');
  assert.strictEqual(r.json.meta.pagination.totalItems, 2);
  assert.strictEqual(r.json.data[0].amount, 590, 'newest first');
  assert.strictEqual(r.json.data[0].invoiceNumber, A.invoiceNumber);
  assert.ok(r.json.data[0].recordedBy.startsWith('Smoke'));
  assert.strictEqual(r.json.data[1].method, 'BANK_TRANSFER');
  step('Supplier payment history lists both payments, newest first, with invoice and who recorded them');

  // ---------- Purchase B: parallel payments cannot overpay ----------
  r = await createPurchase({ items: [{ productId: p1.id, quantity: 2, purchasePrice: 100 }] });
  expect(r, 201, 'purchase B');
  const B = r.json.data;
  assert.strictEqual(B.grandTotal, 200);
  assert.strictEqual(await stockOf(p1.id), 12);

  const parallelPayments = await Promise.all([1, 2, 3].map(() => pay(B.id, { amount: 100 })));
  const paymentStatuses = parallelPayments.map((x) => x.status).sort();
  assert.deepStrictEqual(paymentStatuses, [201, 201, 400], `statuses: ${paymentStatuses}`);
  const bNow = await Purchase.findById(B.id);
  assert.strictEqual(bNow.paidAmount, 200);
  assert.strictEqual(bNow.payments.length, 2);
  assert.strictEqual(bNow.paymentStatus, 'PAID');
  step('Concurrency: 3 simultaneous payments of 100 on a 200 invoice -> exactly 2 succeed, paid never exceeds the total');

  // ---------- Purchase C: pending order, then receive ----------
  r = await createPurchase({ status: 'PENDING', items: [{ productId: p1.id, quantity: 4, purchasePrice: 95 }] });
  expect(r, 201, 'pending purchase');
  const C = r.json.data;
  assert.strictEqual(C.status, 'PENDING');
  assert.strictEqual(C.receivedAt, undefined);
  assert.strictEqual(await stockOf(p1.id), 12, 'pending purchase must not change stock');
  assert.strictEqual(await StockMovement.countDocuments({ referenceId: C.id }), 0);
  supplier = await supplierNow();
  assert.strictEqual(supplier.totalPurchases, 1290);
  assert.strictEqual(supplier.dueAmount, 0);
  assert.strictEqual(supplier.stats.pendingCount, 1);
  expect(await pay(C.id, { amount: 10 }), 400, 'payment on pending purchase');
  step('Pending order: no stock, movement or supplier total changes; payments are refused');

  const receiveCall = (id, who = manager) => call(`/purchases/${id}/receive`, { method: 'PATCH', cookie: who.cookie });
  expect(await receiveCall(C.id, staff), 403, 'staff receive');
  const doubleReceive = await Promise.all([receiveCall(C.id), receiveCall(C.id)]);
  assert.deepStrictEqual(doubleReceive.map((x) => x.status).sort(), [200, 409]);
  assert.strictEqual(await stockOf(p1.id), 16, 'stock must increase only once (12 + 4)');
  assert.strictEqual(await costOf(p1.id), 95);
  assert.strictEqual(await StockMovement.countDocuments({ referenceId: C.id }), 1);
  supplier = await supplierNow();
  assert.strictEqual(supplier.totalPurchases, 1670);
  assert.strictEqual(supplier.dueAmount, 380);
  assert.strictEqual(supplier.stats.pendingCount, 0);
  step('Receive: two simultaneous requests -> one succeeds, one gets 409, stock rises once (12 -> 16), supplier due 380');

  expect(await receiveCall(C.id), 409, 'receive again');
  expect((await call(`/purchases/${C.id}/cancel`, { method: 'PATCH', ...asManager })).status, 409, 'cancel received purchase');
  step('A received purchase cannot be received again or cancelled (409)');

  // ---------- Purchase D: initial payment ----------
  r = await createPurchase({
    items: [{ productId: p2.id, quantity: 3, purchasePrice: 45 }],
    payment: { amount: 100, method: 'MOBILE_BANKING', note: 'Paid on delivery' },
  });
  expect(r, 201, 'purchase with payment');
  const D = r.json.data;
  assert.strictEqual(D.grandTotal, 135);
  assert.strictEqual(D.paidAmount, 100);
  assert.strictEqual(D.paymentStatus, 'PARTIAL');
  assert.strictEqual(D.payments.length, 1);
  assert.strictEqual(D.payments[0].method, 'MOBILE_BANKING');
  assert.strictEqual(await stockOf(p2.id), 8);
  supplier = await supplierNow();
  assert.strictEqual(supplier.totalPurchases, 1805);
  assert.strictEqual(supplier.dueAmount, 415);
  step('Initial payment: 100 of 135 paid at creation -> PARTIAL, supplier due 380 + 35 = 415');

  // ---------- Purchase E: cancel ----------
  r = await createPurchase({ status: 'PENDING', items: [{ productId: p2.id, quantity: 1, purchasePrice: 10 }] });
  const E = r.json.data;
  expect((await call(`/purchases/${E.id}/cancel`, { method: 'PATCH', cookie: staff.cookie })).status, 403, 'staff cancel');
  r = await call(`/purchases/${E.id}/cancel`, { method: 'PATCH', ...asManager });
  expect(r, 200, 'cancel pending');
  assert.strictEqual(r.json.data.status, 'CANCELLED');
  assert.strictEqual(await stockOf(p2.id), 8);
  expect(await receiveCall(E.id), 409, 'receive cancelled');
  expect((await call(`/purchases/${E.id}/cancel`, { method: 'PATCH', ...asManager })).status, 409, 'cancel twice');
  assert.strictEqual((await supplierNow()).totalPurchases, 1805);
  step('Cancel: a pending purchase can be cancelled once; it can no longer be received; nothing else changes');

  // ---------- Lists, filters, search ----------
  const list = async (qs) => (await call(`/purchases?supplier=${s1}&${qs}`, asManager)).json;
  let body = await list('limit=2&page=1&sortBy=grandTotal&sortOrder=desc');
  assert.deepStrictEqual(body.meta.pagination, {
    currentPage: 1, totalPages: 3, totalItems: 5, limit: 2, hasNextPage: true, hasPreviousPage: false,
  });
  assert.strictEqual(body.data[0].grandTotal, 1090);
  assert.ok(body.data[0].supplier.name.includes(tag));
  assert.strictEqual((await list('status=CANCELLED')).meta.pagination.totalItems, 1);
  assert.strictEqual((await list('status=RECEIVED')).meta.pagination.totalItems, 4);
  assert.strictEqual((await list('status=PENDING')).meta.pagination.totalItems, 0);
  assert.strictEqual((await list('paymentStatus=PAID')).meta.pagination.totalItems, 2);
  assert.strictEqual((await list('paymentStatus=PARTIAL')).meta.pagination.totalItems, 1);
  assert.strictEqual((await list('paymentStatus=UNPAID')).meta.pagination.totalItems, 2);
  assert.strictEqual((await list('range=today')).meta.pagination.totalItems, 5);
  assert.strictEqual((await list('range=custom&from=2000-01-01&to=2000-01-02')).meta.pagination.totalItems, 0);
  assert.strictEqual((await list(`search=${encodeURIComponent(A.invoiceNumber)}`)).meta.pagination.totalItems, 1);
  assert.strictEqual((await call(`/purchases?search=${encodeURIComponent(tag)}&limit=50`, asManager)).json.meta.pagination.totalItems, 5, 'search by supplier name');
  expect(await call('/purchases?status=NOPE', asManager), 400, 'bad status filter');
  expect(await call('/purchases?range=custom', asManager), 400, 'custom range without dates');
  step('Purchase list: pagination, sorting, status/payment/date filters and search by invoice or supplier name');

  r = await call(`/suppliers/${s1}/purchases?limit=2`, asManager);
  assert.strictEqual(r.json.meta.pagination.totalItems, 5);
  expect(await call('/suppliers/507f1f77bcf86cd799439011/purchases', asManager), 404, 'unknown supplier history');

  r = await call(`/purchases/${A.id}`, asManager);
  expect(r, 200, 'purchase details');
  assert.strictEqual(r.json.data.payments.length, 2);
  assert.ok(r.json.data.payments[0].recordedBy.name.startsWith('Smoke'));
  assert.strictEqual(r.json.data.createdBy.name, 'Smoke manager');
  expect(await call('/purchases/not-an-id', asManager), 400, 'invalid purchase id');
  expect(await call('/purchases/507f1f77bcf86cd799439011', asManager), 404, 'unknown purchase');
  step('Supplier purchase history and purchase details (items, payments, who created / recorded) work');

  supplier = await supplierNow();
  assert.strictEqual(supplier.stats.purchaseCount, 5);
  assert.ok(supplier.stats.lastPurchaseAt);

  // ---------- Delete rules ----------
  expect(await call(`/suppliers/${s1}`, { method: 'DELETE', ...asManager }), 409, 'delete supplier with purchases');
  expect(await call(`/suppliers/${s2}`, { method: 'DELETE', cookie: staff.cookie }), 403, 'staff delete supplier');
  expect(await call(`/suppliers/${s2}`, { method: 'DELETE', ...asManager }), 200, 'delete unused supplier');
  expect(await call(`/suppliers/${s2}`, asManager), 404, 'deleted supplier is gone');
  expect(await call(`/suppliers/${s1}`, { method: 'PATCH', ...asManager, body: { status: 'INACTIVE' } }), 200, 'deactivate supplier');
  r = await createPurchase({ items: [ok] });
  expect(r, 400, 'purchase from inactive supplier');
  step('Delete rules: a supplier with purchases cannot be deleted; unused one can; inactive suppliers cannot receive new purchases');

  console.log('\nAll supplier and purchase checks passed.');
};

const cleanup = async () => {
  const nameTag = new RegExp(tag);
  const products = await Product.find({ name: nameTag }).select('_id');
  const productIds = products.map((p) => p._id);
  const purchases = await Purchase.find({ createdBy: { $in: createdUserIds } }).select('_id');
  const purchaseIds = purchases.map((p) => p._id);

  await StockMovement.deleteMany({ product: { $in: productIds } });
  await Notification.deleteMany({ entityId: { $in: [...productIds, ...purchaseIds] } });
  await Purchase.deleteMany({ _id: { $in: purchaseIds } });
  await Supplier.deleteMany({ name: nameTag });
  await Product.deleteMany({ _id: { $in: productIds } });
  await Category.deleteMany({ name: nameTag });
  await Activity.deleteMany({ $or: [{ user: { $in: createdUserIds } }, { description: nameTag }] });
  await User.deleteMany({ _id: { $in: createdUserIds } });
};

run()
  .catch((error) => {
    console.error('\n✘ Purchase test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });