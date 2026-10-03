const { Product } = require('../models');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { paginate } = require('../utils/paginate');
const { buildSearchFilter, combineFilters } = require('../utils/search');
const activityService = require('./activity.service');
const { RECORD_STATUS } = require('../config/constants');

const FIELDS = ['name', 'description', 'status'];
const COLLATION = { locale: 'en', strength: 2 }; // case-insensitive sorting

/**
 * Builds the service for a "named entity" (Category / Brand): same fields, same rules.
 *   Model        mongoose model
 *   label        "Category" (used in messages)
 *   entity       ENTITIES value for the activity log
 *   productField field on Product that points to this entity ("category" / "brand")
 */
const createNamedEntityService = ({ Model, label, entity, productField }) => {
  const lower = label.toLowerCase();

  const translateDuplicate = (error, name) => {
    if (error.code === 11000) {
      return ApiError.conflict(`A ${lower} named "${name}" already exists`, [
        { field: 'name', message: 'This name is already in use' },
      ]);
    }
    return error;
  };

  /** Adds productCount to each document with ONE aggregation for the whole page. */
  const attachProductCounts = async (docs) => {
    if (docs.length === 0) return [];

    const rows = await Product.aggregate([
      { $match: { [productField]: { $in: docs.map((doc) => doc._id) } } },
      { $group: { _id: `$${productField}`, count: { $sum: 1 } } },
    ]);
    const counts = new Map(rows.map((row) => [String(row._id), row.count]));

    return docs.map((doc) => ({
      ...doc.toJSON(),
      productCount: counts.get(String(doc._id)) || 0,
    }));
  };

  const findOrFail = async (id) => {
    const doc = await Model.findById(id);
    if (!doc) throw ApiError.notFound(`${label} not found`);
    return doc;
  };

  const list = async (query) => {
    const filter = combineFilters(
      buildSearchFilter(query.search, ['name', 'description']),
      query.status ? { status: query.status } : null
    );

    const { items, pagination } = await paginate(Model, filter, {
      query,
      allowedSort: ['name', 'status', 'createdAt'],
      defaultSort: { name: 1 },
      collation: COLLATION,
    });

    return { items: await attachProductCounts(items), pagination };
  };

  /** Small unpaginated list for dropdowns: only active records, id + name. */
  const options = async () => {
    const docs = await Model.find({ status: RECORD_STATUS.ACTIVE })
      .select('name')
      .sort({ name: 1 })
      .collation(COLLATION)
      .limit(500)
      .lean();
    return docs.map((doc) => ({ id: String(doc._id), name: doc.name }));
  };

  const getById = async (id) => {
    const doc = await findOrFail(id);
    const [withCount] = await attachProductCounts([doc]);
    return withCount;
  };

  const create = async (data, user) => {
    let doc;
    try {
      doc = await Model.create(pick(data, FIELDS));
    } catch (error) {
      throw translateDuplicate(error, data.name);
    }

    await activityService.log({
      user: user._id,
      action: `${entity}_CREATED`,
      entity,
      entityId: doc._id,
      description: `${user.name} created ${lower} "${doc.name}"`,
    });

    return { ...doc.toJSON(), productCount: 0 };
  };

  const update = async (id, data, user) => {
    const doc = await findOrFail(id);
    doc.set(pick(data, FIELDS));

    try {
      await doc.save();
    } catch (error) {
      throw translateDuplicate(error, data.name);
    }

    await activityService.log({
      user: user._id,
      action: `${entity}_UPDATED`,
      entity,
      entityId: doc._id,
      description: `${user.name} updated ${lower} "${doc.name}"`,
    });

    const [withCount] = await attachProductCounts([doc]);
    return withCount;
  };

  const remove = async (id, user) => {
    const doc = await findOrFail(id);

    const usedBy = await Product.countDocuments({ [productField]: doc._id });
    if (usedBy > 0) {
      throw ApiError.conflict(
        `Cannot delete this ${lower}: it is used by ${usedBy} product${usedBy > 1 ? 's' : ''}. ` +
          `Move those products to another ${lower}, or set this ${lower} to inactive instead.`
      );
    }

    await doc.deleteOne();

    await activityService.log({
      user: user._id,
      action: `${entity}_DELETED`,
      entity,
      entityId: doc._id,
      description: `${user.name} deleted ${lower} "${doc.name}"`,
    });
  };

  return { list, options, getById, create, update, remove };
};

module.exports = createNamedEntityService;