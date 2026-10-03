const mongoose = require('mongoose');
const { RECORD_STATUS } = require('../config/constants');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [60, 'Category name cannot exceed 60 characters'],
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

// Case-insensitive uniqueness: "Phones" and "phones" are the same category
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
categorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Category', categorySchema);