const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  billId: {
    type: String,
    unique: true,
    required: true,
    default: () => 'BILL' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 3).toUpperCase()
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  items: [{
    description: String,
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      enum: ['consultation', 'medication', 'lab_test', 'procedure', 'equipment', 'other']
    }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  paid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'insurance', 'online', 'other']
  },
  insurance: {
    provider: String,
    policyNumber: String,
    coverage: Number,
    deductible: Number
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String
}, {
  timestamps: true
});

billingSchema.index({ billId: 1 });
billingSchema.index({ patient: 1, status: 1 });
billingSchema.index({ dueDate: 1, status: 1 });

// Calculate totals before saving
billingSchema.pre('save', function(next) {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate total
  this.total = this.subtotal + this.tax - this.discount;
  
  // Calculate balance
  this.balance = this.total - this.paid;
  
  // Update status based on payment
  if (this.balance <= 0) {
    this.status = 'paid';
  } else if (this.paid > 0) {
    this.status = 'partial';
  } else if (new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  
  next();
});

module.exports = mongoose.model('Billing', billingSchema); 