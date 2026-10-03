const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const authService = require('../services/auth.service');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/token');

const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body, { ip: req.ip });
  setAuthCookie(res, token);
  sendSuccess(res, { message: 'Login successful', data: { user } });
});

// Intentionally public: it must always be able to clear a stale or expired cookie
const logout = (req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, { message: 'Logged out successfully' });
};

const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { user: authService.toSafeUser(req.user) } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body);
  sendSuccess(res, { message: 'Profile updated', data: { user } });
});

const changePassword = asyncHandler(async (req, res) => {
  const user = await authService.changePassword(req.user._id, req.body);
  // Older tokens are now invalid, so issue a fresh one to keep this session signed in
  setAuthCookie(res, signToken(user._id));
  sendSuccess(res, { message: 'Password changed successfully' });
});

module.exports = { login, logout, getMe, updateProfile, changePassword };