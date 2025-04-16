const db = require('../config/database');

class ParkingZone {
  static async getAvailableZones() {
    const [zones] = await db.query(`
      SELECT z.zone_id as id, z.zone_name as name, z.total_slots as totalSpots, 
             z.available_slots as availableSpots, p.name as parkingLotName, p.address
      FROM Zones z
      JOIN Parking_Lots p ON z.lot_id = p.lot_id
      WHERE z.available_slots > 0 AND p.available_slots > 0
    `);
    return zones;
  }

  static async getZoneDetails(zoneId) {
    const [zoneData] = await db.query(`
      SELECT z.zone_id as id, z.zone_name as name, z.total_slots as totalSpots, 
             z.available_slots as availableSpots, p.name as parkingLotName, p.address,
             zl.layout_type, zl.grid_rows, zl.grid_cols, zl.layout_data, p.lot_id
      FROM Zones z
      JOIN Parking_Lots p ON z.lot_id = p.lot_id
      LEFT JOIN Zone_Layouts zl ON z.zone_id = zl.zone_id
      WHERE z.zone_id = ?
    `, [zoneId]);

    if (zoneData.length === 0) return null;

    const [slots] = await db.query(`
      SELECT slot_id as id, slot_code as code, status, position_x, position_y
      FROM Slots
      WHERE zone_id = ?
    `, [zoneId]);

    return {
      ...zoneData[0],
      slots
    };
  }

  static async getAvailableSlots(zoneId) {
    const [slots] = await db.query(`
      SELECT slot_id, slot_code, status
      FROM Slots
      WHERE zone_id = ? AND status = 'available'
    `, [zoneId]);
    return slots;
  }
}

module.exports = ParkingZone; 