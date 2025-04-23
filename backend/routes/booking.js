const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

// Routes công khai
// Lấy danh sách các khu vực đỗ xe
router.get('/zones', bookingController.getParkingZones);

// Lấy thông tin chi tiết về một khu vực đỗ xe
router.get('/zones/:zoneId', bookingController.getZoneDetails);

// Routes yêu cầu đăng nhập
// Kiểm tra biển số xe
router.post('/check-license-plate', authMiddleware, bookingController.checkLicensePlate);

// Tính giá đặt chỗ
router.post('/calculate-price', authMiddleware, bookingController.calculateBookingPrice);

// Đặt chỗ đỗ xe
router.post('/create', authMiddleware, bookingController.createBooking);

// Lấy danh sách đặt chỗ của user
router.get('/user/:userId', authMiddleware, bookingController.getUserBookings);

// Hủy đặt chỗ
router.put('/cancel/:bookingId/:userId', authMiddleware, bookingController.cancelBooking);

// Check-in booking
router.post('/checkin', authMiddleware, bookingController.checkInBooking);

// Check-out booking
router.post('/checkout', authMiddleware, bookingController.checkOutBooking);

// Trả về mã QR sau khi thanh toán thành công
router.post('/invoice', authMiddleware, bookingController.getInvoiceAndQRCode);

// Lấy mã QR bằng bookingId
router.get('/invoice/:bookingId', authMiddleware, bookingController.getInvoiceById);

module.exports = router;