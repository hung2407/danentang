// server.js
const express = require('express');
const dotenv = require('dotenv');
const sequelize = require('./config/database');
const models = require('./models');

dotenv.config();

const app = express();

app.use(express.json());

// Đồng bộ hóa cơ sở dữ liệu
sequelize.sync({ alter: true }).then(() => {
  console.log('Đã đồng bộ hóa cơ sở dữ liệu thành công');
}).catch(err => {
  console.error('Lỗi khi đồng bộ hóa cơ sở dữ liệu:', err);
});

// In giá trị của các module route để debug
console.log('Auth route:', require('./routes/auth'));
console.log('Parking route:', require('./routes/parking'));
console.log('Booking route:', require('./routes/booking'));

// Sử dụng các route middleware
app.use('/api/auth', require('./routes/auth'));
app.use('/api/parkings', require('./routes/parking'));
app.use('/api/bookings', require('./routes/booking'));

app.get('/', (req, res) => {
  res.send('Chào mừng đến với Backend thuê bãi đỗ xe!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));
