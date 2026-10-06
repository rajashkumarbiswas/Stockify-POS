const express = require('express');
const controller = require('../controllers/settings.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { updateSettingsSchema } = require('../validators/settings.validator');

const router = express.Router();

router.use(protect);

// Everyone signed in can read the business info (invoices need it); only the admin can change it
router.get('/', authorize(P.SETTINGS_READ), controller.get);
router.patch('/', authorize(P.SETTINGS_UPDATE), validate(updateSettingsSchema), controller.update);

module.exports = router;