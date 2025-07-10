const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemId: {
    type: String,
    unique: true,
    required: true,
    default: () => 'INV' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 3).toUpperCase()
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['medication', 'ppe', 'medical_supplies', 'equipment', 'lab_supplies', 'other']
  },
  description: String,
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['pieces', 'boxes', 'bottles', 'packs', 'units', 'kg', 'liters']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  minStock: {
    type: Number,
    required: true,
    min: 0
  },
  maxStock: {
    type: Number,
    min: 0
  },
  supplier: {
    name: String,
    contact: String,
    email: String,
    phone: String
  },
  location: {
    type: String,
    trim: true
  },
  expiryDate: Date,
  batchNumber: String,
  status: {
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock', 'expired', 'discontinued'],
    default: 'in_stock'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

inventorySchema.index({ itemId: 1 });
inventorySchema.index({ name: 1 });
inventorySchema.index({ category: 1, status: 1 });
inventorySchema.index({ expiryDate: 1 });

// Calculate total value before saving
inventorySchema.pre('save', function(next) {
  this.totalValue = this.quantity * this.unitPrice;
  
  // Update status based on quantity
  if (this.quantity <= 0) {
    this.status = 'out_of_stock';
  } else if (this.quantity <= this.minStock) {
    this.status = 'low_stock';
  } else {
    this.status = 'in_stock';
  }
  
  // Check if expired
  if (this.expiryDate && new Date() > this.expiryDate) {
    this.status = 'expired';
  }
  
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema); 