const express = require('express');
const controller = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { notificationListQuerySchema } = require('../validators/notification.validator');

const router = express.Router();

router.use(protect);

// "/unread-count" and "/read-all" must be declared before "/:id/read"
router.get('/unread-count', authorize(P.NOTIFICATIONS_READ), controller.unreadCount);
router.patch('/read-all', authorize(P.NOTIFICATIONS_READ), controller.markAllRead);

router.get('/', authorize(P.NOTIFICATIONS_READ), validate(notificationListQuerySchema, 'query'), controller.list);
router.patch('/:id/read', authorize(P.NOTIFICATIONS_READ), validate(idParamSchema, 'params'), controller.markRead);

module.exports = router;