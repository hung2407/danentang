// controllers/bookingController.js
const Booking = require('../models/Booking');
const ParkingSpot = require('../models/ParkingSpot');
const ParkingFloor = require('../models/ParkingFloor');

exports.createBooking = async (req, res) => {
  try {
    const { spotId, startTime, endTime } = req.body;
    const userId = req.user.id;

    // Get spot and floor info for pricing
    const spot = await ParkingSpot.findById(spotId).populate('floor', 'pricePerHour');
    if (!spot) {
      return res.status(404).json({ msg: 'Parking spot not found' });
    }

    // Calculate duration in hours and total price
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationHours = (end - start) / (1000 * 60 * 60);
    const totalPrice = durationHours * spot.floor.pricePerHour;

    const booking = new Booking({
      user: userId,
      spot: spotId,
      startTime,
      endTime,
      totalPrice,
      status: 'active'
    });

    await booking.save();

    // Update spot status
    spot.status = 'booked';
    await spot.save();

    res.json(booking);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookings = await Booking.find({ user: userId })
      .populate('spot')
      .populate({
        path: 'spot',
        populate: {
          path: 'floor',
          select: 'name pricePerHour'
        }
      })
      .sort({ startTime: -1 });
    res.json(bookings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
      status: 'active'
    });

    if (!booking) {
      return res.status(404).json({ msg: 'Booking not found or already cancelled' });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Free up the parking spot
    const spot = await ParkingSpot.findById(booking.spot);
    spot.status = 'available';
    await spot.save();

    res.json(booking);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
