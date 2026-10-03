/**
 * Verifies the Phase 4 utilities and (against the real database) that transactions roll back.
 * The API does not need to be running.
 *   npm run core:test
 */
const assert = require('assert');
const mongoose = require('mongoose');
require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { Category } = require('../models');
const { parsePagination, parseSort, buildPaginationMeta } = require('../utils/paginate');
const { escapeRegex, buildSearchFilter, combineFilters } = require('../utils/search');
const { resolveDateRange, toDateFilter, toTimezoneString } = require('../utils/dateRange');
const { sanitizeValue } = require('../middleware/sanitize');
const pick = require('../utils/pick');
const { withTransaction } = require('../utils/transaction');
const {
  objectId,
  idParamSchema,
  listQuerySchema,
  dateRangeKeys,
} = require('../validators/common.validator');

const step = (message) => console.log(`✔ ${message}`);
const iso = (date) => date.toISOString();

const testPagination = () => {
  assert.deepStrictEqual(parsePagination({}), { page: 1, limit: 20, skip: 0 });
  assert.deepStrictEqual(parsePagination({ page: '-3', limit: '500' }), { page: 1, limit: 100, skip: 0 });
  assert.deepStrictEqual(parsePagination({ page: 'abc', limit: 'xyz' }), { page: 1, limit: 20, skip: 0 });
  assert.deepStrictEqual(parsePagination({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 });
  step('Pagination: defaults, clamping of bad values, skip calculation');

  assert.deepStrictEqual(buildPaginationMeta(45, 2, 20), {
    currentPage: 2,
    totalPages: 3,
    totalItems: 45,
    limit: 20,
    hasNextPage: true,
    hasPreviousPage: true,
  });
  assert.strictEqual(buildPaginationMeta(45, 3, 20).hasNextPage, false);
  assert.strictEqual(buildPaginationMeta(45, 1, 20).hasPreviousPage, false);
  const empty = buildPaginationMeta(0, 1, 20);
  assert.strictEqual(empty.totalPages, 1);
  assert.strictEqual(empty.hasNextPage, false);
  step('Pagination: metadata (currentPage, totalPages, totalItems, limit, hasNext/hasPrevious)');

  const allowed = ['name', 'sellingPrice'];
  assert.deepStrictEqual(parseSort({ sortBy: 'name', sortOrder: 'asc' }, { allowed }), { name: 1, _id: 1 });
  assert.deepStrictEqual(parseSort({ sortBy: 'name' }, { allowed }), { name: -1, _id: -1 });
  assert.deepStrictEqual(parseSort({ sortBy: 'passwordHash' }, { allowed }), { createdAt: -1, _id: -1 });
  assert.deepStrictEqual(parseSort({}, { allowed, defaultSort: { name: 1 } }), { name: 1, _id: 1 });
  step('Sorting: only whitelisted fields, stable _id tie-breaker');
};

const testSearch = () => {
  assert.strictEqual(escapeRegex('a.b*c(d)'), 'a\\.b\\*c\\(d\\)');
  const literal = buildSearchFilter('iphone 15 (pro)', ['name', 'sku']);
  assert.strictEqual(literal.$or.length, 2);
  assert.ok(literal.$or[0].name.test('Apple iPhone 15 (Pro) 256GB'));
  assert.ok(!literal.$or[0].name.test('iphone 15 xpro'));
  assert.ok(!buildSearchFilter('.*', ['name']).$or[0].name.test('anything'));
  assert.strictEqual(buildSearchFilter('   ', ['name']), null);
  assert.deepStrictEqual(combineFilters(null, {}, { status: 'ACTIVE' }), { status: 'ACTIVE' });
  assert.deepStrictEqual(combineFilters({ a: 1 }, { b: 2 }), { $and: [{ a: 1 }, { b: 2 }] });
  step('Search: regex characters are escaped, empty search ignored, filters combine');
};

const testDateRange = () => {
  // 2026-10-02 20:43 UTC == 2026-10-03 02:43 in UTC+6 (a Saturday)
  const now = new Date('2026-10-02T20:43:27.317Z');
  const options = { now, offsetMinutes: 360 };

  const today = resolveDateRange({ range: 'today' }, options);
  assert.strictEqual(iso(today.start), '2026-10-02T18:00:00.000Z');
  assert.strictEqual(iso(today.end), '2026-10-03T18:00:00.000Z');

  const yesterday = resolveDateRange({ range: 'yesterday' }, options);
  assert.strictEqual(iso(yesterday.start), '2026-10-01T18:00:00.000Z');
  assert.strictEqual(iso(yesterday.end), '2026-10-02T18:00:00.000Z');

  const week = resolveDateRange({ range: 'this_week' }, options);
  assert.strictEqual(iso(week.start), '2026-09-27T18:00:00.000Z'); // Monday 28 Sep, 00:00 local
  assert.strictEqual(iso(week.end), '2026-10-03T18:00:00.000Z');

  const month = resolveDateRange({ range: 'this_month' }, options);
  assert.strictEqual(iso(month.start), '2026-09-30T18:00:00.000Z'); // 1 Oct, 00:00 local

  const custom = resolveDateRange({ range: 'custom', from: '2026-10-01', to: '2026-10-03' }, options);
  assert.strictEqual(iso(custom.start), '2026-09-30T18:00:00.000Z');
  assert.strictEqual(iso(custom.end), '2026-10-03T18:00:00.000Z'); // whole "to" day is included
  step('Date ranges: today / yesterday / this week / this month / custom follow the UTC+6 business day');

  assert.deepStrictEqual(Object.keys(toDateFilter(today)), ['$gte', '$lt']);
  assert.strictEqual(toTimezoneString(360), '+06:00');
  assert.strictEqual(toTimezoneString(-330), '-05:30');
  step('Date ranges: Mongo filter and timezone string helpers');

  const rejected = (input) => assert.throws(() => resolveDateRange(input, options), (e) => e.statusCode === 400);
  rejected({ range: 'custom', from: '2026-10-05', to: '2026-10-01' });
  rejected({ range: 'custom', from: '2026-02-31', to: '2026-03-01' });
  rejected({ range: 'custom', from: '2026-10-01' });
  rejected({ range: 'custom', from: '2024-01-01', to: '2026-10-01' });
  rejected({ range: 'forever' });
  step('Date ranges: reversed, impossible, incomplete, too-long and unknown ranges are rejected (400)');
};

const testSanitize = () => {
  const body = { email: { $gt: '' }, name: 'ok', 'a.b': 1, nested: { $where: 'x', fine: 2 }, list: [{ $ne: 1, keep: 3 }] };
  sanitizeValue(body);
  assert.deepStrictEqual(body, { email: {}, name: 'ok', nested: { fine: 2 }, list: [{ keep: 3 }] });
  assert.deepStrictEqual(pick({ name: 'x', currentStock: 999, role: 'ADMIN' }, ['name']), { name: 'x' });
  step('Sanitize: $operators and dotted keys are stripped; pick() blocks mass assignment');
};

const testValidators = () => {
  assert.ok(!idParamSchema.validate({ id: '507f1f77bcf86cd799439011' }).error);
  assert.ok(idParamSchema.validate({ id: 'not-an-id' }).error);
  assert.ok(idParamSchema.validate({}).error);
  assert.ok(!objectId.validate('507f1f77bcf86cd799439011').error);

  const listOk = listQuerySchema().validate({ page: '2', limit: '10', search: '  phone  ' });
  assert.ok(!listOk.error);
  assert.strictEqual(listOk.value.page, 2);
  assert.strictEqual(listOk.value.limit, 10);
  assert.strictEqual(listOk.value.search, 'phone');
  assert.strictEqual(listQuerySchema().validate({}).value.limit, 20);
  assert.ok(listQuerySchema().validate({ limit: '500' }).error);
  assert.ok(listQuerySchema().validate({ page: '0' }).error);
  assert.ok(listQuerySchema().validate({ unknownKey: '1' }).error);

  const withDates = listQuerySchema(dateRangeKeys);
  assert.ok(withDates.validate({ range: 'custom' }).error);
  assert.ok(!withDates.validate({ range: 'custom', from: '2026-10-01', to: '2026-10-03' }).error);
  assert.ok(!withDates.validate({ range: 'today' }).error);
  assert.ok(withDates.validate({ range: 'nonsense' }).error);
  step('Validators: ids, pagination (converted + capped), unknown keys, custom date range rules');
};

const testTransactions = async () => {
  await Category.init();
  const name = `Smoke Tx ${Date.now()}`;

  await assert.rejects(
    () =>
      withTransaction(async (session) => {
        await Category.create([{ name }], { session });
        throw new Error('force rollback');
      }),
    /force rollback/
  );
  assert.strictEqual(await Category.countDocuments({ name }), 0);
  step('Transaction: when something fails, every change is rolled back (nothing saved)');

  const committed = await withTransaction(async (session) => {
    const [doc] = await Category.create([{ name }], { session });
    return doc;
  });
  assert.strictEqual(await Category.countDocuments({ name }), 1);
  assert.strictEqual(committed.name, name);
  step('Transaction: when everything succeeds, the changes are committed');
};

const run = async () => {
  testPagination();
  testSearch();
  testDateRange();
  testSanitize();
  testValidators();

  await connectDB();
  await testTransactions();

  console.log('\nAll core utility checks passed.');
};

const cleanup = async () => {
  await Category.deleteMany({ name: /^Smoke Tx / });
};

run()
  .catch((error) => {
    console.error('\n✘ Core test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });