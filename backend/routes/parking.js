const express = require('express');
const router = express.Router();
const {
  getParkingLocations,
  getFloorsByLocation,
  getSpotsByFloor
} = require('../controllers/parkingController');
const ParkingLocation = require('../models/ParkingLocation');
const Floor = require('../models/Floor');

// Middleware kiểm tra locationId hợp lệ
const checkLocationId = async (req, res, next) => {
    try {
        const location = await ParkingLocation.findById(req.params.locationId);
        if (!location) return res.status(404).json({ msg: 'Không tìm thấy khu vực' });
        next();
    } catch (err) {
        res.status(500).send('Lỗi server');
    }
};

// Middleware kiểm tra floorId hợp lệ
const checkFloorId = async (req, res, next) => {
    try {
        const floor = await Floor.findById(req.params.floorId);
        if (!floor) return res.status(404).json({ msg: 'Không tìm thấy tầng' });
        next();
    } catch (err) {
        res.status(500).send('Lỗi server');
    }
};

router.get('/', getParkingLocations);
router.get('/:locationId/floors', checkLocationId, getFloorsByLocation);
router.get('/floors/:floorId/spots', checkFloorId, getSpotsByFloor);

module.exports = router;