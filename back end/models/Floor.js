// models/Floor.js
const mongoose = require('mongoose');

const FloorSchema = new mongoose.Schema({
  parkingLocation: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ParkingLocation', 
    required: true 
  },
  floorNumber: { type: Number, required: true },
  // Total spots có thể tính từ số lượng ParkingSpot
});

// Thêm virtual field để tính availableSpots
FloorSchema.virtual('availableSpots').get(async function() {
  return await ParkingSpot.countDocuments({ 
    floor: this._id, 
    status: 'available' 
  });
});

module.exports = mongoose.model('Floor', FloorSchema);