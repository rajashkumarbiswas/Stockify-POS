/**
 * End-to-end check of authentication against the RUNNING API (npm run dev must be active).
 * Creates temporary users, tests login/cookies/tokens/password change/permissions, then cleans up.
 *   npm run auth:test
 */
const assert = require('assert');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Activity } = require('../models');
const { ROLES, USER_STATUS } = require('../config/constants');
const { authorize } = require('../middleware/authorize');
const { COOKIE_NAME } = require('../utils/token');

const BASE = `http://localhost:${env.port}/api`;
const PASSWORD = 'Passw0rd123';
const NEW_PASSWORD = 'NewPassw0rd456';
const tag = `smoke-auth-${Date.now()}`;
const createdUserIds = [];

const step = (message) => console.log(`✔ ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSetCookies = (res) => {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
};

const extractAuthCookie = (res) => {
  const raw = getSetCookies(res).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return raw ? { raw, pair: raw.split(';')[0] } : null;
};

const call = async (path, { method = 'GET', body, cookie, headers = {} } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { res: response, json, status: response.status };
};

const makeUser = async (role, label) => {
  const user = await User.create({
    name: `Smoke ${label}`,
    email: `${tag}-${label}@test.local`,
    password: PASSWORD,
    role,
  });
  createdUserIds.push(user._id);
  return user;
};

const runAuthorize = (user, ...permissions) =>
  new Promise((resolve) => authorize(...permissions)({ user }, {}, (err) => resolve(err || null)));

const login = (email, password) => call('/auth/login', { method: 'POST', body: { email, password } });

const run = async () => {
  try {
    await fetch(`${BASE}/health`);
  } catch {
    throw new Error(`API is not reachable at ${BASE}. Start it first with "npm run dev".`);
  }

  await connectDB();

  const admin = await makeUser(ROLES.ADMIN, 'admin');
  const staff = await makeUser(ROLES.SALES_STAFF, 'staff');

  // ---------- Login failures ----------
  let r = await login(admin.email, 'WrongPass123');
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.json.message, 'Invalid email or password');

  r = await login(`nobody-${tag}@test.local`, PASSWORD);
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.json.message, 'Invalid email or password');
  step('Login: wrong password and unknown email give the same generic 401');

  r = await login('not-an-email', 'x');
  assert.strictEqual(r.status, 400);
  step('Login: invalid input is rejected by validation (400)');

  // ---------- Login success ----------
  r = await login(admin.email, PASSWORD);
  assert.strictEqual(r.status, 200);
  const cookie = extractAuthCookie(r.res);
  assert.ok(cookie, 'auth cookie must be set');
  assert.match(cookie.raw, /HttpOnly/i);
  assert.match(cookie.raw, /SameSite=Lax/i);
  assert.strictEqual(JSON.stringify(r.json).includes('passwordHash'), false);
  assert.strictEqual(r.json.data.user.role, ROLES.ADMIN);
  assert.ok(r.json.data.user.permissions.includes('users:create'));
  step('Login: JWT is in an httpOnly cookie, response never leaks the password hash');

  // ---------- Protected route ----------
  r = await call('/auth/me');
  assert.strictEqual(r.status, 401);
  step('/auth/me without a token -> 401');

  r = await call('/auth/me', { cookie: cookie.pair });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.data.user.email, admin.email);
  step('/auth/me with the cookie -> 200');

  const token = cookie.pair.slice(COOKIE_NAME.length + 1);
  r = await call('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.status, 200);
  step('/auth/me with an Authorization: Bearer header -> 200');

  r = await call('/auth/me', { cookie: `${COOKIE_NAME}=abc.def.ghi` });
  assert.strictEqual(r.status, 401);
  step('Tampered token -> 401');

  const expired = jwt.sign({}, env.jwt.secret, { subject: String(admin._id), expiresIn: -10 });
  r = await call('/auth/me', { cookie: `${COOKIE_NAME}=${expired}` });
  assert.strictEqual(r.status, 401);
  assert.match(r.json.message, /expired/i);
  step('Expired token -> 401 with a clear "expired" message');

  // ---------- Profile (role cannot be changed) ----------
  r = await login(staff.email, PASSWORD);
  const staffCookie = extractAuthCookie(r.res).pair;
  assert.ok(!r.json.data.user.permissions.includes('users:create'));
  assert.ok(r.json.data.user.permissions.includes('sales:create'));

  r = await call('/auth/profile', { method: 'PATCH', cookie: staffCookie, body: { role: ROLES.ADMIN } });
  assert.strictEqual(r.status, 400);
  assert.strictEqual((await User.findById(staff._id)).role, ROLES.SALES_STAFF);
  step('Profile: a sales staff user cannot promote their own role');

  r = await call('/auth/profile', { method: 'PATCH', cookie: staffCookie, body: { name: 'Smoke Staff Renamed' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.data.user.name, 'Smoke Staff Renamed');
  step('Profile: name update works');

  // ---------- Change password ----------
  await sleep(2200); // token timestamps have 1-second precision
  r = await call('/auth/change-password', {
    method: 'PATCH',
    cookie: cookie.pair,
    body: { currentPassword: 'WrongCurrent1', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
  });
  assert.strictEqual(r.status, 400);
  assert.match(r.json.message, /Current password is incorrect/);

  r = await call('/auth/change-password', {
    method: 'PATCH',
    cookie: cookie.pair,
    body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
  });
  assert.strictEqual(r.status, 200);
  const newCookie = extractAuthCookie(r.res);
  assert.ok(newCookie, 'a fresh cookie must be issued after a password change');
  step('Change password: wrong current password rejected, correct one accepted');

  r = await call('/auth/me', { cookie: cookie.pair });
  assert.strictEqual(r.status, 401);
  r = await call('/auth/me', { cookie: newCookie.pair });
  assert.strictEqual(r.status, 200);
  step('Change password: old tokens stop working, the new session keeps working');

  r = await login(admin.email, PASSWORD);
  assert.strictEqual(r.status, 401);
  r = await login(admin.email, NEW_PASSWORD);
  assert.strictEqual(r.status, 200);
  step('Change password: old password no longer logs in, new password does');

  // ---------- Disabled account ----------
  await User.updateOne({ _id: staff._id }, { status: USER_STATUS.INACTIVE });
  r = await call('/auth/me', { cookie: staffCookie });
  assert.strictEqual(r.status, 401);
  r = await login(staff.email, PASSWORD);
  assert.strictEqual(r.status, 403);
  step('Disabled account: existing session is cut off and login is refused');

  // ---------- Logout ----------
  r = await call('/auth/logout', { method: 'POST' });
  assert.strictEqual(r.status, 200);
  const cleared = getSetCookies(r.res).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  assert.match(cleared, /Expires=Thu, 01 Jan 1970/);
  step('Logout: cookie is cleared');

  // ---------- Authorization middleware ----------
  const asAdmin = { role: ROLES.ADMIN };
  const asManager = { role: ROLES.MANAGER };
  const asStaff = { role: ROLES.SALES_STAFF };

  assert.strictEqual(await runAuthorize(asAdmin, 'users:create'), null);
  assert.strictEqual((await runAuthorize(asManager, 'users:create')).statusCode, 403);
  assert.strictEqual((await runAuthorize(asManager, 'activities:view')).statusCode, 403);
  assert.strictEqual((await runAuthorize(asManager, 'settings:update')).statusCode, 403);
  assert.strictEqual(await runAuthorize(asManager, 'reports:view'), null);
  assert.strictEqual(await runAuthorize(asManager, 'purchases:create'), null);
  assert.strictEqual(await runAuthorize(asStaff, 'sales:create'), null);
  assert.strictEqual((await runAuthorize(asStaff, 'products:create')).statusCode, 403);
  assert.strictEqual((await runAuthorize(asStaff, 'products:view_cost')).statusCode, 403);
  assert.strictEqual((await runAuthorize(asStaff, 'inventory:adjust')).statusCode, 403);
  assert.strictEqual((await runAuthorize(asStaff, 'customers:delete')).statusCode, 403);
  assert.strictEqual((await runAuthorize({ role: 'HACKER' }, 'sales:create')).statusCode, 403);
  assert.strictEqual(await new Promise((resolve) => authorize('x')({}, {}, (e) => resolve(e.statusCode))), 401);
  step('authorize(): Admin / Manager / Sales Staff permission rules and default-deny behave correctly');

  console.log('\nAll authentication checks passed.');
};

const cleanup = async () => {
  await Activity.deleteMany({
    $or: [{ user: { $in: createdUserIds } }, { description: new RegExp(tag) }],
  });
  await User.deleteMany({ _id: { $in: createdUserIds } });
};

run()
  .catch((error) => {
    console.error('\n✘ Auth test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });