const express = require('express');
const controller = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth');
const { authorizeAny } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { salesChartQuerySchema } = require('../validators/dashboard.validator');

const router = express.Router();

router.use(protect);

const canViewDashboard = authorizeAny(P.DASHBOARD_VIEW_ALL, P.DASHBOARD_VIEW_OWN);

router.get('/summary', canViewDashboard, controller.summary);
router.get('/sales-chart', canViewDashboard, validate(salesChartQuerySchema, 'query'), controller.salesChart);

module.exports = router;