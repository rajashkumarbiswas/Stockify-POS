const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

/**
 * Connects to MongoDB and verifies that the deployment supports
 * multi-document transactions (replica set or sharded cluster).
 * Sales, purchases and returns rely on transactions for consistency.
 */
const connectDB = async () => {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected: ${host}/${name}`);

  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    const supportsTransactions = Boolean(info.setName) || info.msg === 'isdbgrid';
    if (!supportsTransactions) {
      console.warn(
        '\n[WARNING] MongoDB is running as a standalone server. Transactions are NOT supported.\n' +
          '          Use MongoDB Atlas or start a local replica set (see README) before Phase 6+.\n'
      );
    }
  } catch (error) {
    console.warn('Could not verify transaction support:', error.message);
  }

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
};

const disconnectDB = async () => {
  await mongoose.connection.close(false);
};

module.exports = { connectDB, disconnectDB };