const mongoose = require('mongoose');
const { RECORD_STATUS } = require('../config/constants');
const { round2 } = require('../utils/money');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyToUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
};

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    company: {
      type: String,
      trim: true,
      maxlength: [120, 'Company cannot exceed 120 characters'],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      set: emptyToUndefined,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      set: emptyToUndefined,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [300, 'Address cannot exceed 300 characters'],
    },
    // Maintained by the purchase service
    dueAmount: { type: Number, default: 0, min: 0, set: round2 }, // we still owe the supplier
    totalPurchases: { type: Number, default: 0, min: 0, set: round2 }, // total value purchased
    status: {
      type: String,
      enum: Object.values(RECORD_STATUS),
      default: RECORD_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
  }
);

supplierSchema.index({ name: 1 });
supplierSchema.index({ company: 1 });
supplierSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Supplier', supplierSchema);