const mongoose = require('mongoose');
const { Supplier, Purchase } = require('../models');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { paginate, parsePagination, buildPaginationMeta } = require('../utils/paginate');
const { buildSearchFilter, combineFilters } = require('../utils/search');
const activityService = require('./activity.service');
const { ENTITIES, RECORD_STATUS } = require('../config/constants');

// dueAmount / totalPurchases are deliberately missing: only the purchase service changes them
const EDITABLE_FIELDS = ['name', 'company', 'phone', 'email', 'address', 'status'];
const OPTIONAL_FIELDS = ['company', 'phone', 'email', 'address'];
const COLLATION = { locale: 'en', strength: 2 };

/** '' and null mean "clear this optional field". */
const buildChanges = (data) => {
  const changes = pick(data, EDITABLE_FIELDS);
  OPTIONAL_FIELDS.forEach((key) => {
    if (key in changes && (changes[key] === '' || changes[key] === null)) changes[key] = undefined;
  });
  return changes;
};

const translateDuplicate = (error) => {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    if (field === 'phone' || field === 'email') {
      return ApiError.conflict(`Another supplier already uses this ${field}`, [
        { field, message: `This ${field} is already in use` },
      ]);
    }
  }
  return error;
};

const findOrFail = async (id) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) throw ApiError.notFound('Supplier not found');
  return supplier;
};

const assertExists = async (id) => {
  const exists = await Supplier.exists({ _id: id });
  if (!exists) throw ApiError.notFound('Supplier not found');
};

const list = async (query) => {
  const filter = combineFilters(
    buildSearchFilter(query.search, ['name', 'company', 'phone', 'email']),
    query.status ? { status: query.status } : null
  );

  return paginate(Supplier, filter, {
    query,
    allowedSort: ['name', 'company', 'dueAmount', 'totalPurchases', 'status', 'createdAt'],
    defaultSort: { name: 1 },
    collation: COLLATION,
  });
};

/** Small unpaginated list for dropdowns: only active suppliers. */
const options = async () => {
  const docs = await Supplier.find({ status: RECORD_STATUS.ACTIVE })
    .select('name company')
    .sort({ name: 1 })
    .collation(COLLATION)
    .limit(500)
    .lean();
  return docs.map((doc) => ({ id: String(doc._id), name: doc.name, company: doc.company || '' }));
};

const getById = async (id) => {
  const supplier = await findOrFail(id);

  const [stats] = await Purchase.aggregate([
    { $match: { supplier: supplier._id } },
    {
      $group: {
        _id: null,
        purchaseCount: { $sum: 1 },
        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        lastPurchaseAt: { $max: '$purchaseDate' },
      },
    },
  ]);

  return {
    ...supplier.toJSON(),
    stats: {
      purchaseCount: stats?.purchaseCount || 0,
      pendingCount: stats?.pendingCount || 0,
      lastPurchaseAt: stats?.lastPurchaseAt || null,
    },
  };
};

const create = async (data, user) => {
  let supplier;
  try {
    supplier = await Supplier.create(buildChanges(data));
  } catch (error) {
    throw translateDuplicate(error);
  }

  await activityService.log({
    user: user._id,
    action: 'SUPPLIER_CREATED',
    entity: ENTITIES.SUPPLIER,
    entityId: supplier._id,
    description: `${user.name} created supplier "${supplier.name}"`,
  });

  return supplier;
};

const update = async (id, data, user) => {
  const supplier = await findOrFail(id);
  supplier.set(buildChanges(data));

  try {
    await supplier.save();
  } catch (error) {
    throw translateDuplicate(error);
  }

  await activityService.log({
    user: user._id,
    action: 'SUPPLIER_UPDATED',
    entity: ENTITIES.SUPPLIER,
    entityId: supplier._id,
    description: `${user.name} updated supplier "${supplier.name}"`,
  });

  return supplier;
};

const remove = async (id, user) => {
  const supplier = await findOrFail(id);

  const purchases = await Purchase.countDocuments({ supplier: supplier._id });
  if (purchases > 0) {
    throw ApiError.conflict(
      `Cannot delete this supplier: it has ${purchases} purchase${purchases > 1 ? 's' : ''} on record. ` +
        'Set the supplier to inactive instead.'
    );
  }

  await supplier.deleteOne();

  await activityService.log({
    user: user._id,
    action: 'SUPPLIER_DELETED',
    entity: ENTITIES.SUPPLIER,
    entityId: supplier._id,
    description: `${user.name} deleted supplier "${supplier.name}"`,
  });
};

/** Every payment made to this supplier, newest first (payments live inside purchases). */
const listPayments = async (id, query) => {
  await assertExists(id);

  const { page, limit, skip } = parsePagination(query);
  const supplierId = new mongoose.Types.ObjectId(String(id));

  const [result] = await Purchase.aggregate([
    { $match: { supplier: supplierId } },
    { $unwind: '$payments' },
    { $sort: { 'payments.date': -1, 'payments._id': -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'payments.recordedBy',
              foreignField: '_id',
              as: 'recorder',
            },
          },
          {
            $project: {
              _id: 0,
              purchaseId: '$_id',
              invoiceNumber: 1,
              amount: '$payments.amount',
              method: '$payments.method',
              date: '$payments.date',
              note: '$payments.note',
              recordedBy: { $arrayElemAt: ['$recorder.name', 0] },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const totalItems = result.total[0]?.count || 0;
  return { items: result.items, pagination: buildPaginationMeta(totalItems, page, limit) };
};

module.exports = { list, options, getById, create, update, remove, assertExists, listPayments };