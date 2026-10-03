const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');
const productService = require('../services/product.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await productService.list(req.query, req.user);
  sendPaginated(res, { items, pagination });
});

const lookup = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await productService.lookup(req.query.code, req.user) });
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await productService.getById(req.params.id, req.user) });
});

const create = asyncHandler(async (req, res) => {
  const data = await productService.create(req.body, req.user);
  sendCreated(res, { data, message: 'Product created' });
});

const update = asyncHandler(async (req, res) => {
  const data = await productService.update(req.params.id, req.body, req.user);
  sendSuccess(res, { data, message: 'Product updated' });
});

const setStatus = asyncHandler(async (req, res) => {
  const data = await productService.setStatus(req.params.id, req.body.status, req.user);
  sendSuccess(res, { data, message: `Product ${data.status === 'ACTIVE' ? 'activated' : 'deactivated'}` });
});

const remove = asyncHandler(async (req, res) => {
  await productService.remove(req.params.id, req.user);
  sendSuccess(res, { message: 'Product deleted' });
});

module.exports = { list, lookup, getById, create, update, setStatus, remove };