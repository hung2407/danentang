// controllers/bookingController.js
const Booking = require('../models/Booking');
const ParkingSpot = require('../models/ParkingSpot');

exports.createBooking = async (req, res) => {
  const {
    userId,
    parkingLocationId,
    floorId,
    parkingSpotId,
    carPlate,
    bookingDate,
    bookingTime,
    paymentMethod
  } = req.body;

  try {
    // Kiểm tra trạng thái chỗ gửi xe
    const spot = await ParkingSpot.findById(parkingSpotId);
    if (!spot) return res.status(404).json({ msg: 'Parking spot not found' });
    if (spot.status !== 'available') {
      return res.status(400).json({ msg: 'Parking spot is not available' });
    }

    // Tạo đơn đặt chỗ
    const newBooking = new Booking({
      user: userId,
      parkingLocation: parkingLocationId,
      floor: floorId,
      parkingSpot: parkingSpotId,
      carPlate,
      bookingDate,
      bookingTime,
      paymentMethod,
      status: 'confirmed'
    });
    await newBooking.save();

    // Cập nhật trạng thái chỗ gửi xe thành "reserved"
    spot.status = 'reserved';
    await spot.save();

    res.status(201).json(newBooking);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ msg: 'Booking không tồn tại' });

    // Cập nhật trạng thái chỗ đỗ
    const spot = await ParkingSpot.findById(booking.parkingSpot);
    spot.status = 'available';
    await spot.save();

    // Cập nhật trạng thái booking
    booking.status = 'cancelled';
    await booking.save();

    res.json({ msg: 'Hủy đặt chỗ thành công' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi server');
  }
};
