const express = require('express');
const router = express.Router();

let bills = [];

router.get('/', (req, res) => {
  res.json(bills);
});

router.post('/', (req, res) => {
  const newBill = { id: bills.length + 1, ...req.body };
  bills.push(newBill);
  res.status(201).json(newBill);
});

module.exports = router;
