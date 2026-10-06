const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');
const returnService = require('../services/return.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await returnService.list(req.query);
  sendPaginated(res, { items, pagination });
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await returnService.getById(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  const data = await returnService.create(req.body, req.user);
  sendCreated(res, { data, message: 'Return processed' });
});

module.exports = { list, getById, create };