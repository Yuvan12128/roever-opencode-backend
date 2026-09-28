const dotenv = require('dotenv');

dotenv.config();

// MONGODB_URI is not strictly required in development (in-memory fallback
// in config/db.js), so only JWT_SECRET is enforced here.
const requiredEnvVars = ['JWT_SECRET'];

const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // Don't crash immediately in production platforms that inject env vars late;
  // warn loudly so misconfiguration is visible in logs.
  console.warn(
    `[env] Missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in the environment or in a .env file. See .env.example.'
  );
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET || 'insecure-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),
  attendanceRetentionDays: parseInt(process.env.ATTENDANCE_RETENTION_DAYS, 10) || 365,
  lowAttendanceThreshold: parseInt(process.env.LOW_ATTENDANCE_THRESHOLD, 10) || 75,
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = config;
