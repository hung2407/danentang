const express = require('express');
const router = express.Router();
const { createBooking } = require('../controllers/bookingController');
const auth = require('../middleware/auth'); // Thêm middleware xác thực

// Thêm middleware auth để xác thực người dùng
router.post('/', auth, createBooking);

module.exports = router;