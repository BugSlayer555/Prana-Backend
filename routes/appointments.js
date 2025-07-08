const express = require('express');
const router = express.Router();

let appointments = [];

router.get('/', (req, res) => {
  res.json(appointments);
});

router.post('/', (req, res) => {
  const newAppointment = { id: appointments.length + 1, ...req.body };
  appointments.push(newAppointment);
  res.status(201).json(newAppointment);
});

module.exports = router;
