const mongoose = require('mongoose');
const { Purchase, Supplier, Product, Counter } = require('../models');
const ApiError = require('../utils/ApiError');
const { paginate } = require('../utils/paginate');
const { escapeRegex, buildSearchFilter, combineFilters } = require('../utils/search');
const { resolveDateRange, toDateFilter, DAY_MS } = require('../utils/dateRange');
const { withTransaction } = require('../utils/transaction');
const { round2 } = require('../utils/money');
const activityService = require('./activity.service');
const inventoryService = require('./inventory.service');
const notificationService = require('./notification.service');
const {
  ENTITIES,
  MOVEMENT_TYPES,
  PURCHASE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  RECORD_STATUS,
} = require('../config/constants');

const POPULATE_LIST = [
  { path: 'supplier', select: 'name company' },
  { path: 'createdBy', select: 'name' },
];

const POPULATE_DETAIL = [
  { path: 'supplier', select: 'name company phone email address' },
  { path: 'createdBy', select: 'name' },
  { path: 'payments.recordedBy', select: 'name' },
];

const MONEY_TOLERANCE = 0.005;

const paymentStatusFor = (grandTotal, paidAmount) => {
  if (paidAmount >= grandTotal - MONEY_TOLERANCE) return PAYMENT_STATUS.PAID;
  if (paidAmount > 0) return PAYMENT_STATUS.PARTIAL;
  return PAYMENT_STATUS.UNPAID;
};

/**
 * Recalculates a supplier's totals from the real purchases (never by adding up changes),
 * so the numbers can never drift. Runs inside the caller's transaction.
 *   totalPurchases = sum of grandTotal of RECEIVED purchases
 *   dueAmount      = what is still unpaid on those purchases
 */
const recalculateSupplierTotals = async (supplierId, session) => {
  const id = new mongoose.Types.ObjectId(String(supplierId));

  const [row] = await Purchase.aggregate([
    { $match: { supplier: id, status: PURCHASE_STATUS.RECEIVED } },
    { $group: { _id: null, total: { $sum: '$grandTotal' }, paid: { $sum: '$paidAmount' } } },
  ]).session(session);

  const total = round2(row?.total || 0);
  const paid = round2(row?.paid || 0);

  await Supplier.updateOne(
    { _id: id },
    { $set: { totalPurchases: total, dueAmount: round2(Math.max(0, total - paid)) } },
    { session }
  );
};

/**
 * Applies a received purchase: stock goes up through the inventory service (one movement per
 * item), the product's cost price becomes the latest purchase price, supplier totals are
 * recalculated and managers are notified. Must run inside withTransaction.
 */
const applyReceipt = async (purchase, supplierName, user, session) => {
  for (const item of purchase.items) {
    // sequential on purpose: a transaction session cannot run operations in parallel
    await inventoryService.adjustStock(
      {
        productId: item.product,
        type: MOVEMENT_TYPES.PURCHASE,
        quantity: item.quantity,
        reason: `Purchase ${purchase.invoiceNumber}`,
        user,
        reference: { model: 'Purchase', id: purchase._id },
      },
      session
    );

    await Product.updateOne({ _id: item.product }, { $set: { purchasePrice: item.purchasePrice } }, { session });
  }

  await recalculateSupplierTotals(purchase.supplier, session);
  await notificationService.notifyPurchaseCompleted({ purchase, supplierName, user }, session);
};

const buildPurchaseSearch = async (search) => {
  const term = String(search ?? '').trim();
  if (!term) return null;

  const regex = new RegExp(escapeRegex(term), 'i');
  const suppliers = await Supplier.find(buildSearchFilter(term, ['name', 'company']))
    .select('_id')
    .limit(200)
    .lean();

  return { $or: [{ invoiceNumber: regex }, { supplier: { $in: suppliers.map((s) => s._id) } }] };
};

const list = async (query) => {
  const filter = combineFilters(
    await buildPurchaseSearch(query.search),
    query.supplier ? { supplier: query.supplier } : null,
    query.status ? { status: query.status } : null,
    query.paymentStatus ? { paymentStatus: query.paymentStatus } : null,
    query.range ? { purchaseDate: toDateFilter(resolveDateRange(query)) } : null
  );

  return paginate(Purchase, filter, {
    query,
    allowedSort: ['purchaseDate', 'grandTotal', 'paidAmount', 'invoiceNumber', 'createdAt'],
    defaultSort: { purchaseDate: -1 },
    populate: POPULATE_LIST,
  });
};

const getById = async (id) => {
  const purchase = await Purchase.findById(id).populate(POPULATE_DETAIL);
  if (!purchase) throw ApiError.notFound('Purchase not found');
  return purchase;
};

