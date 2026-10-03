const jwt = require('jsonwebtoken');
const env = require('../config/env');

const COOKIE_NAME = 'stockify_token';

const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/** "30m", "12h", "7d" -> milliseconds (also used for the cookie lifetime) */
const parseDurationToMs = (value) => {
  const match = /^(\d+)\s*([smhd])$/.exec(String(value).trim());
  if (!match) {
    throw new Error(`JWT_EXPIRES_IN must look like 30m, 12h or 7d (received "${value}")`);
  }
  return Number(match[1]) * UNIT_MS[match[2]];
};

const COOKIE_MAX_AGE_MS = parseDurationToMs(env.jwt.expiresIn);

const baseCookieOptions = {
  httpOnly: true, // JavaScript in the browser can never read the token
  secure: env.isProduction, // HTTPS only in production
  sameSite: 'lax',
  path: '/',
};

const signToken = (userId) =>
  jwt.sign({}, env.jwt.secret, {
    subject: String(userId),
    expiresIn: env.jwt.expiresIn,
    algorithm: 'HS256',
  });

const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, { ...baseCookieOptions, maxAge: COOKIE_MAX_AGE_MS });
};

const clearAuthCookie = (res) => {
  res.clearCookie(COOKIE_NAME, baseCookieOptions);
};

module.exports = { COOKIE_NAME, signToken, setAuthCookie, clearAuthCookie };