const express = require('express');
const controller = require('../controllers/customer.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createCustomerSchema,
  updateCustomerSchema,
  customerListQuerySchema,
} = require('../validators/customer.validator');

const router = express.Router();

router.use(protect);

router.get('/', authorize(P.CUSTOMERS_READ), validate(customerListQuerySchema, 'query'), controller.list);
router.post('/', authorize(P.CUSTOMERS_CREATE), validate(createCustomerSchema), controller.create);

router.get('/:id', authorize(P.CUSTOMERS_READ), validate(idParamSchema, 'params'), controller.getById);
router.patch(
  '/:id',
  authorize(P.CUSTOMERS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updateCustomerSchema),
  controller.update
);
router.delete('/:id', authorize(P.CUSTOMERS_DELETE), validate(idParamSchema, 'params'), controller.remove);

module.exports = router;