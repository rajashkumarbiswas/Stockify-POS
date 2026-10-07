const express = require('express');
const controller = require('../controllers/report.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { reportQuerySchema } = require('../validators/report.validator');

const router = express.Router();

router.use(protect);

// Admin and manager only (REPORTS_VIEW is not given to sales staff)
router.get('/sales', authorize(P.REPORTS_VIEW), validate(reportQuerySchema, 'query'), controller.sales);
router.get('/products', authorize(P.REPORTS_VIEW), validate(reportQuerySchema, 'query'), controller.products);
router.get('/purchases', authorize(P.REPORTS_VIEW), validate(reportQuerySchema, 'query'), controller.purchases);

module.exports = router;