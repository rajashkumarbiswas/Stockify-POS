const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { COOKIE_NAME } = require('../utils/token');
const { USER_STATUS } = require('../config/constants');

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies ? req.cookies[COOKIE_NAME] : undefined;
};

/**
 * Verifies the JWT and loads the CURRENT user from the database.
 * The role always comes from the database, never from the token or the client.
 * Expired/invalid tokens are turned into 401 responses by errorHandler.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required. Please sign in.');

  const decoded = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });

  const user = await User.findById(decoded.sub);
  if (!user) throw ApiError.unauthorized('This account no longer exists.');

  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.unauthorized('Your account has been disabled. Contact an administrator.');
  }

  if (user.changedPasswordAfter(decoded.iat)) {
    throw ApiError.unauthorized('Your password was changed. Please sign in again.');
  }

  req.user = user;
  next();
});

module.exports = { protect };