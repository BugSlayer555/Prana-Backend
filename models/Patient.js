const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  patientId: {
    type: String,
    unique: true,
    required: true,
    default: () => 'PAT' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 3).toUpperCase()
  },
  medicalHistory: [{
    condition: String,
    diagnosis: String,
    treatment: String,
    date: Date,
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  allergies: [{
    allergen: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    },
    notes: String
  }],
  medications: [{
    name: String,
    dosage: String,
    frequency: String,
    startDate: Date,
    endDate: Date,
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  appointments: [{
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    date: Date,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no-show']
    }
  }],
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    expiryDate: Date
  },
  emergencyContacts: [{
    name: String,
    relationship: String,
    phone: String,
    email: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  documents: [{
    title: String,
    type: {
      type: String,
      enum: ['medical_record', 'prescription', 'lab_report', 'insurance', 'other']
    },
    fileUrl: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'deceased'],
    default: 'active'
  }
}, {
  timestamps: true
});

patientSchema.index({ patientId: 1 });
patientSchema.index({ userId: 1 });

module.exports = mongoose.model('Patient', patientSchema); 