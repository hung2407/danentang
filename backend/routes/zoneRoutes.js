const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');

// Route để lấy danh sách tất cả các khu vực
router.get('/api/zones', zoneController.getAllZones);

// Route để lấy chi tiết một khu vực cụ thể
router.get('/api/zones/:zoneId', zoneController.getZoneDetails);

module.exports = router; 