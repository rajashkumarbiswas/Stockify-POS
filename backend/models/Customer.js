const mongoose = require('mongoose');
const { round2 } = require('../utils/money');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyToUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
};

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
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
    // Maintained by the sale/return services, never by the client
    totalPurchases: { type: Number, default: 0, min: 0 }, // number of completed sales
    totalSpent: { type: Number, default: 0, min: 0, set: round2 },
    dueAmount: { type: Number, default: 0, min: 0, set: round2 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
  }
);

customerSchema.index({ name: 1 });
customerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);