const express = require('express');
const { body, validationResult } = require('express-validator');
const FamilyMember = require('../models/FamilyMember');
const User = require('../models/User');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

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

// Nodemailer transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send family request email
const sendFamilyRequestEmail = async (requester, requested, relationship) => {
  const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/family-requests`;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: requested.email,
    subject: 'Family Member Request - Prana Hospital',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1C8C8C, #0F5F5F); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Prana Hospital</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Family Member Request</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${requested.name},</h2>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            <strong>${requester.name}</strong> has sent you a family member request on Prana Hospital Management System.
          </p>
          
          <div style="background: #e9e9e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #333;">
              <strong>Relationship:</strong> ${relationship.charAt(0).toUpperCase() + relationship.slice(1)}<br>
              <strong>Requester:</strong> ${requester.name} (${requester.email})
            </p>
          </div>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            By accepting this request, you'll be able to:
          </p>
          
          <ul style="color: #555; line-height: 1.6; font-size: 16px;">
            <li>View each other's basic health information</li>
            <li>Receive notifications about appointments</li>
            <li>Access emergency contact information</li>
            <li>Coordinate healthcare decisions</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}" style="background: #1C8C8C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">View Family Requests</a>
          </div>
          
          <p style="color: #555; line-height: 1.6; font-size: 16px;">
            You can accept or decline this request by logging into your Prana Hospital account and visiting the Family Requests section.
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

// @route   POST /api/family/search
// @desc    Search for users to add as family members
// @access  Private
router.post('/search', auth, [
  body('searchTerm').notEmpty().withMessage('Search term is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { searchTerm } = req.body;
    const currentUserId = req.user.id;

    // Search by email or uniqueId
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        {
          $or: [
            { email: { $regex: searchTerm, $options: 'i' } },
            { uniqueId: { $regex: searchTerm, $options: 'i' } }
          ]
        }
      ]
    }).select('name email uniqueId role isVerified isApproved');

    res.json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/family/request
// @desc    Send family member request
// @access  Private
router.post('/request', auth, [
  body('requestedId').notEmpty().withMessage('Requested user ID is required'),
  body('relationship').notEmpty().withMessage('Relationship is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestedId, relationship, notes } = req.body;
    const requesterId = req.user.id;

    // Check if request already exists
    const existingRequest = await FamilyMember.findOne({
      $or: [
        { requesterId, requestedId },
        { requesterId: requestedId, requestedId: requesterId }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({ 
        message: 'A family request already exists between these users' 
      });
    }

    // Check if requested user exists and is verified
    const requestedUser = await User.findById(requestedId);
    if (!requestedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!requestedUser.isVerified) {
      return res.status(400).json({ message: 'User has not verified their email' });
    }

    // Create family request
    const familyRequest = new FamilyMember({
      requesterId,
      requestedId,
      relationship,
      notes
    });

    await familyRequest.save();

    // Send email notification
    try {
      const requester = await User.findById(requesterId);
      await sendFamilyRequestEmail(requester, requestedUser, relationship);
    } catch (emailError) {
      console.log('Email not configured, skipping family request email:', emailError.message);
    }

    res.json({ 
      message: 'Family request sent successfully',
      request: familyRequest
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/family/requests
// @desc    Get family requests for current user
// @access  Private
router.get('/requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get incoming requests
    const incomingRequests = await FamilyMember.find({
      requestedId: userId,
      status: 'pending'
    }).populate('requesterId', 'name email uniqueId role');

    // Get outgoing requests
    const outgoingRequests = await FamilyMember.find({
      requesterId: userId,
      status: 'pending'
    }).populate('requestedId', 'name email uniqueId role');

    // Get accepted family members
    const acceptedRequests = await FamilyMember.find({
      $or: [
        { requesterId: userId, status: 'accepted' },
        { requestedId: userId, status: 'accepted' }
      ]
    }).populate('requesterId', 'name email uniqueId role')
      .populate('requestedId', 'name email uniqueId role');

    res.json({
      incoming: incomingRequests,
      outgoing: outgoingRequests,
      accepted: acceptedRequests
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/family/respond
// @desc    Respond to family member request
// @access  Private
router.post('/respond', auth, [
  body('requestId').notEmpty().withMessage('Request ID is required'),
  body('status').isIn(['accepted', 'declined']).withMessage('Status must be accepted or declined')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId, status } = req.body;
    const userId = req.user.id;

    // Find the request
    const familyRequest = await FamilyMember.findOne({
      _id: requestId,
      requestedId: userId,
      status: 'pending'
    });

    if (!familyRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Update request status
    familyRequest.status = status;
    familyRequest.respondedAt = new Date();
    await familyRequest.save();

    res.json({ 
      message: `Family request ${status} successfully`,
      request: familyRequest
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/family/remove
// @desc    Remove family member relationship
// @access  Private
router.delete('/remove', auth, [
  body('requestId').notEmpty().withMessage('Request ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.body;
    const userId = req.user.id;

    // Find the request
    const familyRequest = await FamilyMember.findOne({
      _id: requestId,
      $or: [
        { requesterId: userId },
        { requestedId: userId }
      ],
      status: 'accepted'
    });

    if (!familyRequest) {
      return res.status(404).json({ message: 'Family relationship not found' });
    }

    // Remove the relationship
    await FamilyMember.findByIdAndDelete(requestId);

    res.json({ message: 'Family member removed successfully' });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 