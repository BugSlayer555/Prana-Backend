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
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().withMessage('Role is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('phone').notEmpty().withMessage('Phone number is required').isMobilePhone().withMessage('Please include a valid phone number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, password, role, department, phone, address } = req.body;

    // Check if email already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if phone number already exists
    let phoneUser = await User.findOne({ phone });
    if (phoneUser) {
      return res.status(400).json({ message: 'Phone number already registered' });
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
    
    // Create JWT token for automatic login
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role
    };
    
    jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      
      const { password, ...userWithoutPassword } = user._doc;
      res.json({
        message: 'Email verified successfully!',
        token,
        user: userWithoutPassword
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
