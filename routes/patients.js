const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Billing = require('../models/Billing');
const router = express.Router();
const jwt = require('jsonwebtoken');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Middleware to check if user is approved
const checkApproval = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.isApproved && user.role !== 'patient') {
      return res.status(403).json({ 
        message: 'Your account is pending approval. Please contact the administrator.',
        needsApproval: true 
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to check permissions for patient access
const checkPatientAccess = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const user = await User.findById(req.user.id);
    
    // Admin, doctor, nurse, receptionist can access all patients
    if (['admin', 'doctor', 'nurse', 'receptionist'].includes(user.role)) {
      return next();
    }
    
    // Patients can only access their own data
    if (user.role === 'patient') {
      const patient = await Patient.findById(patientId);
      if (!patient || patient.userId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Access denied. You can only view your own data.' });
      }
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @route   GET /api/patients
// @desc    Get all patients (with filters)
// @access  Private (Admin, Doctor, Nurse, Receptionist)
router.get('/', auth, checkApproval, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check if user has permission to view all patients
    if (!['admin', 'doctor', 'nurse', 'receptionist'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { search, status, bloodGroup, page = 1, limit = 10 } = req.query;
    
    // Build query
    let query = { role: 'patient' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.isActive = status === 'active';
    }
    
    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    const skip = (page - 1) * limit;
    
    const patients = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      patients,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalRecords: total
      }
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/patients/:id
// @desc    Get patient by ID
// @access  Private (with permission check)
router.get('/:id', auth, checkApproval, checkPatientAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    const patient = await User.findById(id).select('-password');
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get additional patient data
    const patientData = await Patient.findOne({ userId: id });
    const appointments = await Appointment.find({ patient: id }).populate('doctor', 'name');
    const bills = await Billing.find({ patient: id });

    res.json({
      patient,
      patientData,
      appointments,
      bills
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patients
// @desc    Create a new patient
// @access  Private (Admin, Doctor, Nurse, Receptionist)
router.post('/', [
  auth,
  checkApproval,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('dateOfBirth').notEmpty().withMessage('Date of birth is required'),
  body('gender').notEmpty().withMessage('Gender is required'),
  body('bloodGroup').notEmpty().withMessage('Blood group is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.user.id);
    if (!['admin', 'doctor', 'nurse', 'receptionist'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { 
      name, email, phone, address, dateOfBirth, gender, bloodGroup, 
      emergencyContact, familyMembers 
    } = req.body;

    // Check if email already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if phone already exists
    existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // Create new patient user
    const newPatient = new User({
      name,
      email,
      password: hashedPassword,
      role: 'patient',
      phone,
      address,
      dateOfBirth,
      gender,
      bloodGroup,
      emergencyContact,
      familyMembers,
      isVerified: true,
      isApproved: true
    });

    await newPatient.save();

    // Create patient record
    const patientRecord = new Patient({
      userId: newPatient._id
    });
    await patientRecord.save();

    const { password, ...patientWithoutPassword } = newPatient._doc;

    res.status(201).json({
      message: 'Patient created successfully',
      patient: patientWithoutPassword,
      tempPassword,
      note: 'Please provide the temporary password to the patient for first login'
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/patients/:id
// @desc    Update patient
// @access  Private (with permission check)
router.put('/:id', [
  auth,
  checkApproval,
  checkPatientAccess,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('phone').notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if email is being changed and if it's already taken
    if (updateData.email) {
      const existingUser = await User.findOne({ email: updateData.email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }
    }

    // Check if phone is being changed and if it's already taken
    if (updateData.phone) {
      const existingUser = await User.findOne({ phone: updateData.phone, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }
    }

    const patient = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({
      message: 'Patient updated successfully',
      patient
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/patients/:id
// @desc    Delete patient (soft delete)
// @access  Private (Admin only)
router.delete('/:id', auth, checkApproval, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { id } = req.params;
    
    const patient = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({
      message: 'Patient deactivated successfully',
      patient
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/patients/:id/family-member
// @desc    Add family member to patient
// @access  Private (with permission check)
router.post('/:id/family-member', [
  auth,
  checkApproval,
  checkPatientAccess,
  body('name').notEmpty().withMessage('Name is required'),
  body('relationship').notEmpty().withMessage('Relationship is required'),
  body('phone').notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, relationship, phone, dateOfBirth, bloodGroup } = req.body;

    const patient = await User.findById(id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    patient.familyMembers.push({
      name,
      relationship,
      phone,
      dateOfBirth,
      bloodGroup
    });

    await patient.save();

    res.json({
      message: 'Family member added successfully',
      familyMembers: patient.familyMembers
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/patients/:id/unique-id
// @desc    Get patient's unique ID
// @access  Private (with permission check)
router.get('/:id/unique-id', auth, checkApproval, checkPatientAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    const patient = await User.findById(id).select('uniqueId name');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({
      uniqueId: patient.uniqueId,
      name: patient.name
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
