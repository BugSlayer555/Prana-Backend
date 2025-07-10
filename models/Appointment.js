const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    unique: true,
    required: true,
    default: () => 'APT' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 3).toUpperCase()
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 30, // minutes
    enum: [15, 30, 45, 60, 90, 120]
  },
  type: {
    type: String,
    required: true,
    enum: ['consultation', 'check-up', 'emergency', 'follow-up', 'surgery', 'lab_test']
  },
  status: {
    type: String,
    required: true,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  reason: {
    type: String,
    required: true
  },
  symptoms: [String],
  diagnosis: String,
  treatment: String,
  prescription: [{
    medication: String,
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderDate: Date
}, {
  timestamps: true
});

appointmentSchema.index({ appointmentId: 1 });
appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ doctor: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema); 