const { Sale, Product, Purchase, Supplier } = require('../models');
const env = require('../config/env');
const { round2 } = require('../utils/money');
const { DAY_MS, resolveDateRange, toDateFilter, toTimezoneString } = require('../utils/dateRange');
const { PURCHASE_STATUS, RECORD_STATUS } = require('../config/constants');

const DEFAULT_RANGE = 'this_month';
const LIST_LIMIT = 10;
const STOCK_LIST_LIMIT = 20;

// Stock conditions evaluated by MongoDB itself
const LOW_EXPR = { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minStockLevel'] }] };

// Sales minus refunds; item quantity minus returned quantity
const NET_SALE = { $subtract: ['$grandTotal', '$totalRefunded'] };
const NET_QTY = { $subtract: ['$items.quantity', { $ifNull: ['$items.returnedQuantity', 0] }] };

const resolveRange = (query) =>
  resolveDateRange({ range: query.range || DEFAULT_RANGE, from: query.from, to: query.to });

const periodOf = ({ range, start, end }) => ({ range, start, end });

/** Every business day inside the range as "YYYY-MM-DD" (so days without sales still show as 0). */
const dayKeys = ({ start, end }) => {
  const offsetMs = env.businessUtcOffsetMinutes * 60000;
  const count = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  return Array.from({ length: count }, (_, i) =>
    new Date(start.getTime() + offsetMs + i * DAY_MS).toISOString().slice(0, 10)
  );
};

/** ---------- Sales report ---------- */
const getSalesReport = async (query) => {
  const period = resolveRange(query);
  const match = { createdAt: toDateFilter(period) };

  const [totalRows, dailyRows, methodRows] = await Promise.all([
    Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalOrders: { $sum: 1 },
          totalDiscount: { $sum: '$discount.amount' },
          totalTax: { $sum: '$taxAmount' },
          totalRefunded: { $sum: '$totalRefunded' },
        },
      },
    ]),
    Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: toTimezoneString() } },
          total: { $sum: NET_SALE },
          count: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      { $match: match },
      { $group: { _id: '$paymentMethod', total: { $sum: NET_SALE }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const row = totalRows[0] || {};
  const totalSales = round2(row.totalSales || 0);
  const totalOrders = row.totalOrders || 0;
  const totalRefunded = round2(row.totalRefunded || 0);

  const byDay = new Map(dailyRows.map((item) => [item._id, item]));
  const daily = dayKeys(period).map((date) => ({
    date,
    total: round2(Math.max(0, byDay.get(date)?.total || 0)),
    count: byDay.get(date)?.count || 0,
  }));

  return {
    period: periodOf(period),
    summary: {
      totalSales,
      totalOrders,
      totalDiscount: round2(row.totalDiscount || 0),
      totalTax: round2(row.totalTax || 0),
      totalRefunded,
      netRevenue: round2(Math.max(0, totalSales - totalRefunded)),
      averageOrder: totalOrders > 0 ? round2(totalSales / totalOrders) : 0,
    },
    daily,
    byPaymentMethod: methodRows.map((item) => ({
      method: item._id,
      count: item.count,
      total: round2(Math.max(0, item.total)),
    })),
  };
};

/** ---------- Product report ---------- */
const getProductReport = async (query) => {
  const period = resolveRange(query);
  const active = { status: RECORD_STATUS.ACTIVE };

  const [soldRows, lowStock, outOfStock, lowCount, outCount] = await Promise.all([
    Sale.aggregate([
      { $match: { createdAt: toDateFilter(period) } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          sku: { $first: '$items.sku' },
          quantity: { $sum: NET_QTY },
          revenue: { $sum: { $multiply: ['$items.lineTotal', { $divide: [NET_QTY, '$items.quantity'] }] } },
        },
      },
      { $match: { quantity: { $gt: 0 } } },
      {
        $facet: {
          bestSelling: [{ $sort: { quantity: -1, revenue: -1 } }, { $limit: LIST_LIMIT }],
          highestRevenue: [{ $sort: { revenue: -1, quantity: -1 } }, { $limit: LIST_LIMIT }],
        },
      },
    ]),
    Product.find({ ...active, $expr: LOW_EXPR })
      .sort({ currentStock: 1, name: 1 })
      .limit(STOCK_LIST_LIMIT)
      .select('name sku currentStock minStockLevel unit')
      .lean(),
    Product.find({ ...active, currentStock: { $lte: 0 } })
      .sort({ name: 1 })
      .limit(STOCK_LIST_LIMIT)
      .select('name sku currentStock minStockLevel unit')
      .lean(),
    Product.countDocuments({ ...active, $expr: LOW_EXPR }),
    Product.countDocuments({ ...active, currentStock: { $lte: 0 } }),
  ]);

  const sold = soldRows[0] || { bestSelling: [], highestRevenue: [] };
  const toSold = (item) => ({
    id: String(item._id),
    name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    revenue: round2(item.revenue),
  });
  const toStock = ({ _id, ...rest }) => ({ id: String(_id), ...rest });

  return {
    period: periodOf(period),
    bestSelling: sold.bestSelling.map(toSold),
    highestRevenue: sold.highestRevenue.map(toSold),
    lowStock: { count: lowCount, items: lowStock.map(toStock) },
    outOfStock: { count: outCount, items: outOfStock.map(toStock) },
  };
};

/** ---------- Purchase report (received purchases only) ---------- */
const getPurchaseReport = async (query) => {
  const period = resolveRange(query);
  const dateFilter = toDateFilter(period);
  const match = { status: PURCHASE_STATUS.RECEIVED, purchaseDate: dateFilter };

  const [totalRows, supplierRows, pendingOrders] = await Promise.all([
    Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          cost: { $sum: '$grandTotal' },
          paid: { $sum: '$paidAmount' },
          discount: { $sum: '$discount' },
          tax: { $sum: '$tax' },
        },
      },
    ]),
    Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$supplier',
          count: { $sum: 1 },
          total: { $sum: '$grandTotal' },
          paid: { $sum: '$paidAmount' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]),
    Purchase.countDocuments({ status: PURCHASE_STATUS.PENDING, purchaseDate: dateFilter }),
  ]);

  const suppliers = await Supplier.find({ _id: { $in: supplierRows.map((item) => item._id) } })
    .select('name company')
    .lean();
  const supplierMap = new Map(suppliers.map((item) => [String(item._id), item]));

  const row = totalRows[0] || {};
  const cost = round2(row.cost || 0);
  const paid = round2(row.paid || 0);

  return {
    period: periodOf(period),
    summary: {
      totalPurchases: row.count || 0,
      purchaseCost: cost,
      totalPaid: paid,
      totalDue: round2(Math.max(0, cost - paid)),
      totalDiscount: round2(row.discount || 0),
      totalTax: round2(row.tax || 0),
      pendingOrders,
    },
    suppliers: supplierRows.map((item) => {
      const supplier = supplierMap.get(String(item._id));
      return {
        id: String(item._id),
        name: supplier ? supplier.name : 'Deleted supplier',
        company: supplier?.company || '',
        count: item.count,
        total: round2(item.total),
        paid: round2(item.paid),
        due: round2(Math.max(0, item.total - item.paid)),
      };
    }),
  };
};

module.exports = { getSalesReport, getProductReport, getPurchaseReport };