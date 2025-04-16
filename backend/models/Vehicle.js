const db = require('../config/database');

class Vehicle {
  static async findByLicensePlate(licensePlate) {
    const [vehicles] = await db.query('SELECT * FROM Vehicles WHERE license_plate = ?', [licensePlate]);
    return vehicles.length ? vehicles[0] : null;
  }

  static async findByUserId(userId) {
    const [vehicles] = await db.query('SELECT * FROM Vehicles WHERE user_id = ?', [userId]);
    return vehicles;
  }

  static async create(userId, licensePlate, vehicleType) {
    const [result] = await db.query(
      'INSERT INTO Vehicles (user_id, license_plate, vehicle_type) VALUES (?, ?, ?)',
      [userId, licensePlate, vehicleType]
    );
    return result.insertId;
  }
}

module.exports = Vehicle; 