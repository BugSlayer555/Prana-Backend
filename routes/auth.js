const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
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
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Verify your email',
    html: `<p>Hi ${user.name},</p><p>Please verify your email by clicking the link below:</p><a href="${verifyUrl}">${verifyUrl}</a>`
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().withMessage('Role is required'),
  body('department').notEmpty().withMessage('Department is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, password, role, department, phone, address } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department,
      phone,
      address,
      isVerified: false,
      verificationToken
    });

    await newUser.save();

    // Send verification email
    await sendVerificationEmail(newUser, verificationToken);

    // Create JWT token
    const payload = {
      id: newUser._id,
      email: newUser.email,
      role: newUser.role
    };

    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      
      const { password, ...userWithoutPassword } = newUser._doc;
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

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role
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

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/verify-email
// @desc    Verify user email
// @access  Public
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Invalid or missing token.' });
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.json({ message: 'Email verified successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
