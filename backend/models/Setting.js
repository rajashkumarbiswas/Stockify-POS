const mongoose = require('mongoose');

const SINGLETON_KEY = 'business';

/**
 * Single-document collection holding business information (shown on invoices)
 * and system-level configuration (tax rate, default low-stock level).
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: SINGLETON_KEY, unique: true, immutable: true },
    businessName: { type: String, default: 'Stockify Store', trim: true, maxlength: 120 },
    address: { type: String, default: '', trim: true, maxlength: 300 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 120 },
    taxId: { type: String, default: '', trim: true, maxlength: 50 },
    currency: { type: String, default: 'BDT', uppercase: true, trim: true, maxlength: 5 },
    currencySymbol: { type: String, default: '৳', trim: true, maxlength: 5 },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    defaultMinStockLevel: { type: Number, default: 5, min: 0 },
    invoiceFooter: {
      type: String,
      default: 'Thank you for your purchase!',
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
  }
);

/** Returns the settings document, creating it with defaults on first use. */
settingSchema.statics.getSingleton = function getSingleton(session) {
  return this.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $setOnInsert: { key: SINGLETON_KEY } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );
};

module.exports = mongoose.model('Setting', settingSchema);