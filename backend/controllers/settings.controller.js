const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const settingsService = require('../services/settings.service');

const get = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await settingsService.get() });
});

const update = asyncHandler(async (req, res) => {
  const data = await settingsService.update(req.body, req.user);
  sendSuccess(res, { data, message: 'Settings saved' });
});

module.exports = { get, update };