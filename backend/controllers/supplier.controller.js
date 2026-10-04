const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');
const supplierService = require('../services/supplier.service');
const purchaseService = require('../services/purchase.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await supplierService.list(req.query);
  sendPaginated(res, { items, pagination });
});

const options = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await supplierService.options() });
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await supplierService.getById(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  const data = await supplierService.create(req.body, req.user);
  sendCreated(res, { data, message: 'Supplier created' });
});

const update = asyncHandler(async (req, res) => {
  const data = await supplierService.update(req.params.id, req.body, req.user);
  sendSuccess(res, { data, message: 'Supplier updated' });
});

const remove = asyncHandler(async (req, res) => {
  await supplierService.remove(req.params.id, req.user);
  sendSuccess(res, { message: 'Supplier deleted' });
});

const listPurchases = asyncHandler(async (req, res) => {
  await supplierService.assertExists(req.params.id);
  const { items, pagination } = await purchaseService.list({ ...req.query, supplier: req.params.id });
  sendPaginated(res, { items, pagination });
});

const listPayments = asyncHandler(async (req, res) => {
  const { items, pagination } = await supplierService.listPayments(req.params.id, req.query);
  sendPaginated(res, { items, pagination });
});

module.exports = { list, options, getById, create, update, remove, listPurchases, listPayments };