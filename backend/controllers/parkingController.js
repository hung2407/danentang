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
    console.log('Received booking request:', req.body);
    const { type, userId, zoneId, vehicleId, startDate, startTime, endDate, endTime } = req.body;

    // Validate all required fields
    if (!userId || !zoneId || !startDate || !endDate || !type || !vehicleId) {
      console.log('Missing fields:', { userId, zoneId, startDate, endDate, type, vehicleId });
      return res.status(400).json({ 
        message: 'Thiếu thông tin bắt buộc',
        required: ['userId', 'zoneId', 'startDate', 'endDate', 'type', 'vehicleId'],
        received: req.body 
      });
    }

    // Validate vehicle ownership
    const vehicle = await parkingModel.getVehicleById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin xe' });
    }
    
    if (vehicle.user_id != userId) {
      return res.status(403).json({ message: 'Xe này không thuộc về bạn' });
    }

    // Format dates for MySQL
    const formattedStartDate = parkingModel.parseDateForMySQL(startDate);
    const formattedEndDate = parkingModel.parseDateForMySQL(endDate);
    
    // Check spot availability
    const availableSpots = await parkingModel.getAvailableSpots(
      zoneId,
      type,
      startDate,
      startTime,
      endDate,
      endTime
    );

    if (availableSpots <= 0) {
      return res.status(400).json({ message: 'Không có chỗ trống trong khoảng thời gian đã chọn' });
    }

    // Find available spot
    const spot = await parkingModel.findAvailableSpot(zoneId, startDate, startTime, endDate, endTime);
    if (!spot) {
      return res.status(400).json({ message: 'Không tìm thấy chỗ trống' });
    }

    // Create ticket
    const ticketData = {
      user_id: userId,
      vehicle_id: vehicleId,
      issue_date: formattedStartDate,
      expiry_date: formattedEndDate,
      type: type
    };

    const ticketId = await parkingModel.createTicket(ticketData);
    console.log('Ticket created:', ticketId);

    // Create booking
    const bookingData = {
      user_id: userId,
      spot_id: spot.spot_id,
      start_time: `${formattedStartDate} ${startTime || '00:00'}:00`,
      end_time: `${formattedEndDate} ${endTime || '23:59'}:00`,
      status: 'Pending'
    };

    const bookingId = await parkingModel.createBooking(bookingData);
    console.log('Booking created:', bookingId);

    res.status(201).json({
      message: 'Đặt chỗ thành công',
      booking: {
        id: bookingId,
        userId: bookingData.user_id,
        spotId: spot.spot_id,
        startTime: bookingData.start_time,
        endTime: bookingData.end_time,
        status: 'Pending'
      },
      ticket: {
        id: ticketId,
        vehicleId: vehicleId,
        plateNumber: vehicle.plate_number,
        issueDate: formatDateForFrontend(ticketData.issue_date),
        expiryDate: formatDateForFrontend(ticketData.expiry_date),
        type: ticketData.type
      }
    });

  } catch (error) {
    console.error('❌ Error in createBooking:', error);
    res.status(500).json({ 
      message: 'Lỗi máy chủ', 
      error: error.message,
      stack: error.stack 
    });
  }
};

// Add new endpoint to get parking zones with availability
const getParkingZonesAvailability = async (req, res) => {
  try {
    const { date, time } = req.query;
    const zones = await parkingModel.getParkingZones();
    
    const zonesWithAvailability = await Promise.all(
      zones.map(async (zone) => {
        const available = await parkingModel.getAvailableSpots(
          zone.lot_id,
          date,
          time
        );
        return {
          id: zone.lot_id,
          name: `Khu ${zone.name}`,
          totalSpots: zone.total_spots,
          availableSpots: available,
          status: zone.status
        };
      })
    );

    res.json(zonesWithAvailability);
  } catch (error) {
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
  getParkingZonesAvailability,
};