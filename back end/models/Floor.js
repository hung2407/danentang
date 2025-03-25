// models/Floor.js
const mongoose = require('mongoose');

const FloorSchema = new mongoose.Schema({
  parkingLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLocation', required: true },
  floorNumber: { type: Number, required: true },
  totalSpots: { type: Number, required: true }
  // Số chỗ trống có thể tính bằng cách đếm các ParkingSpot có status "available"
});

module.exports = mongoose.model('Floor', FloorSchema);
