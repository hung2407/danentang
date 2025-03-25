// routes/parking.js
const express = require('express');
const router = express.Router();
const {
  getParkingLocations,
  getFloorsByLocation,
  getSpotsByFloor
} = require('../controllers/parkingController');

router.get('/', getParkingLocations);
router.get('/:locationId/floors', getFloorsByLocation);
router.get('/floors/:floorId/spots', getSpotsByFloor);

module.exports = router;
