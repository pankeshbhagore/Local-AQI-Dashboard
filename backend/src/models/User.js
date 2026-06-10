const mongoose = require('mongoose');

/**
 * User Model
 * Stores admin, officer, and citizen accounts.
 * Passwords are stored as bcrypt hashes — never plaintext.
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    passwordHash: {
      type:     String,
      required: [true, 'Password hash is required'],
      select:   false,  // never returned in queries by default
    },
    role: {
      type:    String,
      enum:    ['admin', 'officer', 'citizen', 'superuser'],
      default: 'citizen',
    },
    name: {
      type:    String,
      trim:    true,
      maxlength: 100,
    },
    phone: {
      type:  String,
      trim:  true,
    },
    wardId: {
      type:    Number,
      default: null,  // home ward for citizens
    },
    fcmToken: {
      type:    String,
      default: null,  // Firebase Cloud Messaging push token
    },
    preferences: {
      emailAlerts:  { type: Boolean, default: true  },
      smsAlerts:    { type: Boolean, default: false },
      pushAlerts:   { type: Boolean, default: true  },
      aqiThreshold: { type: Number,  default: 150   },  // alert threshold
    },
    isActive:  { type: Boolean, default: true },
    lastLogin: { type: Date,    default: null },
  },
  {
    timestamps: true,  // createdAt, updatedAt
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ wardId: 1 });

// Virtual: full profile (excludes passwordHash)
userSchema.methods.toPublicJSON = function () {
  return {
    id:          this._id,
    email:       this.email,
    name:        this.name,
    role:        this.role,
    wardId:      this.wardId,
    preferences: this.preferences,
    createdAt:   this.createdAt,
    lastLogin:   this.lastLogin,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
