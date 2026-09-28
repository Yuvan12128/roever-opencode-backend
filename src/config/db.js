const mongoose = require('mongoose');
const config = require('./env');

mongoose.set('strictQuery', true);

/**
 * Resolve the MongoDB connection URI.
 * - Uses MONGODB_URI when configured (production / MongoDB Atlas).
 * - Falls back to an in-memory MongoDB in development so `npm run dev`
 *   works with zero setup. The in-memory server is a dev-only tool and
 *   data is lost on restart.
 */
const resolveMongoUri = async () => {
  if (config.mongoUri) {
    return { uri: config.mongoUri, ephemeral: false };
  }

  if (config.isProd) {
    throw new Error('MONGODB_URI is required in production. See .env.example.');
  }

  // Lazy-load so production deployments never pay the devDependency cost
  const { getDevDatabaseUri, stopDevDatabase } = require('./devDatabase');
  const uri = await getDevDatabaseUri();
  console.log('[db] MONGODB_URI not set — using shared in-memory MongoDB for development');
  return { uri, ephemeral: true, memoryServer: null, stopDevDatabase };
};

/**
 * Connect to MongoDB Atlas (or in-memory MongoDB in development).
 * Uses a single shared connection pool for the whole app.
 */
const connectDB = async () => {
  const { uri, ephemeral, memoryServer } = await resolveMongoUri();

  const options = {
    autoIndex: config.isProd ? false : true,
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  const conn = await mongoose.connect(uri, options);

  console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  // Stop the in-memory server when the process exits (dev only).
  // Only the process that started it should stop it.
  if (ephemeral) {
    const stopMemory = () => {
      if (memoryServer) {
        memoryServer.stop().catch(() => {});
      }
      // If we connected to an existing instance, leave it running
      // for the other process (e.g. the backend server).
    };
    process.on('SIGINT', stopMemory);
    process.on('SIGTERM', stopMemory);
  }

  return conn;
};

module.exports = connectDB;
