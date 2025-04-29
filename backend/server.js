const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/booking');
const cors = require('cors');
const expressWs = require('express-ws'); 
const Reservation = require('./models/Reservation');
const ParkingZone = require('./models/ParkingZone');

// Load biến môi trường
dotenv.config();

// Khởi tạo express app
const app = express();

// Khởi tạo WebSocket với Express
const wss = expressWs(app);
app.set('wss', wss.getWss());

// WebSocket endpoint để cập nhật thời gian thực
app.ws('/updates', (ws, req) => {
  console.log('Client connected to WebSocket');

  ws.on('message', (msg) => {
    console.log('Received:', msg);
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Kiểm tra đặt chỗ hết hạn mỗi 1 phút và gửi cập nhật qua WebSocket
setInterval(async () => {
  try {
    // Get expired reservations before updating them to get their timeframes
    const [expiredReservations] = await db.query(`
      SELECT b.booking_id, b.slot_id, b.start_time, b.end_time
      FROM Bookings b
      WHERE b.status = 'pending'
      AND b.created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    `);
    
    await Reservation.checkExpiredReservations();
    const zones = await ParkingZone.getAvailableZones();
    
    // Send zones updated event
    wss.getWss().clients.forEach(client => {
      if (client.readyState === 1) { // Kiểm tra trạng thái client (1 là OPEN)
        client.send(JSON.stringify({ event: 'zonesUpdated', data: zones }));
        
        // Send individual expired reservations events with timeframes
        expiredReservations.forEach(async reservation => {
          const [slotInfo] = await db.query(`
            SELECT zone_id FROM Slots WHERE slot_id = ?
          `, [reservation.slot_id]);
          
          if (slotInfo.length > 0) {
            client.send(JSON.stringify({
              event: 'bookingExpired',
              data: {
                bookingId: reservation.booking_id,
                slotId: reservation.slot_id,
                zoneId: slotInfo[0].zone_id,
                status: 'available',
                timeFrame: {
                  startTime: reservation.start_time,
                  endTime: reservation.end_time
                }
              }
            }));
          }
        });
      }
    });
  } catch (error) {
    console.error('Lỗi khi kiểm tra đặt chỗ hết hạn:', error);
  }
}, 60 * 1000);

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