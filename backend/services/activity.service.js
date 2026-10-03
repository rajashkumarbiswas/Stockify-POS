const Activity = require('../models/Activity');

/**
 * Writes an audit-log entry.
 * - Without a session (e.g. login): best effort, a logging failure never breaks the request.
 * - With a session (inside a transaction): errors propagate so the transaction stays consistent.
 *
 * (Phase 13 adds query/list functions to this file.)
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

module.exports = { log };