const express = require('express');
const controller = require('../controllers/purchase.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createPurchaseSchema,
  paymentBodySchema,
  purchaseListQuerySchema,
} = require('../validators/purchase.validator');

const router = express.Router();

router.use(protect);

router.get('/', authorize(P.PURCHASES_READ), validate(purchaseListQuerySchema, 'query'), controller.list);
router.post('/', authorize(P.PURCHASES_CREATE), validate(createPurchaseSchema), controller.create);

router.get('/:id', authorize(P.PURCHASES_READ), validate(idParamSchema, 'params'), controller.getById);
router.patch('/:id/receive', authorize(P.PURCHASES_UPDATE), validate(idParamSchema, 'params'), controller.receive);
router.patch('/:id/cancel', authorize(P.PURCHASES_UPDATE), validate(idParamSchema, 'params'), controller.cancel);
router.post(
  '/:id/payments',
  authorize(P.PURCHASES_UPDATE),
  validate(idParamSchema, 'params'),
  validate(paymentBodySchema),
  controller.addPayment
);

module.exports = router;