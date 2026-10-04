const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');
const saleService = require('../services/sale.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await saleService.list(req.query, req.user);
  sendPaginated(res, { items, pagination });
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await saleService.getById(req.params.id, req.user) });
});

const create = asyncHandler(async (req, res) => {
  const data = await saleService.create(req.body, req.user);
  sendCreated(res, { data, message: 'Sale completed' });
});

module.exports = { list, getById, create };