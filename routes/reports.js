const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Reports endpoint',
    data: {
      totalPatients: 1234,
      totalDoctors: 45,
      totalAppointments: 567,
      revenue: 125000
    }
  });
});

module.exports = router;
