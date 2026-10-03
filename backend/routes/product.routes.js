const express = require('express');
const controller = require('../controllers/product.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createProductSchema,
  updateProductSchema,
  statusBodySchema,
  productListQuerySchema,
  lookupQuerySchema,
} = require('../validators/product.validator');

const router = express.Router();

router.use(protect);

// "/lookup" must be declared before "/:id"
router.get('/lookup', authorize(P.PRODUCTS_READ), validate(lookupQuerySchema, 'query'), controller.lookup);

router.get('/', authorize(P.PRODUCTS_READ), validate(productListQuerySchema, 'query'), controller.list);
router.post('/', authorize(P.PRODUCTS_CREATE), validate(createProductSchema), controller.create);

router.get('/:id', authorize(P.PRODUCTS_READ), validate(idParamSchema, 'params'), controller.getById);
router.patch(
  '/:id/status',
  authorize(P.PRODUCTS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(statusBodySchema),
  controller.setStatus
);
router.patch(
  '/:id',
  authorize(P.PRODUCTS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  controller.update
);
router.delete('/:id', authorize(P.PRODUCTS_DELETE), validate(idParamSchema, 'params'), controller.remove);

module.exports = router;