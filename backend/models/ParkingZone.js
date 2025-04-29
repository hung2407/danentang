const db = require('../config/database');

class ParkingZone {
  static async getAvailableZones() {
    const [zones] = await db.query(`
      SELECT z.zone_id as id, z.zone_name as name, z.total_slots as totalSpots, 
             z.available_slots as availableSpots
      FROM Zones z
      WHERE z.available_slots > 0
    `);
    return zones;
  }

  static async getZoneDetails(zoneId, timeFilter = null) {
    const [zoneData] = await db.query(`
      SELECT z.zone_id as id, z.zone_name as name, z.total_slots as totalSpots, 
             z.available_slots as availableSpots
      FROM Zones z
      WHERE z.zone_id = ?
    `, [zoneId]);

    if (zoneData.length === 0) return null;

    const [layoutData] = await db.query(`
      SELECT layout_type, grid_rows, grid_cols, layout_data
      FROM Zone_Layouts
      WHERE zone_id = ?
    `, [zoneId]);

    const [slots] = await db.query(`
      SELECT 
        s.slot_id as id, 
        s.slot_code as code, 
        s.status as db_status, 
        s.position_x, 
        s.position_y
      FROM Slots s
      WHERE s.zone_id = ?
    `, [zoneId]);

    let allFilteredByTimeBookings = [];
    let nonTimeFilteredBookings = [];
    
    if (timeFilter) {
      const { startTime, endTime } = timeFilter;
      
      const [timeFilteredBookings] = await db.query(`
        SELECT 
          b.booking_id,
          b.slot_id,
          b.start_time,
          b.end_time,
          b.status as booking_status,
          b.booking_type,
          v.license_plate,
          u.username as user_name
        FROM Bookings b
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN Users u ON b.user_id = u.user_id
        WHERE b.slot_id IN (?)
        AND b.status IN ('pending', 'confirmed', 'checked_in')
        AND ((b.start_time < ? AND b.end_time > ?) OR
             (b.start_time BETWEEN ? AND ?) OR
             (b.end_time BETWEEN ? AND ?))
      `, [slots.map(s => s.id), endTime, startTime, startTime, endTime, startTime, endTime]);
      
      allFilteredByTimeBookings = timeFilteredBookings;
      
      const [currentStatusBookings] = await db.query(`
        SELECT 
          b.booking_id,
          b.slot_id,
          b.status as booking_status
        FROM Bookings b
        WHERE b.slot_id IN (?)
        AND b.status IN ('checked_in', 'pending')
      `, [slots.map(s => s.id)]);
      
      nonTimeFilteredBookings = currentStatusBookings;
    } else {
      const [allBookings] = await db.query(`
        SELECT 
          b.booking_id,
          b.slot_id,
          b.start_time,
          b.end_time,
          b.status as booking_status,
          b.booking_type,
          v.license_plate,
          u.username as user_name
        FROM Bookings b
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN Users u ON b.user_id = u.user_id
        WHERE b.slot_id IN (?)
        AND b.status IN ('pending', 'confirmed', 'checked_in')
      `, [slots.map(s => s.id)]);
      
      allFilteredByTimeBookings = allBookings;
    }

    const processedSlots = slots.map(slot => {
      const slotBookings = allFilteredByTimeBookings.filter(b => b.slot_id === slot.id);
      
      const currentStatusBookings = nonTimeFilteredBookings.filter(b => b.slot_id === slot.id);
      
      let finalStatus = 'available';
      
      if (currentStatusBookings.some(b => b.booking_status === 'checked_in')) {
        finalStatus = 'occupied';
      } else if (currentStatusBookings.some(b => b.booking_status === 'pending')) {
        finalStatus = 'pending';
      }
      else if (slot.db_status === 'occupied' || slot.db_status === 'pending') {
        finalStatus = slot.db_status;
      }
      else if (slotBookings.length > 0) {
        finalStatus = 'reserved';
      }
      
      return {
        id: slot.id,
        code: slot.code,
        status: finalStatus,
        position_x: slot.position_x,
        position_y: slot.position_y,
        bookings: slotBookings.map(booking => ({
          id: booking.booking_id,
          startTime: booking.start_time,
          endTime: booking.end_time,
          status: booking.booking_status,
          type: booking.booking_type,
          licensePlate: booking.license_plate,
          userName: booking.user_name
        }))
      };
    });

    const availableSlots = processedSlots.filter(slot => slot.status === 'available').length;

    return {
      ...zoneData[0],
      availableSpots: availableSlots,
      layout: layoutData.length > 0 ? layoutData[0] : null,
      slots: processedSlots,
      timeFrame: timeFilter
    };
  }

  static async getAvailableSlots(zoneId) {
    const [slots] = await db.query(`
      SELECT slot_id as id, slot_code as code, status, position_x, position_y
      FROM Slots
      WHERE zone_id = ? AND status = 'available'
    `, [zoneId]);
    return slots;
  }
}

module.exports = ParkingZone;