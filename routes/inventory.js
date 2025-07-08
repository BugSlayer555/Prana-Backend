const express = require('express');
const router = express.Router();

let inventory = [];

router.get('/', (req, res) => {
  res.json(inventory);
});

router.post('/', (req, res) => {
  const newItem = { id: inventory.length + 1, ...req.body };
  inventory.push(newItem);
  res.status(201).json(newItem);
});

module.exports = router;
