const mongoose = require('mongoose');
const { RECORD_STATUS } = require('../config/constants');

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
      minlength: [2, 'Brand name must be at least 2 characters'],
      maxlength: [60, 'Brand name cannot exceed 60 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
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

brandSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
brandSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Brand', brandSchema);