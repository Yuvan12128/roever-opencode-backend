const dotenv = require('dotenv');

dotenv.config();

// In production, both JWT_SECRET and MONGODB_URI are required.
// In development, neither is strictly required (in-memory MongoDB fallback).
const isProd = process.env.NODE_ENV === 'production';
const requiredEnvVars = isProd
  ? ['JWT_SECRET', 'MONGODB_URI']
  : ['JWT_SECRET'];

const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[env] Missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in the environment or in a .env file. See .env.example.'
  );
  if (isProd) {
    process.exit(1);
  }
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
