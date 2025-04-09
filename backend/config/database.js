const mysql = require('mysql2');
require('dotenv').config();

console.log('Đang kết nối đến MySQL với thông tin:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Tạo kết nối pool để quản lý kết nối hiệu quả
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Kiểm tra kết nối
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Lỗi kết nối với database:', err);
    return;
  }
  console.log('Đã kết nối thành công với MySQL database!');
  connection.release(); // Giải phóng kết nối về pool
});

// Export promise pool để sử dụng async/await
const promisePool = pool.promise();

// Test kết nối
promisePool.query('SELECT 1')
  .then(() => console.log('Kết nối database hoạt động tốt'))
  .catch(err => console.error('Lỗi test kết nối database:', err));

module.exports = promisePool; 