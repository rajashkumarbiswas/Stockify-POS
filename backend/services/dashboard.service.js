const { Sale, Product, Customer, Purchase, Activity } = require('../models');
const env = require('../config/env');
const { round2 } = require('../utils/money');
const { DAY_MS, startOfBusinessDay, resolveDateRange, toDateFilter, toTimezoneString } = require('../utils/dateRange');
const { hasPermission, PERMISSIONS: P } = require('../config/permissions');
const { PURCHASE_STATUS, RECORD_STATUS } = require('../config/constants');

const TOP_PRODUCTS_DAYS = 30;
const NET_SALE = { $subtract: ['$grandTotal', '$totalRefunded'] }; // sales minus refunds

// Stock conditions evaluated by MongoDB itself (never in JavaScript)
const LOW_EXPR = { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minStockLevel'] }] };
const OUT_EXPR = { $lte: ['$currentStock', 0] };
const ATTENTION_EXPR = { $lte: ['$currentStock', '$minStockLevel'] };

const toPlain = ({ _id, ...rest }) => ({ id: String(_id), ...rest });

/** Managers/admins see every sale; sales staff only their own. */
const salesScope = (user) => (hasPermission(user.role, P.DASHBOARD_VIEW_ALL) ? {} : { cashier: user._id });

const sumSales = async (match) => {
  const [row] = await Sale.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: NET_SALE }, count: { $sum: 1 } } },
  ]);
  return { total: round2(Math.max(0, row?.total || 0)), count: row?.count || 0 };
};

const getProductStats = async () => {
  const active = { status: RECORD_STATUS.ACTIVE };
  const [total, low, out] = await Promise.all([
    Product.countDocuments(active),
    Product.countDocuments({ ...active, $expr: LOW_EXPR }),
    Product.countDocuments({ ...active, $expr: OUT_EXPR }),
  ]);
  return { total, low, out };
};

const getTopProducts = async (match) => {
  const rows = await Sale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        sku: { $first: '$items.sku' },
        quantity: { $sum: { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] } },
        revenue: { $sum: '$items.lineTotal' },
      },
    },
    { $match: { quantity: { $gt: 0 } } },
    { $sort: { quantity: -1 } },
    { $limit: 5 },
  ]);
  return rows.map((row) => ({
    id: String(row._id),
    name: row.name,
    sku: row.sku,
    quantity: row.quantity,
    revenue: round2(row.revenue),
  }));
};

const getRecentSales = async (scope) => {
  const docs = await Sale.find(scope)
    .sort({ createdAt: -1 })
    .limit(5)
    .select('invoiceNumber customer cashier grandTotal paymentMethod status createdAt')
    .populate('customer', 'name')
    .populate('cashier', 'name')
    .lean();
  return docs.map(toPlain);
};

const getRecentPurchases = async () => {
  const docs = await Purchase.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('invoiceNumber supplier grandTotal status paymentStatus createdAt')
    .populate('supplier', 'name company')
    .lean();
  return docs.map(toPlain);
};

