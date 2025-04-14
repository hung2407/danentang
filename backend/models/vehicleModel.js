const db = require('../config/database');

// Lấy thông tin xe theo biển số
const getVehicleByPlate = async (plateNumber) => {
  try {
    const [vehicles] = await db.query(
      'SELECT * FROM vehicles WHERE plate_number = ?',
      [plateNumber]
    );
    return vehicles[0];
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin xe theo biển số:', error);
    throw error;
  }
};

// Lấy thông tin xe theo ID
const getVehicleById = async (vehicleId) => {
  try {
    const [vehicles] = await db.query(
      'SELECT * FROM vehicles WHERE vehicle_id = ?',
      [vehicleId]
    );
    return vehicles[0];
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin xe theo ID:', error);
    throw error;
  }
};

// Lấy danh sách xe của người dùng
const getUserVehicles = async (userId) => {
  try {
    const [vehicles] = await db.query(
      'SELECT * FROM vehicles WHERE user_id = ?',
      [userId]
    );
    return vehicles;
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách xe của người dùng:', error);
    throw error;
  }
};

// Tạo xe mới
const createVehicle = async (vehicleData) => {
  try {
    const [result] = await db.query(
      'INSERT INTO vehicles (user_id, plate_number, phone_number, type) VALUES (?, ?, ?, ?)',
      [
        vehicleData.user_id,
        vehicleData.plate_number,
        vehicleData.phone_number || null,
        vehicleData.type
      ]
    );
    return result.insertId;
  } catch (error) {
    console.error('❌ Lỗi khi tạo xe mới:', error);
    throw error;
  }
};

module.exports = {
  getVehicleByPlate,
  getVehicleById,
  getUserVehicles,
  createVehicle
};