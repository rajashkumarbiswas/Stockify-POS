const mongoose = require('mongoose');
const { ENTITIES } = require('../config/constants');

/**
 * Audit log of important actions, e.g.
 * { action: 'PRODUCT_PRICE_CHANGED', entity: 'PRODUCT', description: 'Admin changed price of ...' }
 */
const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // empty for failed logins
    action: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    entity: { type: String, enum: Object.values(ENTITIES), required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true, versionKey: false },
  }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ entity: 1, entityId: 1 });
activitySchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);