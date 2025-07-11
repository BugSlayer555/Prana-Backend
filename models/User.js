const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    unique: true,
    required: true,
    default: () => 'USR' + crypto.randomBytes(4).toString('hex').toUpperCase()
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'doctor', 'nurse', 'receptionist', 'pharmacy', 'patient'],
    default: 'patient'
  },
  department: {
    type: String,
    required: function() { return this.role !== 'patient'; },
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  // Patient-specific fields
  dateOfBirth: {
    type: Date,
    required: function() { return this.role === 'patient'; }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: function() { return this.role === 'patient'; }
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: function() { return this.role === 'patient'; }
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  familyMembers: [{
    name: String,
    relationship: String,
    phone: String,
    dateOfBirth: Date,
    bloodGroup: String
  }],
  // Staff-specific fields
  specialization: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  licenseNumber: {
    type: String
  },
  experience: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  salary: {
    type: Number,
    default: 0
  },
  hireDate: {
    type: Date,
    required: function() { return this.role !== 'patient'; },
    default: Date.now
  },
  // Permission and status fields
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: function() { return this.role === 'patient'; } // Only patients are auto-approved
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.role !== 'patient' && this.isApproved; }
  },
  approvedAt: {
    type: Date,
    required: function() { return this.role !== 'patient' && this.isApproved; }
  },
  verificationToken: {
    type: String
  },
  // Additional fields for better management
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster lookups
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ uniqueId: 1 });
userSchema.index({ role: 1, isApproved: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Method to check if user is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

module.exports = mongoose.model('User', userSchema);
