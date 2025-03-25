// models/ParkingSpot.js
const mongoose = require('mongoose');

const ParkingSpotSchema = new mongoose.Schema({
  floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  spotNumber: { type: String, required: true },
  status: { type: String, enum: ['available', 'reserved'], default: 'available' }
});

module.exports = mongoose.model('ParkingSpot', ParkingSpotSchema);
