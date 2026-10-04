const { Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { paginate } = require('../utils/paginate');
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

/** Tells managers a purchase was received (stock was added). Always called inside the purchase transaction. */
const notifyPurchaseCompleted = async ({ purchase, supplierName, user }, session) => {
  const [notification] = await Notification.create(
    [
      {
        type: NOTIFICATION_TYPES.PURCHASE_COMPLETED,
        severity: NOTIFICATION_SEVERITY.SUCCESS,
        title: 'Purchase received',
        message: `${user.name} received purchase ${purchase.invoiceNumber} from ${supplierName} (${purchase.items.length} item(s), total ${purchase.grandTotal}).`,
        targetRoles: [ROLES.ADMIN, ROLES.MANAGER],
        entityModel: 'Purchase',
        entityId: purchase._id,
      },
    ],
    { session }
  );

  return notification;
};

/** Tells managers a sale was completed. Always called inside the sale transaction. */
const notifySaleCompleted = async ({ sale, user }, session) => {
  const [notification] = await Notification.create(
    [
      {
        type: NOTIFICATION_TYPES.SALE_COMPLETED,
        severity: NOTIFICATION_SEVERITY.SUCCESS,
        title: 'Sale completed',
        message: `${user.name} completed sale ${sale.invoiceNumber} (${sale.items.length} item(s), total ${sale.grandTotal}).`,
        targetRoles: [ROLES.ADMIN, ROLES.MANAGER],
        entityModel: 'Sale',
        entityId: sale._id,
      },
    ],
    { session }
  );

  return notification;
};

// ---------- Reading notifications (the bell in the top bar) ----------

/** A notification is visible to a user when the user's role is in targetRoles. */
const visibleTo = (user) => ({ targetRoles: user.role });

/** Read state is stored per user in `readBy`; the client only receives a simple `read` flag. */
const toDto = (doc, user) => {
  const dto = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  if (!dto.id && dto._id) dto.id = String(dto._id);
  const userId = String(user._id);
  dto.read = (dto.readBy || []).some((id) => String(id) === userId);
  delete dto.readBy;
  return dto;
};

const list = async (query, user) => {
  const filter = { ...visibleTo(user) };
  if (query.type) filter.type = query.type;
  if (query.unread === true || query.unread === 'true') filter.readBy = { $ne: user._id };

  const { items, pagination } = await paginate(Notification, filter, {
    query,
    allowedSort: ['createdAt'],
    defaultSort: { createdAt: -1 },
    populate: [],
  });

  return { items: items.map((doc) => toDto(doc, user)), pagination };
};

const unreadCount = async (user) =>
  Notification.countDocuments({ ...visibleTo(user), readBy: { $ne: user._id } });

const markRead = async (id, user) => {
  const result = await Notification.updateOne(
    { _id: id, ...visibleTo(user) },
    { $addToSet: { readBy: user._id } }
  );
  if (result.matchedCount === 0) throw ApiError.notFound('Notification not found');
};

const markAllRead = async (user) => {
  const result = await Notification.updateMany(
    { ...visibleTo(user), readBy: { $ne: user._id } },
    { $addToSet: { readBy: user._id } }
  );
  return result.modifiedCount;
};

module.exports = {
  notifyStockLevel,
  notifyPurchaseCompleted,
  notifySaleCompleted,
  list,
  unreadCount,
  markRead,
  markAllRead,
};