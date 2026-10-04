const asyncHandler = require('../utils/asyncHandler');
const { sendPaginated } = require('../utils/apiResponse');
const activityService = require('../services/activity.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await activityService.list(req.query);
  sendPaginated(res, { items, pagination });
});

module.exports = { list };