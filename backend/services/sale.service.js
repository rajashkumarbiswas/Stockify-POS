const mongoose = require('mongoose');
const { Sale, Customer, Product, Counter, Setting } = require('../models');
const ApiError = require('../utils/ApiError');
const { paginate } = require('../utils/paginate');
const { escapeRegex, buildSearchFilter, combineFilters } = require('../utils/search');
const { resolveDateRange, toDateFilter } = require('../utils/dateRange');
const { withTransaction } = require('../utils/transaction');
const { round2 } = require('../utils/money');
const activityService = require('./activity.service');
const inventoryService = require('./inventory.service');
const notificationService = require('./notification.service');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { ENTITIES, MOVEMENT_TYPES, DISCOUNT_TYPES, SALE_STATUS, RECORD_STATUS } = require('../config/constants');

const POPULATE_LIST = [
  { path: 'customer', select: 'name phone' },
  { path: 'cashier', select: 'name' },
];
const POPULATE_DETAIL = [
  { path: 'customer', select: 'name phone email address' },
  { path: 'cashier', select: 'name' },
];

const canReadAll = (user) => hasPermission(user.role, PERMISSIONS.SALES_READ_ALL);
const canViewCost = (user) => hasPermission(user.role, PERMISSIONS.PRODUCTS_VIEW_COST);

/** Sales staff only ever see their own sales. */
const scopeFilter = (user) => (canReadAll(user) ? null : { cashier: user._id });

/** The cost price of each item is removed for users without the permission. */
const toDto = (doc, user) => {
  const dto = doc.toJSON();
  if (!canViewCost(user)) {
    dto.items = dto.items.map(({ costPrice, ...rest }) => rest); // eslint-disable-line no-unused-vars
  }
  return dto;
};

/** Tax percent from the settings document (the Settings page arrives in a later phase; 0 until then). */
const getTaxRate = async (session) => {
  const setting = await Setting.findOne().session(session).lean();
  const rate = Number(setting?.taxRate);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0;
};

const computeDiscount = (subtotal, input) => {
  if (!input || !input.value) return { type: DISCOUNT_TYPES.FIXED, value: 0, amount: 0 };

  const type = input.type || DISCOUNT_TYPES.FIXED;
  const value = round2(input.value);

  if (type === DISCOUNT_TYPES.PERCENT) {
    if (value > 100) {
      throw ApiError.badRequest('A percentage discount cannot be more than 100', [
        { field: 'discount', message: 'Cannot be more than 100%' },
      ]);
    }
    return { type, value, amount: round2((subtotal * value) / 100) };
  }

  if (value > subtotal) {
    throw ApiError.badRequest('Discount cannot be greater than the subtotal', [
      { field: 'discount', message: 'Discount cannot be greater than the subtotal' },
    ]);
  }
  return { type, value, amount: value };
};

/**
 * Recalculates a customer's totals from the real sales (never by adding up changes),
 * so the numbers can never drift. Runs inside the caller's transaction.
 */
const recalculateCustomerTotals = async (customerId, session) => {
  const id = new mongoose.Types.ObjectId(String(customerId));

  const [row] = await Sale.aggregate([
    { $match: { customer: id } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        spent: { $sum: { $subtract: ['$grandTotal', '$totalRefunded'] } },
        due: { $sum: '$dueAmount' },
      },
    },
  ]).session(session);

  await Customer.updateOne(
    { _id: id },
    {
      $set: {
        totalPurchases: row?.count || 0,
        totalSpent: round2(Math.max(0, row?.spent || 0)),
        dueAmount: round2(Math.max(0, row?.due || 0)),
      },
    },
    { session }
  );
};

const buildSaleSearch = async (search) => {
  const term = String(search ?? '').trim();
  if (!term) return null;

  const regex = new RegExp(escapeRegex(term), 'i');
  const customers = await Customer.find(buildSearchFilter(term, ['name', 'phone']))
    .select('_id')
    .limit(200)
    .lean();

  return { $or: [{ invoiceNumber: regex }, { customer: { $in: customers.map((c) => c._id) } }] };
};

