const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Patient = require('../models/Patient');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// JWT Secret (should be in environment variables in production)
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

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send verification email
const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  // Add timeout to prevent hanging
  const emailPromise = transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Welcome to Prana - Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1C8C8C, #0F5F5F); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to Prana</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Hospital Management System</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${user.name},</h2>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            Thank you for registering with Prana Hospital Management System! We're excited to have you on board.
          </p>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            To complete your registration and access your dashboard, please verify your email address by clicking the button below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #1C8C8C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            If the button doesn't work, you can copy and paste this link into your browser:
          </p>
          
          <p style="background: #e9e9e9; padding: 15px; border-radius: 5px; word-break: break-all; font-size: 14px; color: #333;">
            ${verifyUrl}
          </p>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            <strong>What happens next?</strong><br>
            After verifying your email, you'll be automatically logged in and redirected to your dashboard where you can:
          </p>
          
          <ul style="color: #555; line-height: 1.6; font-size: 16px;">
            <li>Manage patient records and appointments</li>
            <li>Track inventory and billing</li>
            <li>Generate reports and analytics</li>
            <li>Collaborate with your healthcare team</li>
          </ul>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            <strong>Security Note:</strong> This verification link will expire after 24 hours for your security. If you don't verify within this time, you'll need to register again.
          </p>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            If you didn't create an account with Prana, please ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #888; font-size: 14px; text-align: center;">
            Best regards,<br>
            The Prana Team<br>
            <a href="mailto:info@praanhospital.com" style="color: #1C8C8C;">info@praanhospital.com</a>
          </p>
        </div>
      </div>
    `
  });
  // Add timeout of 10 seconds
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Email timeout')), 10000);
  });
  await Promise.race([emailPromise, timeoutPromise]);
};

// Send approval notification email
const sendApprovalEmail = async (user, approved) => {
  const subject = approved ? 'Account Approved - Welcome to Prana' : 'Account Status Update';
  const message = approved 
    ? 'Your account has been approved! You can now access all features of the Prana Hospital Management System.'
    : 'Your account approval is still pending. We will notify you once it is approved.';

  // Add timeout to prevent hanging
  const emailPromise = transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1C8C8C, #0F5F5F); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Prana Hospital</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Account Status Update</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${user.name},</h2>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            ${message}
          </p>
          
          ${approved ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" style="background: #1C8C8C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Login to Dashboard</a>
          </div>
          ` : ''}
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #888; font-size: 14px; text-align: center;">
            Best regards,<br>
            The Prana Team<br>
            <a href="mailto:info@praanhospital.com" style="color: #1C8C8C;">info@praanhospital.com</a>
          </p>
        </div>
      </div>
    `
  });
  // Add timeout of 10 seconds
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Email timeout')), 10000);
  });
  await Promise.race([emailPromise, timeoutPromise]);
};

// @route   POST /api/auth/register
// @desc    Register a new user (admin cannot be registered)
// @access  Public
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().withMessage('Role is required'),
  body('phone').notEmpty().withMessage('Phone number is required').isMobilePhone().withMessage('Please include a valid phone number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, password, role, department, phone, address, dateOfBirth, gender, bloodGroup, specialization, experience } = req.body;

    // Debug logging
    console.log('Registration attempt:', {
      name,
      email,
      role,
      phone,
      address,
      dateOfBirth,
      gender,
      bloodGroup
    });

    // Prevent admin registration
    if (role === 'admin') {
      return res.status(400).json({ message: 'Admin accounts cannot be created through registration' });
    }

    // Check if email already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log('Email already exists:', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if phone number already exists
    let phoneUser = await User.findOne({ phone });
    if (phoneUser) {
      console.log('Phone already exists:', phone);
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Convert dateOfBirth string to Date object if provided
    const parsedDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department: role !== 'patient' ? department : undefined,
      phone,
      address,
      dateOfBirth: role === 'patient' ? parsedDateOfBirth : undefined,
      gender: role === 'patient' ? gender : undefined,
      bloodGroup: role === 'patient' ? bloodGroup : undefined,
      specialization: role === 'doctor' ? specialization : undefined,
      experience: role === 'doctor' ? experience : undefined,
      isVerified: false,
      verificationToken,
      isApproved: role === 'patient' // Only patients are auto-approved
    });

    console.log('Saving user with data:', {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      address: newUser.address,
      dateOfBirth: newUser.dateOfBirth,
      gender: newUser.gender,
      bloodGroup: newUser.bloodGroup
    });

    await newUser.save();
    console.log('User saved successfully with ID:', newUser._id);

    // Create patient record if role is patient
    if (role === 'patient') {
      const patient = new Patient({
        userId: newUser._id
      });
      await patient.save();
    }

    // Send verification email (non-blocking)
    sendVerificationEmail(newUser, verificationToken).catch(emailError => {
      console.log('Email not configured, skipping email verification:', emailError.message);
      // Continue with registration even if email fails
    });

    // Create JWT token
    const payload = {
      id: newUser._id,
      email: newUser.email,
      role: newUser.role
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      
      const { password, ...userWithoutPassword } = newUser._doc;
      
      // Determine message based on email configuration
      let message;
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        message = role === 'patient' ? 'Registration successful! Please verify your email.' : 'Registration successful! Please wait for admin approval after email verification.';
      } else {
        message = role === 'patient' ? 'Registration successful! Please contact admin for account activation.' : 'Registration successful! Please wait for admin approval.';
      }
      
      res.json({
        token,
        user: userWithoutPassword,
        message,
        emailSent: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
      });
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({ message: 'Account is temporarily locked due to too many failed login attempts' });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ message: 'Please verify your email address first' });
    }

    // Check if user is approved (for non-patients)
    if (!user.isApproved && user.role !== 'patient') {
      return res.status(403).json({ 
        message: 'Your account is pending approval. Please contact the administrator.',
        needsApproval: true 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create JWT token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      uniqueId: user.uniqueId
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      
      const { password, ...userWithoutPassword } = user._doc;
      res.json({
        token,
        user: userWithoutPassword
      });
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email address
// @access  Public
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // Create JWT token for automatic login
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      uniqueId: user.uniqueId
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      
      const { password, ...userWithoutPassword } = user._doc;
      res.json({
        token,
        user: userWithoutPassword,
        message: 'Email verified successfully!'
      });
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/user
// @desc    Get current user
// @access  Private
router.get('/user', auth, checkApproval, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/approve-user
// @desc    Approve a user (admin only)
// @access  Private (Admin)
router.post('/approve-user', auth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { userId, approved } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isApproved = approved;
    if (approved) {
      user.approvedBy = admin._id;
      user.approvedAt = new Date();
    }
    
    await user.save();

    // Send approval notification email (non-blocking)
    sendApprovalEmail(user, approved).catch(emailError => {
      console.log('Email not configured, skipping approval email:', emailError.message);
    });

    res.json({ 
      message: approved ? 'User approved successfully' : 'User approval revoked',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/pending-approvals
// @desc    Get pending approvals (admin only)
// @access  Private (Admin)
router.get('/pending-approvals', auth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (admin.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const pendingUsers = await User.find({
      isVerified: true,
      isApproved: false,
      role: { $ne: 'patient' }
    }).select('-password');

    res.json(pendingUsers);

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/create-admin
// @desc    Create initial admin account (use only once)
// @access  Public (but should be protected in production)
router.post('/create-admin', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('adminSecret').notEmpty().withMessage('Admin secret is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, password, adminSecret } = req.body;

    // Check admin secret (you should change this to a secure secret)
    if (adminSecret !== 'PRANA_ADMIN_2024') {
      return res.status(403).json({ message: 'Invalid admin secret' });
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin account already exists' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const adminUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      isApproved: true,
      uniqueId: 'ADMIN001'
    });

    await adminUser.save();

    // Create JWT token
    const payload = {
      id: adminUser._id,
      email: adminUser.email,
      role: adminUser.role,
      uniqueId: adminUser.uniqueId
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      
      const { password, ...userWithoutPassword } = adminUser._doc;
      res.json({
        token,
        user: userWithoutPassword,
        message: 'Admin account created successfully!'
      });
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
