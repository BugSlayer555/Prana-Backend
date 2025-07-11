const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema({
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  relationship: {
    type: String,
    required: true,
    enum: ['spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'other']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster lookups
familyMemberSchema.index({ requesterId: 1, requestedId: 1 }, { unique: true });
familyMemberSchema.index({ status: 1 });
familyMemberSchema.index({ requesterId: 1, status: 1 });
familyMemberSchema.index({ requestedId: 1, status: 1 });

module.exports = mongoose.model('FamilyMember', familyMemberSchema); 