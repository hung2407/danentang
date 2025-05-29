const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const bookingController = require('../controllers/bookingController');
const { isAdmin } = require('../middleware/adminMiddleware');

// Đăng nhập admin không cần middleware
router.post('/login', adminController.login);

// Middleware isAdmin cho tất cả các route phía dưới
router.use(isAdmin);

// Dashboard API
router.get('/dashboard/summary', adminController.getDashboardSummary);

// Quản lý người dùng
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.get('/users/:userId', adminController.getUserById);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);

// Quản lý khu vực đỗ xe
router.get('/zones', adminController.getAllZones);
router.post('/zones', adminController.createZone);
router.put('/zones/:zoneId', adminController.updateZone);
router.delete('/zones/:zoneId', adminController.deleteZone);

// Quản lý đặt chỗ
router.get('/bookings', adminController.getAllBookings);
router.put('/bookings/:bookingId/status', adminController.updateBookingStatus);
// Verify scanned booking
router.get('/bookings/:bookingId/verify', adminController.verifyScannedBooking);
// Debug route to get all booking IDs
router.get('/bookings-debug', adminController.getAllBookingIds);

// Check-in/Check-out chuyên dụng cho admin
router.post('/checkin', bookingController.checkInBooking);
router.post('/checkout', bookingController.checkOutBooking);

// Lịch sử đặt chỗ
router.get('/bookings/history', adminController.getBookingHistory);

// Báo cáo
router.get('/reports/revenue', adminController.getRevenueReport);

// Thiết lập hệ thống
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Quản lý giá vé
router.get('/prices', adminController.getAllPrices);
router.get('/prices/:priceId', adminController.getPriceById);
router.post('/prices', adminController.addPrice);
router.put('/prices/:priceId', adminController.updatePrice);
router.delete('/prices/:priceId', adminController.deletePrice);
router.get('/zones/:zoneId/prices/history', adminController.getZonePriceHistory);
router.get('/zones/:zoneId/prices/current', adminController.getCurrentZonePrices);

// Đặt lại mật khẩu admin
router.post('/reset-password', adminController.resetPassword);

module.exports = router; 