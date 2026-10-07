const dotenv = require('dotenv');
const app = require('./app');
const db = require('./db');

dotenv.config();

for (const name of ['JWT_SECRET', 'METRICS_TOKEN']) {
  if (!process.env[name] || process.env[name].length < 32) {
    console.error(`${name} must be configured with at least 32 characters.`);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () => {
  console.log(`ScoutOps listening on port ${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down ScoutOps...`);

  server.close(async () => {
    try {
      await db.closePool();
      console.log('Database pool closed successfully.');
      process.exit(0);
    } catch (error) {
      console.error('Error closing database pool:', error.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
