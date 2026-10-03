const mongoose = require('mongoose');
const { MOVEMENT_TYPES } = require('../config/constants');

/**
 * Append-only audit trail of every stock change.
 * Records are created by inventory.service and are never edited or deleted by the API.
 * `quantity` is always a positive magnitude; the direction comes from `type`
 * (and from newStock - previousStock).
 */
const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: {
      type: String,
      enum: { values: Object.values(MOVEMENT_TYPES), message: 'Invalid movement type' },
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, maxlength: 300 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referenceModel: { type: String, enum: ['Sale', 'Purchase', 'Return'] },
    referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'referenceModel' },
  },
  {
    collection: 'stock_movements',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true, versionKey: false },
  }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ user: 1, createdAt: -1 });
stockMovementSchema.index({ referenceModel: 1, referenceId: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);