const list = async (query, user) => {
  const filter = combineFilters(
    await buildSaleSearch(query.search),
    query.customer ? { customer: query.customer } : null,
    query.cashier && canReadAll(user) ? { cashier: query.cashier } : null,
    query.paymentMethod ? { paymentMethod: query.paymentMethod } : null,
    query.status ? { status: query.status } : null,
    query.range ? { createdAt: toDateFilter(resolveDateRange(query)) } : null,
    scopeFilter(user)
  );

  const { items, pagination } = await paginate(Sale, filter, {
    query,
    allowedSort: ['createdAt', 'grandTotal', 'invoiceNumber'],
    defaultSort: { createdAt: -1 },
    populate: POPULATE_LIST,
  });

  return { items: items.map((doc) => toDto(doc, user)), pagination };
};

const getById = async (id, user) => {
  const sale = await Sale.findOne({ _id: id, ...scopeFilter(user) }).populate(POPULATE_DETAIL);
  if (!sale) throw ApiError.notFound('Sale not found');
  return toDto(sale, user);
};

/**
 * Completes a sale in ONE transaction: every price, total and discount is calculated here
 * from the database; stock goes down through the inventory service (one SALE movement per item),
 * customer totals are recalculated and managers are notified. If any item lacks stock,
 * the whole sale is rolled back and nothing is saved.
 */
const create = async (data, user) => {
  const productIds = data.items.map((item) => String(item.productId));
  if (new Set(productIds).size !== productIds.length) {
    throw ApiError.badRequest('Each product can appear only once. Increase the quantity instead.', [
      { field: 'items', message: 'Duplicate product' },
    ]);
  }

  const created = await withTransaction(async (session) => {
    let customer = null;
    if (data.customerId) {
      customer = await Customer.findById(data.customerId).select('name').session(session);
      if (!customer) {
        throw ApiError.badRequest('Customer not found', [{ field: 'customerId', message: 'Customer not found' }]);
      }
    }

    const products = await Product.find({ _id: { $in: productIds } }).session(session);
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // Prices come from the database; the client only chooses the product and the quantity
    const items = data.items.map((input) => {
      const product = productMap.get(String(input.productId));
      if (!product) {
        throw ApiError.badRequest('One of the products was not found', [
          { field: 'items', message: 'Product not found' },
        ]);
      }
      if (product.status !== RECORD_STATUS.ACTIVE) {
        throw ApiError.badRequest(`"${product.name}" is inactive and cannot be sold.`, [
          { field: 'items', message: 'Product is inactive' },
        ]);
      }

      return {
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: input.quantity,
        unitPrice: product.sellingPrice,
        costPrice: product.purchasePrice,
        lineTotal: round2(input.quantity * product.sellingPrice),
      };
    });

    const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const discount = computeDiscount(subtotal, data.discount);
    const taxRate = await getTaxRate(session);
    const taxable = round2(subtotal - discount.amount);
    const taxAmount = round2((taxable * taxRate) / 100);
    const grandTotal = round2(taxable + taxAmount);

    const invoiceNumber = await Counter.generateNumber('INV', session);

    const [sale] = await Sale.create(
      [
        {
          invoiceNumber,
          customer: customer ? customer._id : undefined,
          cashier: user._id,
          items,
          subtotal,
          discount,
          taxRate,
          taxAmount,
          grandTotal,
          paymentMethod: data.paymentMethod,
          amountPaid: grandTotal, // full payment at the counter
          dueAmount: 0,
          status: SALE_STATUS.COMPLETED,
          notes: data.notes || undefined,
        },
      ],
      { session }
    );

    // sequential on purpose: a transaction session cannot run operations in parallel
    for (const item of items) {
      await inventoryService.adjustStock(
        {
          productId: item.product,
          type: MOVEMENT_TYPES.SALE,
          quantity: item.quantity,
          reason: `Sale ${invoiceNumber}`,
          user,
          reference: { model: 'Sale', id: sale._id },
        },
        session
      );
    }

    if (customer) await recalculateCustomerTotals(customer._id, session);

    await notificationService.notifySaleCompleted({ sale, user }, session);

    await activityService.log(
      {
        user: user._id,
        action: 'SALE_COMPLETED',
        entity: ENTITIES.SALE,
        entityId: sale._id,
        description:
          `${user.name} completed sale ${invoiceNumber} (${items.length} item(s), total ${grandTotal}, ` +
          `${data.paymentMethod})${customer ? ` for ${customer.name}` : ''}`,
      },
      session
    );

    return sale;
  });

  return getById(created._id, user);
};

module.exports = { list, getById, create };