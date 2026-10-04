const express = require('express');
const controller = require('../controllers/supplier.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createSupplierSchema,
  updateSupplierSchema,
  supplierListQuerySchema,
} = require('../validators/supplier.validator');
const { purchaseListQuerySchema } = require('../validators/purchase.validator');

const router = express.Router();

router.use(protect);

// "/options" must be declared before "/:id"
router.get('/options', authorize(P.SUPPLIERS_READ), controller.options);
router.get('/', authorize(P.SUPPLIERS_READ), validate(supplierListQuerySchema, 'query'), controller.list);
router.post('/', authorize(P.SUPPLIERS_CREATE), validate(createSupplierSchema), controller.create);

router.get('/:id', authorize(P.SUPPLIERS_READ), validate(idParamSchema, 'params'), controller.getById);
router.get(
  '/:id/purchases',
  authorize(P.SUPPLIERS_READ, P.PURCHASES_READ),
  validate(idParamSchema, 'params'),
  validate(purchaseListQuerySchema, 'query'),
  controller.listPurchases
);
router.get(
  '/:id/payments',
  authorize(P.SUPPLIERS_READ, P.PURCHASES_READ),
  validate(idParamSchema, 'params'),
  validate(supplierListQuerySchema, 'query'),
  controller.listPayments
);
router.patch(
  '/:id',
  authorize(P.SUPPLIERS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updateSupplierSchema),
  controller.update
);
router.delete('/:id', authorize(P.SUPPLIERS_DELETE), validate(idParamSchema, 'params'), controller.remove);

module.exports = router;