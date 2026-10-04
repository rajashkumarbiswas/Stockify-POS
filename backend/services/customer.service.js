const { Customer, Sale } = require('../models');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { paginate } = require('../utils/paginate');
const { buildSearchFilter } = require('../utils/search');
const activityService = require('./activity.service');
const { ENTITIES } = require('../config/constants');

// totalPurchases / totalSpent / dueAmount are deliberately missing: only the sale service changes them
const EDITABLE_FIELDS = ['name', 'phone', 'email', 'address'];
const OPTIONAL_FIELDS = ['phone', 'email', 'address'];
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
      return ApiError.conflict(`Another customer already uses this ${field}`, [
        { field, message: `This ${field} is already in use` },
      ]);
    }
  }
  return error;
};

const findOrFail = async (id) => {
  const customer = await Customer.findById(id);
  if (!customer) throw ApiError.notFound('Customer not found');
  return customer;
};

const list = async (query) =>
  paginate(Customer, buildSearchFilter(query.search, ['name', 'phone', 'email']), {
    query,
    allowedSort: ['name', 'totalPurchases', 'totalSpent', 'dueAmount', 'createdAt'],
    defaultSort: { name: 1 },
    collation: COLLATION,
  });

const getById = async (id) => {
  const customer = await findOrFail(id);

  const [stats] = await Sale.aggregate([
    { $match: { customer: customer._id } },
    { $group: { _id: null, saleCount: { $sum: 1 }, lastSaleAt: { $max: '$createdAt' } } },
  ]);

  return {
    ...customer.toJSON(),
    stats: { saleCount: stats?.saleCount || 0, lastSaleAt: stats?.lastSaleAt || null },
  };
};

const create = async (data, user) => {
  let customer;
  try {
    customer = await Customer.create(buildChanges(data));
  } catch (error) {
    throw translateDuplicate(error);
  }

  await activityService.log({
    user: user._id,
    action: 'CUSTOMER_CREATED',
    entity: ENTITIES.CUSTOMER,
    entityId: customer._id,
    description: `${user.name} created customer "${customer.name}"`,
  });

  return customer;
};

const update = async (id, data, user) => {
  const customer = await findOrFail(id);
  customer.set(buildChanges(data));

  try {
    await customer.save();
  } catch (error) {
    throw translateDuplicate(error);
  }

  await activityService.log({
    user: user._id,
    action: 'CUSTOMER_UPDATED',
    entity: ENTITIES.CUSTOMER,
    entityId: customer._id,
    description: `${user.name} updated customer "${customer.name}"`,
  });

  return customer;
};

const remove = async (id, user) => {
  const customer = await findOrFail(id);

  const sales = await Sale.countDocuments({ customer: customer._id });
  if (sales > 0) {
    throw ApiError.conflict(
      `Cannot delete this customer: ${sales} sale${sales > 1 ? 's are' : ' is'} recorded for them. ` +
        'Their purchase history must stay intact.'
    );
  }

  await customer.deleteOne();

  await activityService.log({
    user: user._id,
    action: 'CUSTOMER_DELETED',
    entity: ENTITIES.CUSTOMER,
    entityId: customer._id,
    description: `${user.name} deleted customer "${customer.name}"`,
  });
};

module.exports = { list, getById, create, update, remove };