const express = require('express');
const controller = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const {
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require('../validators/auth.validator');

const router = express.Router();

router.post('/login', loginLimiter, validate(loginSchema), controller.login);
router.post('/logout', controller.logout);

router.get('/me', protect, controller.getMe);
router.patch('/profile', protect, validate(updateProfileSchema), controller.updateProfile);
router.patch(
  '/change-password',
  protect,
  validate(changePasswordSchema),
  controller.changePassword
);

module.exports = router;