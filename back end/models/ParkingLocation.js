// models/ParkingLocation.js
const mongoose = require('mongoose');

const ParkingLocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  // Có thể thêm tọa độ nếu cần:
  coordinates: {
    lat: Number,
    lng: Number
  }
});

module.exports = mongoose.model('ParkingLocation', ParkingLocationSchema);
