const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');

let server;

const start = async () => {
  await connectDB();

  server = app.listen(env.port, () => {
    console.log(`Stockify-POS API listening on http://localhost:${env.port} [${env.nodeEnv}]`);
  });
};

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  shutdown('unhandledRejection');
});

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});