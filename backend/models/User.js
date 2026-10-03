const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { ROLES, USER_STATUS } = require('../config/constants');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    },
    // Never returned by default. Use .select('+passwordHash') when verifying a login.
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: { values: Object.values(ROLES), message: 'Invalid role' },
      default: ROLES.SALES_STAFF,
    },
    status: {
      type: String,
      enum: { values: Object.values(USER_STATUS), message: 'Invalid status' },
      default: USER_STATUS.ACTIVE,
    },
    lastLoginAt: Date,
    // Tokens issued before this moment are rejected (set on password change).
    passwordChangedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

/**
 * Set `user.password = 'plain text'` and save: the value is validated,
 * hashed with bcrypt and stored in passwordHash. The plain text is never persisted.
 */
userSchema.virtual('password').set(function setPassword(value) {
  this._plainPassword = value;
});

userSchema.pre('validate', async function hashPasswordIfNeeded() {
  if (this._plainPassword !== undefined) {
    const plain = String(this._plainPassword);
    if (plain.length < 8) {
      this.invalidate('password', 'Password must be at least 8 characters');
    } else if (plain.length > 72) {
      // bcrypt ignores everything after 72 bytes
      this.invalidate('password', 'Password cannot exceed 72 characters');
    } else {
      this.passwordHash = await bcrypt.hash(plain, env.bcryptSaltRounds);
      if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
    }
    this._plainPassword = undefined;
  }

  if (this.isNew && !this.passwordHash) {
    this.invalidate('password', 'Password is required');
  }
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(String(candidate), this.passwordHash);
};

/** True if the password was changed after the JWT was issued (iat is in seconds). */
userSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;
  return Math.floor(this.passwordChangedAt.getTime() / 1000) > jwtIssuedAt;
};

module.exports = mongoose.model('User', userSchema);