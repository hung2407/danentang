// server.js
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
dotenv.config();

connectDB();

const app = express();

app.use(express.json());

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
