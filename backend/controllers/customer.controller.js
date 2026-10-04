const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');
const customerService = require('../services/customer.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await customerService.list(req.query);
  sendPaginated(res, { items, pagination });
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await customerService.getById(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  const data = await customerService.create(req.body, req.user);
  sendCreated(res, { data, message: 'Customer created' });
});

const update = asyncHandler(async (req, res) => {
  const data = await customerService.update(req.params.id, req.body, req.user);
  sendSuccess(res, { data, message: 'Customer updated' });
});

const remove = asyncHandler(async (req, res) => {
  await customerService.remove(req.params.id, req.user);
  sendSuccess(res, { message: 'Customer deleted' });
});

module.exports = { list, getById, create, update, remove };