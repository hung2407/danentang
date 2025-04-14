const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');

// API lấy danh sách khu vực đỗ xe
router.get('/parking-zones', parkingController.getParkingZones);

// API tạo đặt chỗ
router.post('/bookings', parkingController.createBooking);

// API lấy thông tin người dùng
router.get('/users/:id', parkingController.getUserById);

module.exports = router;