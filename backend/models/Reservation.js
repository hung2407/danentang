const db = require('../config/database');

class Reservation {
  static async checkExpiredReservations() {
    try {
      // Lấy tất cả bookings có trạng thái 'pending' và đã quá thời gian giữ chỗ
      // Giả sử rằng khi đặt chỗ, chúng ta giữ slot trong 10 phút
      const [expiredBookings] = await db.query(`
        SELECT b.booking_id, b.slot_id
        FROM Bookings b
        WHERE b.status = 'pending'
        AND b.created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      `);

      if (expiredBookings.length === 0) {
        console.log('Không có đặt chỗ hết hạn cần xử lý');
        return;
      }

      // Lấy danh sách booking_id và slot_id
      const bookingIds = expiredBookings.map(booking => booking.booking_id);
      const slotIds = expiredBookings.map(booking => booking.slot_id);

      // Cập nhật trạng thái của các bookings thành 'cancelled'
      await db.query(`
        UPDATE Bookings
        SET status = 'cancelled'
        WHERE booking_id IN (?)
      `, [bookingIds]);

      // Cập nhật trạng thái của các slots thành 'available'
      await db.query(`
        UPDATE Slots
        SET status = 'available'
        WHERE slot_id IN (?)
      `, [slotIds]);

      // Cập nhật available_slots trong các zones liên quan
      // Lấy zone_id từ slot_id
      const [slots] = await db.query(`
        SELECT slot_id, zone_id
        FROM Slots
        WHERE slot_id IN (?)
      `, [slotIds]);

      // Tạo danh sách zone_id duy nhất
      const zoneIds = [...new Set(slots.map(slot => slot.zone_id))];

      // Cập nhật từng zone
      for (const zoneId of zoneIds) {
        // Đếm slots có status = 'available' trong zone
        const [availableSlots] = await db.query(`
          SELECT COUNT(*) as count
          FROM Slots
          WHERE zone_id = ? AND status = 'available'
        `, [zoneId]);

        // Cập nhật available_slots trong zone
        await db.query(`
          UPDATE Zones
          SET available_slots = ?
          WHERE zone_id = ?
        `, [availableSlots[0].count, zoneId]);
      }

      console.log(`Đã hủy ${bookingIds.length} đặt chỗ quá hạn và cập nhật ${slotIds.length} slots về trạng thái available`);
    } catch (error) {
      console.error('Lỗi khi kiểm tra các đặt chỗ hết hạn:', error);
      throw error;
    }
  }

  static async createReservation(bookingData) {
    const { 
      userId, vehicleId, slotId, ticketPriceId, 
      bookingType, startTime, endTime, qrCode 
    } = bookingData;

    const [result] = await db.query(`
      INSERT INTO Bookings 
      (user_id, vehicle_id, slot_id, ticket_price_id, booking_type, 
      start_time, end_time, status, qr_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [userId, vehicleId, slotId, ticketPriceId, bookingType, startTime, endTime, qrCode]);

    // Cập nhật trạng thái của slot
    await db.query(`
      UPDATE Slots
      SET status = 'reserved'
      WHERE slot_id = ?
    `, [slotId]);

    return result.insertId;
  }

  static async cancelReservation(bookingId) {
    // Lấy thông tin về slot từ booking
    const [bookings] = await db.query(`
      SELECT slot_id
      FROM Bookings
      WHERE booking_id = ?
    `, [bookingId]);

    if (bookings.length === 0) {
      throw new Error('Không tìm thấy đặt chỗ');
    }

    const slotId = bookings[0].slot_id;

    // Cập nhật trạng thái booking
    await db.query(`
      UPDATE Bookings
      SET status = 'cancelled'
      WHERE booking_id = ?
    `, [bookingId]);

    // Cập nhật trạng thái slot
    await db.query(`
      UPDATE Slots
      SET status = 'available'
      WHERE slot_id = ?
    `, [slotId]);

    // Cập nhật available_slots trong Zones
    // Lấy zone_id từ slot_id
    const [slots] = await db.query(`
      SELECT zone_id
      FROM Slots
      WHERE slot_id = ?
    `, [slotId]);

    if (slots.length > 0) {
      const zoneId = slots[0].zone_id;
      
      // Đếm slots có status = 'available' trong zone
      const [availableSlots] = await db.query(`
        SELECT COUNT(*) as count
        FROM Slots
        WHERE zone_id = ? AND status = 'available'
      `, [zoneId]);

      // Cập nhật available_slots trong zone
      await db.query(`
        UPDATE Zones
        SET available_slots = ?
        WHERE zone_id = ?
      `, [availableSlots[0].count, zoneId]);
    }

    return true;
  }
}

module.exports = Reservation; 