const express = require('express');
const router = express.Router();

let staff = [];

router.get('/', (req, res) => {
  res.json(staff);
});

router.post('/', (req, res) => {
  const newStaff = { id: staff.length + 1, ...req.body };
  staff.push(newStaff);
  res.status(201).json(newStaff);
});

module.exports = router;
