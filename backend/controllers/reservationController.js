const reservationModel = require('../models/reservationModel');
const parkingModel = require('../models/parkingModel');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid'); // Giả sử bạn đã có file config/db.js để kết nối MySQL

// Đặt chỗ
const createReservation = async (req, res) => {
  try {
    const { userId, zoneId, slotId, startTime, endTime, licensePlate, vehicleType, phoneNumber, bookingType, priceId } = req.body;

    // Kiểm tra slot có khả dụng không
    const zone = await parkingModel.getZoneById(zoneId);
    if (!zone || zone.available_spots <= 0) {
      throw new Error('Không còn chỗ trống trong khu vực này');
    }

    // Kiểm tra slot tồn tại
    const [slot] = await db.query('SELECT * FROM Spots WHERE spot_id = ? AND zone_id = ?', [slotId, zoneId]);
    if (!slot[0]) {
      throw new Error('Slot không tồn tại');
    }

    // Kiểm tra overlap thời gian
    const [bookings] = await db.query(
      `SELECT * FROM Bookings 
       WHERE spot_id = ? AND status = 'Confirmed' 
       AND ((start_time <= ? AND end_time >= ?) OR (start_time <= ? AND end_time >= ?))`,
      [slotId, endTime, startTime, startTime, endTime]
    );
    if (bookings.length > 0) {
      throw new Error('Slot đã được đặt trong khung giờ này');
    }

    // Tạo booking
    const [result] = await db.query(
      `INSERT INTO Bookings (user_id, spot_id, start_time, end_time, status, license_plate, vehicle_type, phone_number, booking_type, price_id) 
       VALUES (?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?, ?)`,
      [userId, slotId, startTime, endTime, licensePlate, vehicleType, phoneNumber, bookingType, priceId]
    );

    // Cập nhật số chỗ trống
    await parkingModel.updateAvailability(zoneId, zone.available_spots - 1);

    // Gửi thông báo qua WebSocket
    const updatedZone = await parkingModel.getZoneById(zoneId);
    const [updatedSlot] = await db.query('SELECT * FROM Spots WHERE spot_id = ?', [slotId]);
    const [slotBookings] = await db.query('SELECT start_time, end_time FROM Bookings WHERE spot_id = ? AND status = "Confirmed"', [slotId]);

    req.app.get('wss').clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          event: 'bookingCreated',
          data: {
            zoneId,
            slotId,
            booking: { start_time: startTime, end_time: endTime },
            slot: { ...updatedSlot[0], bookings: slotBookings },
          },
        }));
      }
    });

    res.status(201).json({ bookingId: result.insertId });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Trả chỗ
const releaseReservation = async (req, res) => {
  try {
    const reservationId = req.params.reservationId;
    const [reservation] = await db.query('SELECT * FROM Bookings WHERE booking_id = ?', [reservationId]);
    if (!reservation[0] || reservation[0].status !== 'Confirmed') {
      throw new Error('Đặt chỗ không hợp lệ hoặc đã hết hạn');
    }

    const zoneId = reservation[0].zone_id;
    const slotId = reservation[0].spot_id;

    await db.query('UPDATE Bookings SET status = "Cancelled" WHERE booking_id = ?', [reservationId]);
    const zone = await parkingModel.getZoneById(zoneId);
    await parkingModel.updateAvailability(zoneId, zone.available_spots + 1);

    // Gửi thông báo qua WebSocket
    const updatedZone = await parkingModel.getZoneById(zoneId);
    const [updatedSlot] = await db.query('SELECT * FROM Spots WHERE spot_id = ?', [slotId]);
    const [slotBookings] = await db.query('SELECT start_time, end_time FROM Bookings WHERE spot_id = ? AND status = "Confirmed"', [slotId]);

    req.app.get('wss').clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          event: 'bookingCancelled',
          data: {
            zoneId,
            slotId,
            slot: { ...updatedSlot[0], bookings: slotBookings },
          },
        }));
      }
    });

    res.json({ message: 'Trả chỗ thành công', reservationId, zoneId });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createReservation,
  releaseReservation,
};