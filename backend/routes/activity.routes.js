const express = require('express');
const controller = require('../controllers/activity.controller');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { activityListQuerySchema } = require('../validators/activity.validator');

const router = express.Router();

router.use(protect);

// Admin only (ACTIVITIES_VIEW is not given to managers or sales staff)
router.get('/', authorize(P.ACTIVITIES_VIEW), validate(activityListQuerySchema, 'query'), controller.list);

module.exports = router;