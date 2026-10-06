const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboard.service');

const summary = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await dashboardService.getSummary(req.user) });
});

const salesChart = asyncHandler(async (req, res) => {
  const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'daily';
  sendSuccess(res, { data: await dashboardService.getSalesChart(req.user, period) });
});

module.exports = { summary, salesChart };