const create = async (data, user) => {
  const status = data.status || PURCHASE_STATUS.RECEIVED;
  const initialPayment = data.payment && round2(data.payment.amount) > 0 ? data.payment : null;

  if (status === PURCHASE_STATUS.PENDING && initialPayment) {
    throw ApiError.badRequest('Payments can only be recorded after the purchase is received', [
      { field: 'payment', message: 'Not allowed for a pending purchase' },
    ]);
  }

  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();
  if (purchaseDate.getTime() > Date.now() + DAY_MS) {
    throw ApiError.badRequest('Purchase date cannot be in the future', [
      { field: 'purchaseDate', message: 'Purchase date cannot be in the future' },
    ]);
  }

  const productIds = data.items.map((item) => String(item.productId));
  if (new Set(productIds).size !== productIds.length) {
    throw ApiError.badRequest('Each product can appear only once. Increase the quantity instead.', [
      { field: 'items', message: 'Duplicate product' },
    ]);
  }

  const created = await withTransaction(async (session) => {
    const supplier = await Supplier.findById(data.supplierId).session(session);
    if (!supplier) {
      throw ApiError.badRequest('Supplier not found', [{ field: 'supplierId', message: 'Supplier not found' }]);
    }
    if (supplier.status !== RECORD_STATUS.ACTIVE) {
      throw ApiError.badRequest('This supplier is inactive. Choose an active supplier.', [
        { field: 'supplierId', message: 'Supplier is inactive' },
      ]);
    }

    const products = await Product.find({ _id: { $in: productIds } }).session(session);
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // The server builds every line from the database; only quantity and unit price come from the client
    const items = data.items.map((input) => {
      const product = productMap.get(String(input.productId));
      if (!product) {
        throw ApiError.badRequest('One of the products was not found', [
          { field: 'items', message: 'Product not found' },
        ]);
      }
      if (product.status !== RECORD_STATUS.ACTIVE) {
        throw ApiError.badRequest(`"${product.name}" is inactive. Activate it before purchasing.`, [
          { field: 'items', message: 'Product is inactive' },
        ]);
      }

      const purchasePrice = round2(input.purchasePrice);
      return {
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: input.quantity,
        purchasePrice,
        lineTotal: round2(input.quantity * purchasePrice),
      };
    });

    const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const discount = round2(data.discount || 0);
    const tax = round2(data.tax || 0);

    if (discount > subtotal) {
      throw ApiError.badRequest('Discount cannot be greater than the subtotal', [
        { field: 'discount', message: 'Discount cannot be greater than the subtotal' },
      ]);
    }

    const grandTotal = round2(subtotal - discount + tax);
    const paidAmount = initialPayment ? round2(initialPayment.amount) : 0;

    if (paidAmount > grandTotal) {
      throw ApiError.badRequest('Payment cannot be more than the grand total', [
        { field: 'payment', message: 'Payment cannot be more than the grand total' },
      ]);
    }

    const invoiceNumber = await Counter.generateNumber('PUR', session);

    const [purchase] = await Purchase.create(
      [
        {
          invoiceNumber,
          supplier: supplier._id,
          purchaseDate,
          items,
          subtotal,
          discount,
          tax,
          grandTotal,
          status,
          paymentStatus: paymentStatusFor(grandTotal, paidAmount),
          paidAmount,
          payments: initialPayment
            ? [
                {
                  amount: paidAmount,
                  method: initialPayment.method || PAYMENT_METHODS.CASH,
                  date: new Date(),
                  note: initialPayment.note || undefined,
                  recordedBy: user._id,
                },
              ]
            : [],
          notes: data.notes || undefined,
          createdBy: user._id,
          receivedAt: status === PURCHASE_STATUS.RECEIVED ? new Date() : undefined,
        },
      ],
      { session }
    );

    if (status === PURCHASE_STATUS.RECEIVED) {
      await applyReceipt(purchase, supplier.name, user, session);
    }

    await activityService.log(
      {
        user: user._id,
        action: status === PURCHASE_STATUS.RECEIVED ? 'PURCHASE_COMPLETED' : 'PURCHASE_CREATED',
        entity: ENTITIES.PURCHASE,
        entityId: purchase._id,
        description:
          `${user.name} ${status === PURCHASE_STATUS.RECEIVED ? 'completed' : 'created'} purchase ` +
          `${invoiceNumber} from ${supplier.name} (${items.length} item(s), total ${grandTotal})`,
      },
      session
    );

    return purchase;
  });

  return getById(created._id);
};

