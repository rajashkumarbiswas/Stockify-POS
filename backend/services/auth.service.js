const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const activityService = require('./activity.service');
const { signToken } = require('../utils/token');
const { getPermissions } = require('../config/permissions');
const { ENTITIES, USER_STATUS } = require('../config/constants');

// Compared against when the email does not exist, so response time does not reveal valid emails
const DUMMY_HASH = bcrypt.hashSync('timing-attack-protection', env.bcryptSaltRounds);

/** Explicit allow-list of fields the client may see. Never returns passwordHash. */
const toSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  permissions: getPermissions(user.role),
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

const login = async ({ email, password }, { ip } = {}) => {
  const user = await User.findOne({ email }).select('+passwordHash');

  let passwordMatches = false;
  if (user) {
    passwordMatches = await user.comparePassword(password);
  } else {
    await bcrypt.compare(password, DUMMY_HASH);
  }

  if (!user || !passwordMatches) {
    await activityService.log({
      action: 'LOGIN_FAILED',
      entity: ENTITIES.AUTH,
      description: `Failed login attempt for ${email}`,
      metadata: { ip },
    });
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Your account has been disabled. Contact an administrator.');
  }

  const now = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
  user.lastLoginAt = now;

  await activityService.log({
    user: user._id,
    action: 'LOGIN',
    entity: ENTITIES.AUTH,
    entityId: user._id,
    description: `${user.name} signed in`,
    metadata: { ip },
  });

  return { user: toSafeUser(user), token: signToken(user._id) };
};

/** Only name and email can be changed here. Role/status can never be changed through this route. */
const updateProfile = async (userId, { name, email }) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  await user.save(); // duplicate email -> unique index -> 409 from errorHandler

  await activityService.log({
    user: user._id,
    action: 'PROFILE_UPDATED',
    entity: ENTITIES.USER,
    entityId: user._id,
    description: `${user.name} updated their profile`,
  });

  return toSafeUser(user);
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  const matches = await user.comparePassword(currentPassword);
  if (!matches) {
    // 400 (not 401) so the frontend does not treat it as an expired session
    throw ApiError.badRequest('Current password is incorrect', [
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }

  user.password = newPassword; // hashed by the User model hook, also invalidates older tokens
  await user.save();

  await activityService.log({
    user: user._id,
    action: 'PASSWORD_CHANGED',
    entity: ENTITIES.USER,
    entityId: user._id,
    description: `${user.name} changed their password`,
  });

  return user;
};

module.exports = { login, updateProfile, changePassword, toSafeUser };