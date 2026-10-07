const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const reportService = require('../services/report.service');

const sales = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await reportService.getSalesReport(req.query) });
});

const products = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await reportService.getProductReport(req.query) });
});

const purchases = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await reportService.getPurchaseReport(req.query) });
});

module.exports = { sales, products, purchases };