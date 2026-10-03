const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Reads ?page= and ?limit= safely (garbage values fall back, limit is capped). */
const parsePagination = (query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * ?sortBy=name&sortOrder=asc -> { name: 1, _id: 1 }
 * Only fields in `allowed` can be sorted on; anything else falls back to defaultSort.
 * `_id` is appended as a tie-breaker so pages never overlap or skip records.
 */
const parseSort = (query = {}, { allowed = [], defaultSort = { createdAt: -1 } } = {}) => {
  const field = query.sortBy;
  let sort = defaultSort;

  if (field && allowed.includes(field)) {
    const direction = String(query.sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    sort = { [field]: direction };
  }

  if (!Object.prototype.hasOwnProperty.call(sort, '_id')) {
    const lastDirection = Object.values(sort).pop() ?? -1;
    return { ...sort, _id: lastDirection };
  }
  return sort;
};

const buildPaginationMeta = (totalItems, page, limit) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    currentPage: page,
    totalPages,
    totalItems,
    limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

/**
 * Runs a paginated query entirely in MongoDB.
 *
 *   const { items, pagination } = await paginate(Product, filter, {
 *     query: req.query,
 *     allowedSort: ['name', 'sellingPrice', 'createdAt'],
 *     populate: ['category', 'brand'],
 *   });
 *
 * Documents are NOT lean by default so virtuals (e.g. Product.stockStatus) and
 * toJSON transforms still apply when the response is serialized.
 */
const paginate = async (
  Model,
  filter = {},
  {
    query = {},
    allowedSort = [],
    defaultSort,
    select,
    populate,
    collation,
    lean = false,
    defaultLimit,
    maxLimit,
  } = {}
) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit, maxLimit });
  const sort = parseSort(query, { allowed: allowedSort, defaultSort });

  let find = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (select) find = find.select(select);
  if (populate) find = find.populate(populate);
  if (collation) find = find.collation(collation);
  if (lean) find = find.lean();

  const [items, totalItems] = await Promise.all([find.exec(), Model.countDocuments(filter)]);

  return { items, pagination: buildPaginationMeta(totalItems, page, limit) };
};

module.exports = { parsePagination, parseSort, buildPaginationMeta, paginate, DEFAULT_LIMIT, MAX_LIMIT };