// models/Booking.js
const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parkingLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLocation', required: true },
  floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
  parkingSpot: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingSpot', required: true },
  carPlate: { type: String, required: true },
  bookingDate: { type: Date, required: true },
  bookingTime: { type: String, required: true }, // Hoặc lưu dưới dạng string "HH:MM"
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled', 'pending'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', BookingSchema);
