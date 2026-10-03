const express = require('express');
const controller = require('../controllers/inventory.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const {
  adjustStockSchema,
  stockListQuerySchema,
  movementListQuerySchema,
} = require('../validators/inventory.validator');

const router = express.Router();

router.use(protect);

router.get('/summary', authorize(P.INVENTORY_READ), controller.getSummary);
router.get('/movements', authorize(P.INVENTORY_READ), validate(movementListQuerySchema, 'query'), controller.listMovements);
router.get('/', authorize(P.INVENTORY_READ), validate(stockListQuerySchema, 'query'), controller.listStock);
router.post('/adjust', authorize(P.INVENTORY_ADJUST), validate(adjustStockSchema), controller.adjust);

module.exports = router;