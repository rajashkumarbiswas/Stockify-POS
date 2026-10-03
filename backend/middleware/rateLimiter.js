const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Only FAILED attempts count (skipSuccessfulRequests), which slows down password guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProduction ? 10 : 30,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(new ApiError(429, 'Too many failed login attempts. Please try again in 15 minutes.')),
});

module.exports = { loginLimiter };