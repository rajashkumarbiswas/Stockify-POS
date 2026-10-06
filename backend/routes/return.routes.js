const express = require('express');
const controller = require('../controllers/return.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { createReturnSchema, returnListQuerySchema } = require('../validators/return.validator');

const router = express.Router();

router.use(protect);

router.get('/', authorize(P.RETURNS_READ), validate(returnListQuerySchema, 'query'), controller.list);
router.post('/', authorize(P.RETURNS_CREATE), validate(createReturnSchema), controller.create);
router.get('/:id', authorize(P.RETURNS_READ), validate(idParamSchema, 'params'), controller.getById);

module.exports = router;