const Activity = require('../models/Activity');
const { paginate } = require('../utils/paginate');
const { buildSearchFilter, combineFilters } = require('../utils/search');
const { resolveDateRange, toDateFilter } = require('../utils/dateRange');

/**
 * Writes an audit-log entry.
 * - Without a session (e.g. login): best effort, a logging failure never breaks the request.
 * - With a session (inside a transaction): errors propagate so the transaction stays consistent.
 */
const log = async ({ user, action, entity, entityId, description, metadata }, session) => {
  const payload = { user, action, entity, entityId, description, metadata };

  if (session) {
    await Activity.create([payload], { session });
    return;
  }

  try {
    await Activity.create(payload);
  } catch (error) {
    console.error('Failed to write activity log:', error.message);
  }
};

/** Activity log page (Admin only): search, entity/user filters, date range, pagination. */
const list = async (query) => {
  const filter = combineFilters(
    query.search ? buildSearchFilter(query.search, ['description']) : null,
    query.entity ? { entity: query.entity } : null,
    query.user ? { user: query.user } : null,
    query.range ? { createdAt: toDateFilter(resolveDateRange(query)) } : null
  );

  const { items, pagination } = await paginate(Activity, filter, {
    query,
    allowedSort: ['createdAt'],
    defaultSort: { createdAt: -1 },
    populate: [{ path: 'user', select: 'name role' }],
  });

  return { items: items.map((doc) => (typeof doc.toJSON === 'function' ? doc.toJSON() : doc)), pagination };
};

module.exports = { log, list };