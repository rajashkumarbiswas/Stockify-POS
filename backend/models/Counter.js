const mongoose = require('mongoose');

/**
 * Atomic sequence generator for human-readable document numbers:
 *   INV-2026-000001 (sales), PUR-2026-000001 (purchases), RET-2026-000001 (returns)
 *
 * Pass the transaction session so a rolled-back sale does not burn a number.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

counterSchema.statics.generateNumber = async function generateNumber(prefix, session) {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;

  const counter = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  return `${key}-${String(counter.seq).padStart(6, '0')}`;
};

module.exports = mongoose.model('Counter', counterSchema);