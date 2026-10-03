const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');
const inventoryService = require('../services/inventory.service');

const listStock = asyncHandler(async (req, res) => {
  const { items, pagination } = await inventoryService.listStock(req.query);
  sendPaginated(res, { items, pagination });
});

const getSummary = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await inventoryService.getSummary() });
});

const listMovements = asyncHandler(async (req, res) => {
  const { items, pagination } = await inventoryService.listMovements(req.query);
  sendPaginated(res, { items, pagination });
});

const adjust = asyncHandler(async (req, res) => {
  const { product, movement } = await inventoryService.adjustManually(req.body, req.user);
  sendSuccess(res, {
    message: 'Stock updated',
    data: { product: product.toJSON(), movement: movement.toJSON() },
  });
});

module.exports = { listStock, getSummary, listMovements, adjust };