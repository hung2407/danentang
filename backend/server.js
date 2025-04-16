const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/booking');
const cors = require('cors');

// Load biến môi trường
dotenv.config();

// Khởi tạo express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log tất cả requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
console.log('Routes đã được đăng ký: /api/auth, /api/bookings');

// Route mặc định
app.get('/', (req, res) => {
  res.json({ message: 'API Hệ thống quản lý bãi đỗ xe đang hoạt động!' });
});

// Xử lý lỗi
app.use((err, req, res, next) => {
  console.error('Lỗi server:', err);
  res.status(500).json({ 
    success: false,
    message: 'Lỗi server', 
    error: err.message 
  });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên port ${PORT}`);
  
  // Kiểm tra kết nối database
  db.query('SELECT 1')
    .then(() => {
      console.log('Kết nối database thành công');
    })
    .catch(err => {
      console.error('Lỗi kết nối database:', err);
    });
}); 