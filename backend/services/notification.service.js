const { Notification } = require('../models');
const { getStockStatus, STOCK_SEVERITY } = require('../utils/stock');
const {
  ROLES,
  STOCK_STATUS,
  NOTIFICATION_TYPES,
  NOTIFICATION_SEVERITY,
} = require('../config/constants');

/**
 * Creates a low-stock / out-of-stock notification ONLY when a product moves to a worse
 * state (in stock -> low, low -> out...). Staying low does not create another one,
 * so managers are not flooded. Pass the transaction session when inside one.
 *
 * (Phase 13 adds list / mark-as-read functions to this file.)
 */
const notifyStockLevel = async ({ product, previousStock }, session) => {
  const before = getStockStatus(previousStock, product.minStockLevel);
  const after = getStockStatus(product.currentStock, product.minStockLevel);

  if (STOCK_SEVERITY[after] <= STOCK_SEVERITY[before]) return null;

  const isOut = after === STOCK_STATUS.OUT_OF_STOCK;

  const [notification] = await Notification.create(
    [
      {
        type: isOut ? NOTIFICATION_TYPES.OUT_OF_STOCK : NOTIFICATION_TYPES.LOW_STOCK,
        severity: isOut ? NOTIFICATION_SEVERITY.DANGER : NOTIFICATION_SEVERITY.WARNING,
        title: isOut ? 'Product out of stock' : 'Product is low on stock',
        message: isOut
          ? `${product.name} (${product.sku}) is out of stock.`
          : `${product.name} (${product.sku}) is running low: ${product.currentStock} ${product.unit} left (minimum ${product.minStockLevel}).`,
        targetRoles: [ROLES.ADMIN, ROLES.MANAGER],
        entityModel: 'Product',
        entityId: product._id,
      },
    ],
    { session }
  );

  return notification;
};

module.exports = { notifyStockLevel };