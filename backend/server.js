const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/database');
const authRoutes = require('./routes/auth');

// Load biến môi trường
dotenv.config();

// Khởi tạo express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log tất cả requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
console.log('Auth routes đã được đăng ký tại /api/auth');

// Route test kết nối database
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({
      message: 'Kết nối database thành công!',
      data: rows[0]
    });
  } catch (error) {
    console.error('Lỗi truy vấn:', error);
    res.status(500).json({
      message: 'Lỗi kết nối database',
      error: error.message
    });
  }
});

// Route mặc định
app.get('/', (req, res) => {
  res.json({ message: 'Server đang chạy!' });
});

// Xử lý lỗi
app.use((err, req, res, next) => {
  console.error('Lỗi server:', err);
  res.status(500).json({ 
    message: 'Lỗi server', 
    error: err.message 
  });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên port ${PORT}`);
}); 