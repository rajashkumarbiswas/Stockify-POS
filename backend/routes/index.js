const express = require('express');
const mongoose = require('mongoose');
const { sendSuccess } = require('../utils/apiResponse');

const router = express.Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  sendSuccess(res, {
    message: 'Stockify-POS API is running',
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      database: DB_STATES[mongoose.connection.readyState] || 'unknown',
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', require('./auth.routes'));
router.use('/categories', require('./category.routes'));
router.use('/brands', require('./brand.routes'));
router.use('/products', require('./product.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/sales', require('./sale.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/suppliers', require('./supplier.routes'));
router.use('/purchases', require('./purchase.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/activities', require('./activity.routes'));
router.use('/settings', require('./settings.routes'));
// Later phases mount: customers, sales, returns, reports...

module.exports = router;