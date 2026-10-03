const mongoose = require('mongoose');
const { PURCHASE_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } = require('../config/constants');
const { round2 } = require('../utils/money');

const money = (extra = {}) => ({
  type: Number,
  min: 0,
  default: 0,
  set: round2,
  ...extra,
});

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    purchasePrice: money({ required: true }),
    lineTotal: money({ required: true }),
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema({
  amount: money({ required: true, min: 0.01 }),
  method: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    default: PAYMENT_METHODS.CASH,
  },
  date: { type: Date, default: Date.now },
  note: { type: String, trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const purchaseSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    purchaseDate: { type: Date, default: Date.now },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A purchase must contain at least one item',
      },
    },
    subtotal: money({ required: true }),
    discount: money(), // amount
    tax: money(), // amount
    grandTotal: money({ required: true }),
    status: {
      type: String,
      enum: Object.values(PURCHASE_STATUS),
      default: PURCHASE_STATUS.RECEIVED,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    paidAmount: money(),
    payments: [paymentSchema],
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receivedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
  }
);

purchaseSchema.virtual('dueAmount').get(function dueAmount() {
  return round2(Math.max(0, this.grandTotal - this.paidAmount));
});

purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ supplier: 1, purchaseDate: -1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ 'items.product': 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);