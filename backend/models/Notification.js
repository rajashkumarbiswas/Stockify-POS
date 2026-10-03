const mongoose = require('mongoose');
const {
  ROLES,
  NOTIFICATION_TYPES,
  NOTIFICATION_SEVERITY,
} = require('../config/constants');

const NINETY_DAYS_IN_SECONDS = 60 * 60 * 24 * 90;

/**
 * One notification document is shared by every user whose role is in targetRoles.
 * Read state is tracked per user in `readBy`.
 */
const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(NOTIFICATION_SEVERITY),
      default: NOTIFICATION_SEVERITY.INFO,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 400 },
    targetRoles: {
      type: [{ type: String, enum: Object.values(ROLES) }],
      default: [ROLES.ADMIN, ROLES.MANAGER],
    },
    entityModel: { type: String, enum: ['Product', 'Sale', 'Purchase', 'Return'] },
    entityId: { type: mongoose.Schema.Types.ObjectId, refPath: 'entityModel' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true, versionKey: false },
  }
);

notificationSchema.index({ targetRoles: 1, createdAt: -1 });
notificationSchema.index({ readBy: 1 });
notificationSchema.index({ type: 1, entityId: 1 });
// Old notifications are removed automatically after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS_IN_SECONDS });

module.exports = mongoose.model('Notification', notificationSchema);