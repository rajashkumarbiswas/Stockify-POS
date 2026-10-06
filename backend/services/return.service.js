const { Return, Sale, Counter, Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { paginate } = require('../utils/paginate');
const { buildSearchFilter, combineFilters } = require('../utils/search');
const { resolveDateRange, toDateFilter } = require('../utils/dateRange');
const { withTransaction } = require('../utils/transaction');
const { round2 } = require('../utils/money');
const activityService = require('./activity.service');
const inventoryService = require('./inventory.service');
const saleService = require('./sale.service');
const {
  ROLES,
  ENTITIES,
  MOVEMENT_TYPES,
  SALE_STATUS,
  NOTIFICATION_TYPES,
  NOTIFICATION_SEVERITY,
} = require('../config/constants');

const POPULATE = [
  { path: 'customer', select: 'name phone' },
  { path: 'processedBy', select: 'name' },
];

const toDto = (doc) => (typeof doc.toJSON === 'function' ? doc.toJSON() : doc);

const list = async (query) => {
  const filter = combineFilters(
    buildSearchFilter(query.search, ['returnNumber', 'invoiceNumber']),
    query.sale ? { sale: query.sale } : null,
    query.range ? { createdAt: toDateFilter(resolveDateRange(query)) } : null
  );

  const { items, pagination } = await paginate(Return, filter, {
    query,
    allowedSort: ['createdAt', 'refundAmount', 'returnNumber'],
    defaultSort: { createdAt: -1 },
    populate: POPULATE,
  });

  return { items: items.map(toDto), pagination };
};

const getById = async (id) => {
  const doc = await Return.findById(id).populate(POPULATE);
  if (!doc) throw ApiError.notFound('Return not found');
  return toDto(doc);
};

/**
 * Processes a return in ONE transaction:
 *  - the sale and every returned quantity are validated against what was really sold
 *  - the refund is calculated here from the sale (discount share and tax share included)
 *  - stock goes back up through the inventory service (one RETURN movement per item)
 *  - the sale gets its returned quantities, refunded total and new status
 *  - the customer's totals are recalculated, an activity and a notification are written
 * If anything fails, nothing is saved. Two returns for the same sale at the same moment
 * cannot both succeed: the second transaction hits a write conflict and is re-validated.
 */
const create = async (data, user) => {
  const productIds = data.items.map((item) => String(item.productId));
  if (new Set(productIds).size !== productIds.length) {
    throw ApiError.badRequest('Each product can appear only once. Increase the quantity instead.', [
      { field: 'items', message: 'Duplicate product' },
    ]);
  }

  const created = await withTransaction(async (session) => {
    const sale = await Sale.findById(data.saleId).session(session);
    if (!sale) throw ApiError.notFound('Sale not found');
    if (sale.status === SALE_STATUS.RETURNED) {
      throw ApiError.badRequest('Every item of this sale has already been returned.', [
        { field: 'saleId', message: 'Already fully returned' },
      ]);
    }

    const soldLines = new Map(sale.items.map((item) => [String(item.product), item]));
    // Share of the invoice total (after discount, plus tax) that belongs to each unit of an item
    const ratio = sale.subtotal > 0 ? sale.grandTotal / sale.subtotal : 0;
    const refundable = round2(sale.grandTotal - sale.totalRefunded);

    const returnItems = data.items.map((input) => {
      const line = soldLines.get(String(input.productId));
      if (!line) {
        throw ApiError.badRequest('One of the products was not sold on this invoice', [
          { field: 'items', message: 'Product was not sold on this invoice' },
        ]);
      }

      const alreadyReturned = line.returnedQuantity || 0;
      const available = line.quantity - alreadyReturned;
      if (input.quantity > available) {
        throw ApiError.badRequest(
          `Cannot return ${input.quantity} of "${line.name}". Sold: ${line.quantity}, already returned: ${alreadyReturned}, available to return: ${available}.`,
          [{ field: 'items', message: `Only ${available} can be returned` }]
        );
      }

      const lineRefund = round2(input.quantity * line.unitPrice * ratio);
      return {
        product: line.product,
        name: line.name,
        sku: line.sku,
        quantity: input.quantity,
        unitRefund: round2(lineRefund / input.quantity),
        lineRefund,
      };
    });

    // Record the returned quantities on the sale, then see whether everything came back
    const returnedNow = new Map(returnItems.map((item) => [String(item.product), item.quantity]));
    sale.items.forEach((item) => {
      const extra = returnedNow.get(String(item.product));
      if (extra) item.returnedQuantity = (item.returnedQuantity || 0) + extra;
    });
    const fullyReturned = sale.items.every((item) => (item.returnedQuantity || 0) >= item.quantity);

    // Rounding must never refund more than was paid; the final return gets the exact remainder
    let refundAmount = round2(returnItems.reduce((sum, item) => sum + item.lineRefund, 0));
    const target = fullyReturned ? refundable : Math.min(refundAmount, refundable);
    const difference = round2(target - refundAmount);
    if (difference !== 0) {
      const last = returnItems[returnItems.length - 1];
      last.lineRefund = round2(Math.max(0, last.lineRefund + difference));
      last.unitRefund = round2(last.lineRefund / last.quantity);
      refundAmount = round2(returnItems.reduce((sum, item) => sum + item.lineRefund, 0));
    }

    const returnNumber = await Counter.generateNumber('RET', session);

    const [doc] = await Return.create(
      [
        {
          returnNumber,
          sale: sale._id,
          invoiceNumber: sale.invoiceNumber,
          customer: sale.customer || undefined,
          items: returnItems,
          refundAmount,
          refundMethod: data.refundMethod || sale.paymentMethod,
          reason: data.reason || undefined,
          processedBy: user._id,
        },
      ],
      { session }
    );

    // sequential on purpose: a transaction session cannot run operations in parallel
    for (const item of returnItems) {
      await inventoryService.adjustStock(
        {
          productId: item.product,
          type: MOVEMENT_TYPES.RETURN,
          quantity: item.quantity,
          reason: `Return ${returnNumber} for ${sale.invoiceNumber}`,
          user,
          reference: { model: 'Return', id: doc._id },
        },
        session
      );
    }

    sale.totalRefunded = round2(sale.totalRefunded + refundAmount);
    sale.status = fullyReturned ? SALE_STATUS.RETURNED : SALE_STATUS.PARTIALLY_RETURNED;
    await sale.save({ session });

    if (sale.customer) await saleService.recalculateCustomerTotals(sale.customer, session);

    const unitCount = returnItems.reduce((sum, item) => sum + item.quantity, 0);

    await Notification.create(
      [
        {
          type: NOTIFICATION_TYPES.RETURN_PROCESSED,
          severity: NOTIFICATION_SEVERITY.WARNING,
          title: 'Return processed',
          message: `${user.name} processed return ${returnNumber} for invoice ${sale.invoiceNumber} (${unitCount} item(s), refund ${refundAmount}).`,
          targetRoles: [ROLES.ADMIN, ROLES.MANAGER],
          entityModel: 'Return',
          entityId: doc._id,
        },
      ],
      { session }
    );

    await activityService.log(
      {
        user: user._id,
        action: 'RETURN_PROCESSED',
        entity: ENTITIES.RETURN,
        entityId: doc._id,
        description: `${user.name} processed return ${returnNumber} for invoice ${sale.invoiceNumber} (${unitCount} item(s), refund ${refundAmount})`,
      },
      session
    );

    return doc;
  });

  return getById(created._id);
};

module.exports = { list, getById, create };