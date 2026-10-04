const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');
const notificationService = require('../services/notification.service');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await notificationService.list(req.query, req.user);
  sendPaginated(res, { items, pagination });
});

const unreadCount = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { count: await notificationService.unreadCount(req.user) } });
});

const markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.params.id, req.user);
  sendSuccess(res, { message: 'Notification marked as read' });
});

const markAllRead = asyncHandler(async (req, res) => {
  const updated = await notificationService.markAllRead(req.user);
  sendSuccess(res, { data: { updated }, message: 'All notifications marked as read' });
});

module.exports = { list, unreadCount, markRead, markAllRead };