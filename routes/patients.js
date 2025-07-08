const express = require('express');
const router = express.Router();

// Mock patients data
let patients = [
  {
    id: 1,
    name: 'John Doe',
    age: 35,
    gender: 'Male',
    phone: '+1-555-0123',
    email: 'john.doe@email.com',
    address: '123 Main St, City, State',
    bloodGroup: 'O+',
    emergencyContact: '+1-555-0124',
    lastVisit: '2024-01-15',
    status: 'Active'
  }
];

// @route   GET /api/patients
// @desc    Get all patients
// @access  Private
router.get('/', (req, res) => {
  res.json(patients);
});

// @route   POST /api/patients
// @desc    Create a new patient
// @access  Private
router.post('/', (req, res) => {
  const newPatient = {
    id: patients.length + 1,
    ...req.body,
    createdAt: new Date()
  };
  patients.push(newPatient);
  res.status(201).json(newPatient);
});

module.exports = router;
