const mongoose = require('mongoose');
const {
  PAYMENT_METHODS,
  SALE_STATUS,
  DISCOUNT_TYPES,
} = require('../config/constants');
const { round2 } = require('../utils/money');

const money = (extra = {}) => ({
  type: Number,
  min: 0,
  default: 0,
  set: round2,
  ...extra,
});

/**
 * Items keep a SNAPSHOT of name/SKU/prices at the moment of sale,
 * so old invoices stay correct even if the product is edited or deleted later.
 */
const saleItemSchema = new mongoose.Schema(
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
    unitPrice: money({ required: true }),
    costPrice: money(), // purchase price at sale time, used for profit reports
    lineTotal: money({ required: true }),
    returnedQuantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, // empty = walk-in
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A sale must contain at least one item',
      },
    },
    subtotal: money({ required: true }),
    discount: {
      type: {
        type: String,
        enum: Object.values(DISCOUNT_TYPES),
        default: DISCOUNT_TYPES.FIXED,
      },
      value: money(), // what the cashier entered (percent or amount)
      amount: money(), // resulting discount in currency, calculated by the backend
    },
    taxRate: money(), // percent, copied from settings at sale time
    taxAmount: money(),
    grandTotal: money({ required: true }),
    paymentMethod: {
      type: String,
      enum: { values: Object.values(PAYMENT_METHODS), message: 'Invalid payment method' },
      required: true,
    },
    amountPaid: money(),
    dueAmount: money(), // grandTotal - amountPaid (only allowed for registered customers)
    status: {
      type: String,
      enum: Object.values(SALE_STATUS),
      default: SALE_STATUS.COMPLETED,
    },
    totalRefunded: money(),
    notes: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
  }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashier: 1, createdAt: -1 });
saleSchema.index({ customer: 1, createdAt: -1 });
saleSchema.index({ paymentMethod: 1, createdAt: -1 });
saleSchema.index({ status: 1 });
saleSchema.index({ 'items.product': 1 });

module.exports = mongoose.model('Sale', saleSchema);