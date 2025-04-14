const db = require('../config/database');

// Hàm chuyển đổi định dạng ngày từ "DD/MM/YYYY" sang "YYYY-MM-DD"
const parseDateForMySQL = (dateStr) => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

// Lấy danh sách các lot_id duy nhất từ bảng spots
const getParkingZones = async () => {
  try {
    console.log(' Đang truy vấn parking zones...');
    const [lots] = await db.query(`
      SELECT DISTINCT 
        s.lot_id,
        s.status,
        COUNT(*) as total_spots
      FROM spots s
      GROUP BY s.lot_id, s.status
    `);
    console.log('✅ Kết quả truy vấn:', lots);
    return lots;
  } catch (error) {
    console.error('❌ Lỗi khi lấy parking zones:', error);
    throw error;
  }
};

// Lấy tổng số chỗ của một khu vực (lot_id)
const getTotalSpots = async (lotId) => {
  const [totalSpotsRows] = await db.query(
    'SELECT COUNT(*) as totalSpots FROM spots WHERE lot_id = ?',
    [lotId]
  );
  return totalSpotsRows[0].totalSpots;
};

// Lấy số chỗ trống của một khu vực trong khoảng thời gian
const getAvailableSpots = async (lotId, type, startDate, startTime, endDate, endTime) => {
  const [totalSpotsRows] = await db.query(
    'SELECT COUNT(*) as totalSpots FROM spots WHERE lot_id = ? AND status = "Available"',
    [lotId]
  );
  const totalSpots = totalSpotsRows[0].totalSpots;

  const start = parseDateForMySQL(startDate);
  const end = parseDateForMySQL(endDate);
  const startDateTime = type === 'daily' ? `${start} ${startTime}:00` : `${start} 00:00:00`;
  const endDateTime = type === 'daily' ? `${end} ${endTime}:00` : `${end} 23:59:59`;

  const [bookedSpotsRows] = await db.query(
    `
    SELECT COUNT(*) as bookedSpots
    FROM bookings b
    JOIN spots s ON b.spot_id = s.spot_id
    WHERE s.lot_id = ?
      AND b.status = 'Confirmed'
      AND (
        (b.start_time <= ? AND b.end_time >= ?)
      )
    `,
    [lotId, endDateTime, startDateTime]
  );
  const bookedSpots = bookedSpotsRows[0].bookedSpots;

  return Math.max(0, totalSpots - bookedSpots);
};

// Kiểm tra quyền của người dùng
const checkUserPermission = async (userId) => {
  const [permissions] = await db.query(
    'SELECT permission_level FROM permissions WHERE user_id = ?',
    [userId]
  );
  return permissions[0]?.permission_level;
};

// Tìm spot trống trong khu vực và khoảng thời gian
const findAvailableSpot = async (lotId, startDate, startTime, endDate, endTime) => {
  const startDateTime = `${parseDateForMySQL(startDate)} ${startTime || '00:00'}:00`;
  const endDateTime = `${parseDateForMySQL(endDate)} ${endTime || '23:59'}:00`;

  const [availableSpotRows] = await db.query(
    `
    SELECT s.spot_id
    FROM spots s
    LEFT JOIN bookings b ON s.spot_id = b.spot_id
      AND b.status = 'Confirmed'
      AND (
        (b.start_time <= ? AND b.end_time >= ?)
      )
    WHERE s.lot_id = ?
      AND s.status = 'Available'
      AND b.spot_id IS NULL
    LIMIT 1
    `,
    [endDateTime, startDateTime, lotId]
  );

  return availableSpotRows[0];
};

// Tạo ticket
const createTicket = async (ticketData) => {
  const [result] = await db.query(
    'INSERT INTO tickets (user_id, vehicle_id, issue_date, expiry_date, type) VALUES (?, ?, ?, ?, ?)',
    [
      ticketData.user_id,
      ticketData.vehicle_id,
      ticketData.issue_date,
      ticketData.expiry_date,
      ticketData.type,
    ]
  );
  return result.insertId;
};

// Tạo booking
const createBooking = async (bookingData) => {
  const [result] = await db.query(
    'INSERT INTO bookings (user_id, spot_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)',
    [
      bookingData.user_id,
      bookingData.spot_id,
      bookingData.start_time,
      bookingData.end_time,
      bookingData.status,
    ]
  );
  return result.insertId;
};

// Lấy thông tin người dùng
const getUserById = async (userId) => {
  const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [userId]);
  return users[0];
};

module.exports = {
  parseDateForMySQL,
  getParkingZones,
  getTotalSpots,
  getAvailableSpots,
  checkUserPermission,
  findAvailableSpot,
  createTicket,
  createBooking,
  getUserById,
};