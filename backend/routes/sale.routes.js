const express = require('express');
const controller = require('../controllers/sale.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P, hasPermission } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { createSaleSchema, saleListQuerySchema } = require('../validators/sale.validator');

const router = express.Router();

router.use(protect);

/**
 * Reading sales needs "sales:read_all" OR "sales:read_own". The service then limits sales staff
 * to their own sales; this middleware only decides which permission to enforce.
 */
const readSales = (req, res, next) =>
  authorize(hasPermission(req.user.role, P.SALES_READ_ALL) ? P.SALES_READ_ALL : P.SALES_READ_OWN)(req, res, next);

router.get('/', readSales, validate(saleListQuerySchema, 'query'), controller.list);
router.post('/', authorize(P.SALES_CREATE), validate(createSaleSchema), controller.create);
router.get('/:id', readSales, validate(idParamSchema, 'params'), controller.getById);

module.exports = router;