/** PENDING -> RECEIVED. The conditional update makes a double click / double request safe. */
const receive = async (id, user) => {
  await withTransaction(async (session) => {
    const purchase = await Purchase.findOneAndUpdate(
      { _id: id, status: PURCHASE_STATUS.PENDING },
      { $set: { status: PURCHASE_STATUS.RECEIVED, receivedAt: new Date() } },
      { new: true, session }
    );

    if (!purchase) {
      const existing = await Purchase.findById(id).select('status').session(session);
      if (!existing) throw ApiError.notFound('Purchase not found');
      throw ApiError.conflict(
        `This purchase is already ${existing.status.toLowerCase()} and cannot be received again`
      );
    }

    const supplier = await Supplier.findById(purchase.supplier).select('name').session(session);
    const supplierName = supplier ? supplier.name : 'the supplier';

    await applyReceipt(purchase, supplierName, user, session);

    await activityService.log(
      {
        user: user._id,
        action: 'PURCHASE_COMPLETED',
        entity: ENTITIES.PURCHASE,
        entityId: purchase._id,
        description: `${user.name} received purchase ${purchase.invoiceNumber} from ${supplierName} (total ${purchase.grandTotal})`,
      },
      session
    );
  });

  return getById(id);
};

/** Only a PENDING purchase can be cancelled. A received one already added stock. */
const cancel = async (id, user) => {
  await withTransaction(async (session) => {
    const purchase = await Purchase.findOneAndUpdate(
      { _id: id, status: PURCHASE_STATUS.PENDING },
      { $set: { status: PURCHASE_STATUS.CANCELLED } },
      { new: true, session }
    );

    if (!purchase) {
      const existing = await Purchase.findById(id).select('status').session(session);
      if (!existing) throw ApiError.notFound('Purchase not found');
      throw ApiError.conflict(
        existing.status === PURCHASE_STATUS.RECEIVED
          ? 'A received purchase cannot be cancelled because its stock has already been added.'
          : `This purchase is already ${existing.status.toLowerCase()}`
      );
    }

    await activityService.log(
      {
        user: user._id,
        action: 'PURCHASE_CANCELLED',
        entity: ENTITIES.PURCHASE,
        entityId: purchase._id,
        description: `${user.name} cancelled purchase ${purchase.invoiceNumber}`,
      },
      session
    );
  });

  return getById(id);
};

/**
 * Records a payment to the supplier. Reads and writes happen inside one transaction, so two
 * simultaneous payments can never push the paid amount above what is owed (MongoDB detects the
 * conflict and the second request is re-checked against the updated balance).
 */
const addPayment = async (id, data, user) => {
  const amount = round2(data.amount);
  if (amount < 0.01) {
    throw ApiError.badRequest('Payment amount must be at least 0.01', [
      { field: 'amount', message: 'Payment amount must be at least 0.01' },
    ]);
  }

  await withTransaction(async (session) => {
    const purchase = await Purchase.findById(id).session(session);
    if (!purchase) throw ApiError.notFound('Purchase not found');

    if (purchase.status !== PURCHASE_STATUS.RECEIVED) {
      throw ApiError.badRequest('Payments can only be recorded for received purchases', [
        { field: 'amount', message: 'Purchase is not received' },
      ]);
    }

    const due = round2(purchase.grandTotal - purchase.paidAmount);
    if (due <= 0) {
      throw ApiError.badRequest('This purchase is already fully paid', [
        { field: 'amount', message: 'Already fully paid' },
      ]);
    }
    if (amount > due + MONEY_TOLERANCE) {
      throw ApiError.badRequest(`Payment exceeds the amount due (${due})`, [
        { field: 'amount', message: `Payment exceeds the amount due (${due})` },
      ]);
    }

    purchase.payments.push({
      amount,
      method: data.method || PAYMENT_METHODS.CASH,
      date: new Date(),
      note: data.note || undefined,
      recordedBy: user._id,
    });
    purchase.paidAmount = round2(purchase.paidAmount + amount);
    purchase.paymentStatus = paymentStatusFor(purchase.grandTotal, purchase.paidAmount);
    await purchase.save({ session });

    await recalculateSupplierTotals(purchase.supplier, session);

    await activityService.log(
      {
        user: user._id,
        action: 'PURCHASE_PAYMENT_RECORDED',
        entity: ENTITIES.PURCHASE,
        entityId: purchase._id,
        description: `${user.name} recorded a payment of ${amount} for purchase ${purchase.invoiceNumber}`,
      },
      session
    );
  });

  return getById(id);
};

module.exports = { list, getById, create, receive, cancel, addPayment };