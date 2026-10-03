/**
 * Quick self-check of the models against the real database.
 * Creates temporary records, verifies behaviour, then deletes them.
 * Run:  npm run db:smoke
 */
const assert = require('assert');
const mongoose = require('mongoose');
require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Category, Brand, Product, Counter, Setting } = require('../models');
const { ROLES } = require('../config/constants');

const created = { users: [], categories: [], brands: [], products: [] };
const step = (message) => console.log(`✔ ${message}`);

const run = async () => {
  await connectDB();
  await Promise.all([User.init(), Product.init(), Category.init(), Brand.init()]);

  // --- User: password hashing ---
  const email = `smoke-${Date.now()}@test.local`;
  const user = new User({ name: 'Smoke Test', email, password: 'Password123', role: ROLES.ADMIN });
  await user.save();
  created.users.push(user._id);

  const stored = await User.findById(user._id).select('+passwordHash');
  assert.ok(stored.passwordHash, 'password hash should exist');
  assert.notStrictEqual(stored.passwordHash, 'Password123', 'password must not be stored in plain text');
  assert.strictEqual(await stored.comparePassword('Password123'), true);
  assert.strictEqual(await stored.comparePassword('wrong-password'), false);
  assert.strictEqual(user.toJSON().passwordHash, undefined, 'hash must not leak in JSON');
  step('User: password is hashed with bcrypt and never leaks in JSON');

  await assert.rejects(
    () => new User({ name: 'Short Pass', email: `x-${Date.now()}@test.local`, password: '123' }).save(),
    /at least 8 characters/
  );
  step('User: short passwords are rejected');

  await assert.rejects(
    () => new User({ name: 'Duplicate', email, password: 'Password123' }).save(),
    (err) => err.code === 11000
  );
  step('User: duplicate email is rejected');

  // --- Category / Brand / Product ---
  const category = await Category.create({ name: `Smoke Category ${Date.now()}` });
  const brand = await Brand.create({ name: `Smoke Brand ${Date.now()}` });
  created.categories.push(category._id);
  created.brands.push(brand._id);

  await assert.rejects(
    () => Category.create({ name: category.name.toUpperCase() }),
    (err) => err.code === 11000
  );
  step('Category: names are unique case-insensitively');

  const sku = `smk-${Date.now()}`;
  const product = await Product.create({
    name: 'Smoke Product',
    sku,
    barcode: '',
    category: category._id,
    brand: brand._id,
    purchasePrice: 10.456,
    sellingPrice: 15,
    currentStock: 0,
    minStockLevel: 5,
  });
  created.products.push(product._id);

  assert.strictEqual(product.sku, sku.toUpperCase(), 'SKU should be uppercased');
  assert.strictEqual(product.barcode, undefined, 'empty barcode should be stored as undefined');
  assert.strictEqual(product.purchasePrice, 10.46, 'prices should be rounded to 2 decimals');
  assert.strictEqual(product.stockStatus, 'OUT_OF_STOCK');
  product.currentStock = 3;
  assert.strictEqual(product.stockStatus, 'LOW_STOCK');
  product.currentStock = 50;
  assert.strictEqual(product.stockStatus, 'IN_STOCK');
  step('Product: SKU uppercase, price rounding, stockStatus virtual');

  await assert.rejects(
    () => Product.create({ name: 'Dup', sku, category: category._id, purchasePrice: 1, sellingPrice: 2 }),
    (err) => err.code === 11000
  );
  step('Product: duplicate SKU is rejected');

  await assert.rejects(
    () => Product.create({ name: 'Bad', sku: `bad-${Date.now()}`, category: category._id, purchasePrice: -5, sellingPrice: 2 }),
    /cannot be negative/
  );
  await assert.rejects(
    () => Product.create({ name: 'Bad', sku: `bad2-${Date.now()}`, category: category._id, purchasePrice: 1, sellingPrice: 2, currentStock: 1.5 }),
    /whole number/
  );
  step('Product: negative prices and fractional stock are rejected');

  // --- Counter & Setting ---
  const first = await Counter.generateNumber('SMK');
  const second = await Counter.generateNumber('SMK');
  assert.notStrictEqual(first, second);
  assert.match(first, /^SMK-\d{4}-\d{6}$/);
  await Counter.deleteMany({ _id: new RegExp('^SMK-') });
  step(`Counter: sequential numbers (${first} -> ${second})`);

  const settings = await Setting.getSingleton();
  assert.strictEqual(settings.key, 'business');
  step('Setting: singleton document is created with defaults');

  console.log('\nAll model checks passed.');
};

const cleanup = async () => {
  await User.deleteMany({ _id: { $in: created.users } });
  await Product.deleteMany({ _id: { $in: created.products } });
  await Category.deleteMany({ _id: { $in: created.categories } });
  await Brand.deleteMany({ _id: { $in: created.brands } });
};

run()
  .catch((error) => {
    console.error('\n✘ Smoke test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });