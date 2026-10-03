const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy backend/.env.example to backend/.env and fill in the values.'
  );
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

const nodeEnv = process.env.NODE_ENV || 'development';

const toInt = (value, fallback, { min = 1, max = Infinity } = {}) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: toInt(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI,
  jwt: Object.freeze({
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  }),
  bcryptSaltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 12),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  // Minutes ahead of UTC for the shop's local time (Bangladesh = 360). Defaults to UTC+6.
  businessUtcOffsetMinutes: toInt(process.env.BUSINESS_UTC_OFFSET_MINUTES, 360, {
    min: -720,
    max: 840,
  }),
});

module.exports = env;