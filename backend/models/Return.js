const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/constants');
const { round2 } = require('../utils/money');

const money = (extra = {}) => ({
  type: Number,
  min: 0,
  default: 0,
  set: round2,
  ...extra,
});

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Return quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    unitRefund: money({ required: true }), // net refund per unit (after discount share, plus tax share)
    lineRefund: money({ required: true }),
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    invoiceNumber: { type: String, required: true, trim: true }, // snapshot of the sale invoice
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: {
      type: [returnItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A return must contain at least one item',
      },
    },
    refundAmount: money({ required: true }),
    refundMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      default: PAYMENT_METHODS.CASH,
    },
    reason: { type: String, trim: true, maxlength: 300 },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
  }
);

returnSchema.index({ sale: 1 });
returnSchema.index({ invoiceNumber: 1 });
returnSchema.index({ createdAt: -1 });
returnSchema.index({ processedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Return', returnSchema);