const express = require('express');
const router = express.Router();

// Mock doctors data
let doctors = [];

router.get('/', (req, res) => {
  res.json(doctors);
});

router.post('/', (req, res) => {
  const newDoctor = { id: doctors.length + 1, ...req.body };
  doctors.push(newDoctor);
  res.status(201).json(newDoctor);
});

module.exports = router;
