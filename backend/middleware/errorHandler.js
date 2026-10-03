const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * Converts any thrown error into a safe, consistent API error.
 * Response shape: { success: false, message, errors: [] }
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Mongoose schema validation
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new ApiError(400, errors[0]?.message || 'Validation failed', errors);
  }

  // Invalid ObjectId or bad cast
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid value for ${err.path}`);
  }

  // Duplicate key (unique index)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    const field = fields[0] || 'field';
    return new ApiError(409, `A record with this ${field} already exists`, [
      { field, message: `${field} must be unique` },
    ]);
  }

  // JWT
  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Your session has expired. Please log in again.');
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return new ApiError(401, 'Invalid authentication token. Please log in again.');
  }

  // Body parser errors
  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'Malformed JSON in request body');
  }
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large');
  }

  // Database unreachable (network down, Atlas paused, IP not allowed...)
  if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoNetworkTimeoutError'
  ) {
    console.error('Database unavailable:', err.message);
    return new ApiError(503, 'The database is temporarily unavailable. Please try again shortly.');
  }

  return null;
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const known = normalizeError(err);

  if (known) {
    return res.status(known.statusCode).json({
      success: false,
      message: known.message,
      errors: known.errors || [],
    });
  }

  // Unknown / programmer error: log it, never leak details in production
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, env.isProduction ? err.message : err);

  const body = {
    success: false,
    message: 'Something went wrong on our side. Please try again later.',
    errors: [],
  };
  if (!env.isProduction) body.stack = err.stack;

  return res.status(500).json(body);
};

module.exports = errorHandler;