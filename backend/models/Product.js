const mongoose = require('mongoose');
const { RECORD_STATUS, STOCK_STATUS, PRODUCT_UNITS } = require('../config/constants');
const { round2 } = require('../utils/money');

// Empty strings become undefined so the sparse unique index ignores them
const emptyToUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
};

const isInteger = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [50, 'SKU cannot exceed 50 characters'],
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      set: emptyToUndefined,
      maxlength: [50, 'Barcode cannot exceed 50 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
      set: round2,
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
      set: round2,
    },
    /**
     * IMPORTANT: this field is changed ONLY by services/inventory.service.js
     * (sales, purchases, returns, manual adjustments), always together with a
     * StockMovement record. No controller accepts it from request bodies.
     */
    currentStock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
      validate: isInteger,
    },
    minStockLevel: {
      type: Number,
      default: 5,
      min: [0, 'Minimum stock level cannot be negative'],
      validate: isInteger,
    },
    unit: {
      type: String,
      enum: { values: PRODUCT_UNITS, message: 'Invalid unit' },
      default: 'pcs',
    },
    image: {
      type: String,
      trim: true,
      maxlength: [500, 'Image URL cannot exceed 500 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: Object.values(RECORD_STATUS),
      default: RECORD_STATUS.ACTIVE,
    },
    lastStockUpdateAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true },
  }
);

productSchema.virtual('stockStatus').get(function stockStatus() {
  if (this.currentStock <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (this.currentStock <= this.minStockLevel) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
});

productSchema.index({ name: 1 });
productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ status: 1, currentStock: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);