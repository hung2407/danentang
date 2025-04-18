const db = require('../config/database');

class Booking {
  static async create(bookingData) {
    const { 
      userId, vehicleId, slotId, ticketPriceId, bookingType, 
      startTime, endTime, qrCode 
    } = bookingData;

    const [result] = await db.query(`
      INSERT INTO Bookings 
      (user_id, vehicle_id, slot_id, ticket_price_id, booking_type, 
       start_time, end_time, status, qr_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [userId, vehicleId, slotId, ticketPriceId, bookingType, startTime, endTime, qrCode]);

    return result.insertId;
  }

  static async getUserBookings(userId) {
    const [bookings] = await db.query(`
      SELECT 
        b.booking_id, b.status, b.start_time, b.end_time, b.booking_type, b.qr_code,
        v.license_plate, v.vehicle_type,
        s.slot_code, z.zone_name,
        tp.price,
        py.amount, py.payment_status, py.payment_method
      FROM Bookings b
      JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
      JOIN Slots s ON b.slot_id = s.slot_id
      JOIN Zones z ON s.zone_id = z.zone_id
      JOIN Ticket_Prices tp ON b.ticket_price_id = tp.price_id
      LEFT JOIN Payments py ON b.booking_id = py.booking_id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [userId]);
    
    return bookings;
  }

  static async findById(bookingId) {
    const [bookings] = await db.query(`
      SELECT * FROM Bookings WHERE booking_id = ?
    `, [bookingId]);
    return bookings.length ? bookings[0] : null;
  }

  static async updateStatus(bookingId, status) {
    await db.query('UPDATE Bookings SET status = ? WHERE booking_id = ?', [status, bookingId]);
    return true;
  }

  static async getBookingDetails(bookingId) {
    const [bookingDetails] = await db.query(`
      SELECT 
        b.booking_id, b.status, b.start_time, b.end_time, b.booking_type, b.qr_code,
        u.username, u.full_name, u.email, u.phone,
        v.license_plate, v.vehicle_type,
        s.slot_code, z.zone_name,
        tp.price
      FROM Bookings b
      JOIN Users u ON b.user_id = u.user_id
      JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
      JOIN Slots s ON b.slot_id = s.slot_id
      JOIN Zones z ON s.zone_id = z.zone_id
      JOIN Ticket_Prices tp ON b.ticket_price_id = tp.price_id
      WHERE b.booking_id = ?
    `, [bookingId]);

    return bookingDetails.length ? bookingDetails[0] : null;
  }
}

module.exports = Booking; 