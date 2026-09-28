const { MongoMemoryServer } = require('mongodb-memory-server');

const DEV_PORT = 27017;
const DEV_URI = `mongodb://127.0.0.1:${DEV_PORT}`;

let memoryServer = null;

/**
 * Get the development database URI.
 *
 * When MONGODB_URI is not configured, this starts (or connects to) a
 * shared in-memory MongoDB on a fixed port so that the backend server
 * and the seed script use the SAME database.
 *
 * First process to call this starts the server; subsequent processes
 * detect it and connect to the existing instance.
 */
const getDevDatabaseUri = async () => {
  // Check if something is already listening on the dev port
  const isReachable = await checkPort(DEV_PORT);

  if (isReachable) {
    console.log(`[db] Connecting to existing dev MongoDB on port ${DEV_PORT}`);
    return DEV_URI;
  }

  memoryServer = await MongoMemoryServer.create({
    instance: { port: DEV_PORT },
  });

  console.log(`[db] Started shared in-memory MongoDB on port ${DEV_PORT}`);
  return DEV_URI;
};

const checkPort = async (port) => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(`mongodb://127.0.0.1:${port}`, {
      serverSelectionTimeoutMS: 1000,
    });
    await client.connect();
    await client.close();
    return true;
  } catch {
    return false;
  }
};

const stopDevDatabase = async () => {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

module.exports = { getDevDatabaseUri, stopDevDatabase, DEV_URI };
