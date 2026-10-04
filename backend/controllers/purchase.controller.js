const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');
const purchaseService = require('../services/purchase.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await purchaseService.list(req.query);
  sendPaginated(res, { items, pagination });
});

const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await purchaseService.getById(req.params.id) });
});

const create = asyncHandler(async (req, res) => {
  const data = await purchaseService.create(req.body, req.user);
  sendCreated(res, {
    data,
    message: data.status === 'RECEIVED' ? 'Purchase completed and stock updated' : 'Purchase order created',
  });
});

const receive = asyncHandler(async (req, res) => {
  const data = await purchaseService.receive(req.params.id, req.user);
  sendSuccess(res, { data, message: 'Purchase received and stock updated' });
});

const cancel = asyncHandler(async (req, res) => {
  const data = await purchaseService.cancel(req.params.id, req.user);
  sendSuccess(res, { data, message: 'Purchase cancelled' });
});

const addPayment = asyncHandler(async (req, res) => {
  const data = await purchaseService.addPayment(req.params.id, req.body, req.user);
  sendCreated(res, { data, message: 'Payment recorded' });
});

module.exports = { list, getById, create, receive, cancel, addPayment };