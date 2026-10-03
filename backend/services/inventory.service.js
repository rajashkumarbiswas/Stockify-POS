const { Product, StockMovement } = require('../models');
const ApiError = require('../utils/ApiError');
const { paginate } = require('../utils/paginate');
const { buildSearchFilter, combineFilters } = require('../utils/search');
const { buildStockStatusFilter } = require('../utils/stock');
const { resolveDateRange, toDateFilter } = require('../utils/dateRange');
const { withTransaction } = require('../utils/transaction');
const { round2 } = require('../utils/money');
const activityService = require('./activity.service');
const notificationService = require('./notification.service');
const { ENTITIES, MOVEMENT_TYPES, RECORD_STATUS } = require('../config/constants');

const INCREASE_TYPES = [MOVEMENT_TYPES.PURCHASE, MOVEMENT_TYPES.MANUAL_INCREASE, MOVEMENT_TYPES.RETURN];
const DECREASE_TYPES = [MOVEMENT_TYPES.SALE, MOVEMENT_TYPES.MANUAL_DECREASE];

const COLLATION = { locale: 'en', strength: 2 };

const assertSession = (session) => {
  if (!session) {
    throw new Error('Stock can only be changed inside a transaction (pass the session).');
  }
};

/** Saves the movement and raises a low-stock notification if needed. Always inside the caller's transaction. */
const recordMovement = async ({ product, previousStock, type, quantity, reason, user, reference }, session) => {
  const [movement] = await StockMovement.create(
    [
      {
        product: product._id,
        type,
        quantity,
        previousStock,
        newStock: product.currentStock,
        reason,
        user: user._id,
        ...(reference ? { referenceModel: reference.model, referenceId: reference.id } : {}),
      },
    ],
    { session }
  );

  await notificationService.notifyStockLevel({ product, previousStock }, session);

  return { product, movement, previousStock, newStock: product.currentStock };
};

/**
 * THE ONLY WAY STOCK GOES UP OR DOWN (except setStock for stock takes).
 *
 *   increases: PURCHASE, MANUAL_INCREASE, RETURN
 *   decreases: SALE, MANUAL_DECREASE
 *
 * Must run inside withTransaction(session). The decrease is conditional in MongoDB itself
 * (currentStock >= quantity), so two cashiers can never sell the same last item.
 * `reference` = { model: 'Sale' | 'Purchase' | 'Return', id } links the movement to its document.
 */
const adjustStock = async ({ productId, type, quantity, reason, user, reference }, session) => {
  assertSession(session);

  const isIncrease = INCREASE_TYPES.includes(type);
  const isDecrease = DECREASE_TYPES.includes(type);
  if (!isIncrease && !isDecrease) {
    throw new Error(`adjustStock does not support movement type "${type}"`);
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw ApiError.badRequest('Quantity must be a whole number greater than zero', [
      { field: 'quantity', message: 'Quantity must be a whole number greater than zero' },
    ]);
  }

  const delta = isIncrease ? quantity : -quantity;
  const filter = isIncrease ? { _id: productId } : { _id: productId, currentStock: { $gte: quantity } };

  const updated = await Product.findOneAndUpdate(
    filter,
    { $inc: { currentStock: delta }, $set: { lastStockUpdateAt: new Date() } },
    { new: true, session }
  );

  if (!updated) {
    const existing = await Product.findById(productId).select('name currentStock').session(session);
    if (!existing) throw ApiError.notFound('Product not found');
    throw ApiError.badRequest(
      `Insufficient stock for "${existing.name}". Available: ${existing.currentStock}, requested: ${quantity}`,
      [{ field: 'quantity', message: 'Insufficient stock' }]
    );
  }

  const previousStock = updated.currentStock - delta;
  return recordMovement({ product: updated, previousStock, type, quantity, reason, user, reference }, session);
};

/**
 * Stock take: the user enters the COUNTED quantity, the backend works out the difference.
 * Recorded as an ADJUSTMENT movement whose quantity is the size of the difference.
 */
