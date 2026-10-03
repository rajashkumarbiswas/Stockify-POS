const mongoose = require('mongoose');

/**
 * Runs `work(session)` inside a MongoDB transaction. If anything throws, EVERY change made
 * with that session is rolled back. Transient failures are retried automatically.
 *
 *   const sale = await withTransaction(async (session) => {
 *     await Product.updateOne({ ... }, { $inc: { currentStock: -2 } }, { session });
 *     return Sale.create([{ ... }], { session });
 *   });
 *
 * IMPORTANT: pass `{ session }` to every database call inside `work`, otherwise that call
 * runs outside the transaction and will NOT be rolled back.
 */
const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
    );
    return result;
  } catch (error) {
    if (error.code === 20 || /replica set member or mongos/i.test(error.message || '')) {
      console.error(
        '[FATAL] MongoDB transactions are not available. Use MongoDB Atlas or a replica set (see README).'
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = { withTransaction };