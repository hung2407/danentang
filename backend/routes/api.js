const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');
const vehicleController = require('../controllers/vehicleController');

// Parking routes
router.get('/parking-zones', parkingController.getParkingZones);
router.get('/parking-zones/availability', parkingController.getParkingZonesAvailability);
router.post('/bookings', parkingController.createBooking);
router.get('/users/:id', parkingController.getUserById);

// Vehicle routes
router.post('/vehicles/register', vehicleController.registerVehicle);
router.get('/users/:userId/vehicles', vehicleController.getUserVehicles);

module.exports = router;