const setStock = async ({ productId, targetStock, reason, user }, session) => {
  assertSession(session);

  if (!Number.isInteger(targetStock) || targetStock < 0) {
    throw ApiError.badRequest('Counted quantity must be a whole number (0 or more)', [
      { field: 'quantity', message: 'Counted quantity must be a whole number (0 or more)' },
    ]);
  }

  const product = await Product.findById(productId).session(session);
  if (!product) throw ApiError.notFound('Product not found');

  const previousStock = product.currentStock;
  const delta = targetStock - previousStock;
  if (delta === 0) {
    throw ApiError.badRequest('The counted quantity equals the current stock. Nothing to adjust.', [
      { field: 'quantity', message: 'Same as the current stock' },
    ]);
  }

  const updated = await Product.findOneAndUpdate(
    { _id: productId, currentStock: previousStock },
    { $set: { currentStock: targetStock, lastStockUpdateAt: new Date() } },
    { new: true, session }
  );
  if (!updated) {
    throw ApiError.conflict('Stock was changed by another operation. Please reload and try again.');
  }

  return recordMovement(
    {
      product: updated,
      previousStock,
      type: MOVEMENT_TYPES.ADJUSTMENT,
      quantity: Math.abs(delta),
      reason,
      user,
    },
    session
  );
};

/** API entry point for the Inventory page's "Adjust stock" dialog. */
const adjustManually = async ({ productId, type, quantity, reason }, user) =>
  withTransaction(async (session) => {
    const result =
      type === MOVEMENT_TYPES.ADJUSTMENT
        ? await setStock({ productId, targetStock: quantity, reason, user }, session)
        : await adjustStock({ productId, type, quantity, reason, user }, session);

    const { product, previousStock, newStock } = result;
    await activityService.log(
      {
        user: user._id,
        action: 'STOCK_ADJUSTED',
        entity: ENTITIES.INVENTORY,
        entityId: product._id,
        description: `${user.name} changed stock of "${product.name}" from ${previousStock} to ${newStock} (${reason})`,
        metadata: { type, previousStock, newStock },
      },
      session
    );

    return result;
  });

/** Stock levels table: search, filters, sorting and pagination all happen in MongoDB. */
const listStock = async (query) => {
  const filter = combineFilters(
    buildSearchFilter(query.search, ['name', 'sku', 'barcode']),
    query.category ? { category: query.category } : null,
    query.status ? { status: query.status } : null,
    buildStockStatusFilter(query.stockStatus)
  );

  return paginate(Product, filter, {
    query,
    allowedSort: [
      'name',
      'sku',
      'currentStock',
      'minStockLevel',
      'purchasePrice',
      'sellingPrice',
      'lastStockUpdateAt',
    ],
    defaultSort: { name: 1 },
    populate: [{ path: 'category', select: 'name' }],
    collation: COLLATION,
  });
};

/** Totals for the cards on top of the Inventory page (active products only). */
const getSummary = async () => {
  const [row] = await Product.aggregate([
    { $match: { status: RECORD_STATUS.ACTIVE } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalUnits: { $sum: '$currentStock' },
        outOfStock: { $sum: { $cond: [{ $lte: ['$currentStock', 0] }, 1, 0] } },
        lowStock: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minStockLevel'] }] },
              1,
              0,
            ],
          },
        },
        stockValueCost: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
        stockValueRetail: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
      },
    },
  ]);

  const totalProducts = row?.totalProducts || 0;
  const lowStock = row?.lowStock || 0;
  const outOfStock = row?.outOfStock || 0;

  return {
    totalProducts,
    totalUnits: row?.totalUnits || 0,
    inStock: Math.max(0, totalProducts - lowStock - outOfStock),
    lowStock,
    outOfStock,
    stockValueCost: round2(row?.stockValueCost || 0),
    stockValueRetail: round2(row?.stockValueRetail || 0),
  };
};

/** Full history of stock changes, newest first by default. */
const listMovements = async (query) => {
  const filter = combineFilters(
    query.product ? { product: query.product } : null,
    query.type ? { type: query.type } : null,
    query.range ? { createdAt: toDateFilter(resolveDateRange(query)) } : null
  );

  return paginate(StockMovement, filter, {
    query,
    allowedSort: ['createdAt', 'quantity', 'type'],
    defaultSort: { createdAt: -1 },
    populate: [
      { path: 'product', select: 'name sku unit' },
      { path: 'user', select: 'name' },
    ],
  });
};

module.exports = { adjustStock, setStock, adjustManually, listStock, getSummary, listMovements };