const getLowStockProducts = async () => {
  const docs = await Product.find({ status: RECORD_STATUS.ACTIVE, $expr: ATTENTION_EXPR })
    .sort({ currentStock: 1, name: 1 })
    .limit(6)
    .select('name sku currentStock minStockLevel unit')
    .lean();
  return docs.map((doc) => ({ ...toPlain(doc), stockStatus: doc.currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK' }));
};

const getRecentActivities = async () => {
  const docs = await Activity.find()
    .sort({ createdAt: -1 })
    .limit(6)
    .select('action entity description createdAt user')
    .populate('user', 'name')
    .lean();
  return docs.map(toPlain);
};

/** Everything on the dashboard except the chart. A section the user may not see is null. */
const getSummary = async (user) => {
  const can = (permission) => hasPermission(user.role, permission);
  const scope = salesScope(user);
  const today = resolveDateRange({ range: 'today' });
  const topSince = new Date(startOfBusinessDay(new Date()).getTime() - (TOP_PRODUCTS_DAYS - 1) * DAY_MS);
  const none = Promise.resolve(null);

  const [todaySales, allSales, productStats, customers, pending, topProducts, recentSales, recentPurchases, lowStock, activities] =
    await Promise.all([
      sumSales({ ...scope, createdAt: toDateFilter(today) }),
      sumSales(scope),
      can(P.PRODUCTS_READ) ? getProductStats() : none,
      can(P.CUSTOMERS_READ) ? Customer.countDocuments() : none,
      can(P.PURCHASES_READ) ? Purchase.countDocuments({ status: PURCHASE_STATUS.PENDING }) : none,
      getTopProducts({ ...scope, createdAt: { $gte: topSince } }),
      getRecentSales(scope),
      can(P.PURCHASES_READ) ? getRecentPurchases() : none,
      can(P.PRODUCTS_READ) ? getLowStockProducts() : none,
      can(P.ACTIVITIES_VIEW) ? getRecentActivities() : none,
    ]);

  return {
    scope: hasPermission(user.role, P.DASHBOARD_VIEW_ALL) ? 'all' : 'own',
    stats: {
      todaySales: todaySales.total,
      todayOrders: todaySales.count,
      totalRevenue: allSales.total,
      totalProducts: productStats ? productStats.total : null,
      lowStock: productStats ? productStats.low : null,
      outOfStock: productStats ? productStats.out : null,
      pendingPurchases: pending,
      totalCustomers: customers,
    },
    topProducts,
    recentSales,
    recentPurchases,
    lowStockProducts: lowStock,
    recentActivities: activities,
  };
};

/**
 * Builds the list of chart buckets for a period, plus a function that tells which bucket
 * a "YYYY-MM-DD" business day belongs to. All dates follow the shop's timezone.
 */
const buildBuckets = (period) => {
  const offsetMs = env.businessUtcOffsetMinutes * 60000;
  // Midnight of the business "today", written as if it were UTC (so the calendar date reads correctly)
  const todayLocalMs = startOfBusinessDay(new Date()).getTime() + offsetMs;
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const keys = [];

  if (period === 'weekly') {
    const count = 8;
    const sinceMonday = (new Date(todayLocalMs).getUTCDay() + 6) % 7;
    const first = todayLocalMs - sinceMonday * DAY_MS - (count - 1) * 7 * DAY_MS;
    for (let i = 0; i < count; i += 1) keys.push(isoDay(first + i * 7 * DAY_MS));
    return {
      keys,
      start: new Date(first - offsetMs),
      keyOf: (day) => keys[Math.floor((Date.parse(`${day}T00:00:00Z`) - first) / (7 * DAY_MS))],
    };
  }

  if (period === 'monthly') {
    const count = 6;
    const now = new Date(todayLocalMs);
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    for (let i = count - 1; i >= 0; i -= 1) keys.push(new Date(Date.UTC(year, month - i, 1)).toISOString().slice(0, 7));
    return {
      keys,
      start: new Date(Date.UTC(year, month - (count - 1), 1) - offsetMs),
      keyOf: (day) => day.slice(0, 7),
    };
  }

  const count = 14;
  for (let i = count - 1; i >= 0; i -= 1) keys.push(isoDay(todayLocalMs - i * DAY_MS));
  return {
    keys,
    start: new Date(todayLocalMs - (count - 1) * DAY_MS - offsetMs),
    keyOf: (day) => day,
  };
};

/** Sales (net of refunds) per day, week or month. */
const getSalesChart = async (user, period = 'daily') => {
  const { keys, start, keyOf } = buildBuckets(period);

  const rows = await Sale.aggregate([
    { $match: { ...salesScope(user), createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: toTimezoneString() } },
        total: { $sum: NET_SALE },
        count: { $sum: 1 },
      },
    },
  ]);

  const buckets = new Map(keys.map((key) => [key, { total: 0, count: 0 }]));
  rows.forEach((row) => {
    const bucket = buckets.get(keyOf(row._id));
    if (!bucket) return;
    bucket.total += row.total;
    bucket.count += row.count;
  });

  const result = keys.map((key) => ({
    key,
    total: round2(Math.max(0, buckets.get(key).total)),
    count: buckets.get(key).count,
  }));

  return {
    period,
    buckets: result,
    periodTotal: round2(result.reduce((sum, bucket) => sum + bucket.total, 0)),
    periodCount: result.reduce((sum, bucket) => sum + bucket.count, 0),
  };
};

module.exports = { getSummary, getSalesChart };