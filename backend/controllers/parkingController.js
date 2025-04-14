const parkingModel = require('../models/parkingModel');

// Hàm chuyển đổi định dạng ngày từ "YYYY-MM-DD" sang "DD/MM/YYYY"
const formatDateForFrontend = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

// Lấy danh sách khu vực đỗ xe
const getParkingZones = async (req, res) => {
  try {
    const { type, startDate, startTime, endDate, endTime } = req.query;

    const lots = await parkingModel.getParkingZones();
    const parkingZones = await Promise.all(
      lots.map(async (lot) => {
        const lotId = lot.lot_id;
        const totalSpots = await parkingModel.getTotalSpots(lotId);
        let availableSpots = totalSpots;

        if (startDate && endDate) {
          availableSpots = await parkingModel.getAvailableSpots(
            lotId,
            type,
            startDate,
            startTime,
            endDate,
            endTime
          );
        }

        return {
          id: lotId,
          name: `Khu ${lotId.charAt(0)}`,
          totalSpots,
          availableSpots,
        };
      })
    );

    res.json(parkingZones);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Tạo đặt chỗ
const createBooking = async (req, res) => {
  try {
    const { type, userId, zoneId, startDate, startTime, endDate, endTime, duration } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!type || !userId || !zoneId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (type === 'daily' && (!startTime || !endTime || !duration)) {
      return res.status(400).json({ message: 'Missing time fields for daily booking' });
    }

    // Kiểm tra quyền của người dùng
    const userPermission = await parkingModel.checkUserPermission(userId);
    console.log('🔍 Kiểm tra quyền user:', userId, '=>', userPermission);
    if (!userPermission || !['Read', 'Write', 'Admin'].includes(userPermission)) {
      return res.status(403).json({ message: 'User does not have permission to book' });
    }

    // Kiểm tra tính khả dụng
    const availableSpots = await parkingModel.getAvailableSpots(
      zoneId,
      type,
      startDate,
      startTime,
      endDate,
      endTime
    );
    console.log('🔍 Kiểm tra số chỗ trống:' , availableSpots);
    if (availableSpots <= 0) {
      return res.status(400).json({ message: 'No available spots for the selected time' });
    }

    // Tìm spot trống
    const spot = await parkingModel.findAvailableSpot(zoneId, startDate, startTime, endDate, endTime);
    console.log('🎯 Spot được chọn:', spot);
    if (!spot) {
      return res.status(400).json({ message: 'No available spots for the selected time' });
    }

    // Tạo vé (ticket)
    const ticketData = {
      user_id: userId,
      vehicle_id: null, // Có thể yêu cầu người dùng chọn vehicle_id từ bảng vehicles
      issue_date: parkingModel.parseDateForMySQL(startDate),
      expiry_date: parkingModel.parseDateForMySQL(endDate),
      type: type === 'daily' ? 'Daily' : 'Monthly',
    };

    const ticketId = await parkingModel.createTicket(ticketData);
    console.log('🎫 Ticket ID:', ticketId);

    // Tạo đặt chỗ
    const bookingData = {
      user_id: userId,
      spot_id: spot.spot_id,
      start_time: `${parkingModel.parseDateForMySQL(startDate)} ${startTime || '00:00'}:00`,
      end_time: `${parkingModel.parseDateForMySQL(endDate)} ${endTime || '23:59'}:00`,
      status: 'Pending',
    };

    const bookingId = await parkingModel.createBooking(bookingData);
    console.log('📦 Booking ID:', bookingId);
    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        id: bookingId,
        userId: bookingData.user_id,
        spotId: bookingData.spot_id,
        startTime: bookingData.start_time,
        endTime: bookingData.end_time,
        status: bookingData.status,
      },
      ticket: {
        id: ticketId,
        userId: ticketData.user_id,
        issueDate: formatDateForFrontend(ticketData.issue_date),
        expiryDate: formatDateForFrontend(ticketData.expiry_date),
        type: ticketData.type,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi tại createBooking:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Lấy thông tin người dùng
const getUserById = async (req, res) => {
  try {
    const user = await parkingModel.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user.user_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getParkingZones,
  createBooking,
  getUserById,
};