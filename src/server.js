const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/db');

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(config.port, () => {
      console.log(`[server] Listening on port ${config.port} in ${config.env} mode`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n[server] ${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('[server] HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  }
};

startServer();
