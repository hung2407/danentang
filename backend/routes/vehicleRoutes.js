const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');

// Create new vehicle
router.post('/api/vehicles', async (req, res) => {
  try {
    const vehicleData = req.body;
    const vehicleId = await parkingController.createVehicle(vehicleData);
    res.status(201).json({ success: true, vehicleId });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ success: false, message: 'Failed to create vehicle' });
  }
});

module.exports = router;