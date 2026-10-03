/**
 * Creates every collection and builds all indexes defined in the models.
 * Run once after pulling model changes:  npm run db:sync
 */
const mongoose = require('mongoose');
require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const models = require('../models');

const run = async () => {
  await connectDB();

  for (const [name, Model] of Object.entries(models)) {
    try {
      await Model.createCollection();
    } catch (error) {
      // 48 = NamespaceExists: the collection is already there, which is fine
      if (error.code !== 48) throw error;
    }
    await Model.syncIndexes();
    const indexes = await Model.collection.indexes();
    console.log(
      `✔ ${name.padEnd(14)} -> ${Model.collection.collectionName.padEnd(16)} (${indexes.length} indexes)`
    );
  }

  console.log('\nAll collections and indexes are ready.');
};

run()
  .then(() => disconnectDB())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('\nSync failed:', error.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });