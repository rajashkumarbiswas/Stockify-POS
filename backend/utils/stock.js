const { STOCK_STATUS } = require('../config/constants');

/** Same rule as the Product.stockStatus virtual, usable on plain numbers. */
const getStockStatus = (currentStock, minStockLevel) => {
  if (currentStock <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (currentStock <= minStockLevel) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
};

// Higher number = worse situation. Used to notify only when stock gets worse.
const STOCK_SEVERITY = Object.freeze({
  [STOCK_STATUS.IN_STOCK]: 0,
  [STOCK_STATUS.LOW_STOCK]: 1,
  [STOCK_STATUS.OUT_OF_STOCK]: 2,
});

/** MongoDB filter for ?stockStatus=IN_STOCK | LOW_STOCK | OUT_OF_STOCK */
const buildStockStatusFilter = (stockStatus) => {
  switch (stockStatus) {
    case STOCK_STATUS.IN_STOCK:
      return { $expr: { $gt: ['$currentStock', '$minStockLevel'] } };
    case STOCK_STATUS.LOW_STOCK:
      return { currentStock: { $gt: 0 }, $expr: { $lte: ['$currentStock', '$minStockLevel'] } };
    case STOCK_STATUS.OUT_OF_STOCK:
      return { currentStock: { $lte: 0 } };
    default:
      return null;
  }
};

module.exports = { getStockStatus, STOCK_SEVERITY, buildStockStatusFilter };