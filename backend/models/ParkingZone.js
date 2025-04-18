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

  static async getZoneDetails(zoneId) {
    const [zoneData] = await db.query(`
      SELECT z.zone_id as id, z.zone_name as name, z.total_slots as totalSpots, 
             z.available_slots as availableSpots
      FROM Zones z
      WHERE z.zone_id = ?
    `, [zoneId]);

    if (zoneData.length === 0) return null;

    // Get layout information if available
    const [layoutData] = await db.query(`
      SELECT layout_type, grid_rows, grid_cols, layout_data
      FROM Zone_Layouts
      WHERE zone_id = ?
    `, [zoneId]);

    // Get slots information
    const [slots] = await db.query(`
      SELECT slot_id as id, slot_code as code, status, position_x, position_y
      FROM Slots
      WHERE zone_id = ?
    `, [zoneId]);

    return {
      ...zoneData[0],
      layout: layoutData.length > 0 ? layoutData[0] : null,
      slots
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