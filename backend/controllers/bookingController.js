const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const ParkingZone = require('../models/ParkingZone');
const Vehicle = require('../models/Vehicle');
const TicketPrice = require('../models/TicketPrice');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const User = require('../models/User');

// Controller xử lý bookings
const bookingController = {
  // Lấy thông tin các khu vực đỗ xe
  async getParkingZones(req, res) {
    try {
      const zones = await ParkingZone.getAvailableZones();

      res.json({
        success: true,
        data: zones
      });
    } catch (error) {
      console.error('Lỗi khi lấy thông tin khu vực đỗ xe:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi lấy thông tin khu vực đỗ xe',
        error: error.message
      });
    }
  },

  // Lấy thông tin chi tiết về một khu vực đỗ xe
  async getZoneDetails(req, res) {
    try {
      const { zoneId } = req.params;
      const zoneDetails = await ParkingZone.getZoneDetails(zoneId);

      if (!zoneDetails) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khu vực đỗ xe'
        });
      }

      res.json({
        success: true,
        data: zoneDetails
      });
    } catch (error) {
      console.error('Lỗi khi lấy thông tin chi tiết khu vực:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi lấy thông tin chi tiết khu vực',
        error: error.message
      });
    }
  },

  // Kiểm tra biển số xe
  async checkLicensePlate(req, res) {
    try {
      const { licensePlate, userId } = req.body;

      // Kiểm tra định dạng biển số xe
      const plateRegex = /^[0-9]{2}\s[A-Z][A-Z0-9]\s[0-9]{3,5}$/;
      if (!plateRegex.test(licensePlate)) {
        return res.status(400).json({
          success: false,
          message: 'Biển số xe không hợp lệ. Định dạng: 26 A1 12345'
        });
      }

      // Kiểm tra biển số xe đã tồn tại chưa
      const existingVehicle = await Vehicle.findByLicensePlate(licensePlate);

      if (existingVehicle) {
        // Xe đã tồn tại trong hệ thống
        // Kiểm tra xem xe có thuộc về user không
        if (existingVehicle.user_id !== parseInt(userId)) {
          return res.status(400).json({
            success: false,
            message: 'Biển số xe này đã được đăng ký bởi người dùng khác'
          });
        }

        return res.json({
          success: true,
          message: 'Biển số xe hợp lệ',
          data: {
            vehicleId: existingVehicle.vehicle_id,
            licensePlate: existingVehicle.license_plate,
            vehicleType: existingVehicle.vehicle_type,
            isExisting: true
          }
        });
      }

      // Biển số xe chưa tồn tại
      res.json({
        success: true,
        message: 'Biển số xe hợp lệ và chưa được đăng ký',
        data: {
          licensePlate,
          isExisting: false
        }
      });
    } catch (error) {
      console.error('Lỗi khi kiểm tra biển số xe:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi kiểm tra biển số xe',
        error: error.message
      });
    }
  },

  // Tính giá đặt chỗ
  async calculateBookingPrice(req, res) {
    try {
      const { bookingType, startTime, endTime } = req.body;

      // Kiểm tra dữ liệu đầu vào
      if (!bookingType || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin cần thiết'
        });
      }

      // Lấy giá phù hợp nhất cho thời điểm hiện tại
      const priceInfo = await TicketPrice.getCurrentPrice(bookingType);

      if (!priceInfo) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin giá'
        });
      }

      let totalPrice = 0;

      if (bookingType === 'daily') {
        // Tính thời gian đặt chỗ theo giờ
        const start = new Date(startTime);
        const end = new Date(endTime);
        const durationHours = Math.ceil((end - start) / (1000 * 60 * 60));
        
        // Tính giá: giá/giờ * số giờ
        totalPrice = priceInfo.price * durationHours;
      } else if (bookingType === 'monthly') {
        // Đối với vé tháng, giá được tính trọn gói
        totalPrice = priceInfo.price;
      }

      res.json({
        success: true,
        data: {
          priceId: priceInfo.price_id,
          pricePerUnit: priceInfo.price,
          bookingType: priceInfo.ticket_type,
          totalPrice,
          currency: 'VND'
        }
      });
    } catch (error) {
      console.error('Lỗi khi tính giá đặt chỗ:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi tính giá đặt chỗ',
        error: error.message
      });
    }
  },

  // Đặt chỗ đỗ xe
  async createBooking(req, res) {
    try {
      const { 
        userId, 
        vehicleId, 
        slotId, 
        priceId, 
        bookingType, 
        startTime,
        endTime,
        licensePlate, 
        vehicleType = 'sedan', 
        phoneNumber 
      } = req.body;

      // Kiểm tra dữ liệu đầu vào
      if (!userId || !slotId || !priceId || !bookingType || !startTime || !endTime || !licensePlate || !phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin cần thiết'
        });
      }

      // Bắt đầu transaction
      await db.query('START TRANSACTION');

      try {
        // Kiểm tra xem slot có còn trống không
        const [slotStatus] = await db.query(
          'SELECT status FROM Slots WHERE slot_id = ?',
          [slotId]
        );

        if (slotStatus.length === 0 || slotStatus[0].status !== 'available') {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Chỗ đỗ xe không còn trống'
          });
        }

        // Kiểm tra và đăng ký vehicle nếu cần
        let actualVehicleId = vehicleId;

        if (!actualVehicleId) {
          actualVehicleId = await Vehicle.create(userId, licensePlate, vehicleType);
        }

        // Tạo mã QR
        const qrCode = uuidv4();

        // Tạo booking
        const bookingId = await Booking.create({
          userId, 
          vehicleId: actualVehicleId, 
          slotId, 
          ticketPriceId: priceId, 
          bookingType, 
          startTime, 
          endTime, 
          qrCode
        });

        // Cập nhật thông tin người dùng nếu cần
        if (phoneNumber) {
          await User.updatePhone(userId, phoneNumber);
        }

        // Lấy thông tin booking vừa tạo
        const bookingDetails = await Booking.getBookingDetails(bookingId);

        if (!bookingDetails) {
          await db.query('ROLLBACK');
          return res.status(500).json({
            success: false,
            message: 'Không thể lấy thông tin đặt chỗ sau khi tạo'
          });
        }

        // Tạo payment record
        let totalPrice = 0;
        if (bookingType === 'daily') {
          const start = new Date(startTime);
          const end = new Date(endTime);
          const durationHours = Math.ceil((end - start) / (1000 * 60 * 60));
          totalPrice = bookingDetails.price * durationHours;
        } else {
          totalPrice = bookingDetails.price;
        }

        const paymentId = await Payment.create(bookingId, totalPrice);

        // Commit transaction
        await db.query('COMMIT');

        // Tạo QR code
        const qrCodeImage = await QRCode.toDataURL(qrCode);

        res.status(201).json({
          success: true,
          message: 'Đặt chỗ thành công',
          data: {
            bookingId,
            bookingDetails,
            paymentId,
            amount: totalPrice,
            qrCode: qrCodeImage
          }
        });
      } catch (error) {
        console.error('Lỗi trong quá trình đặt chỗ, rollback:', error);
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Lỗi khi đặt chỗ đỗ xe:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi đặt chỗ đỗ xe',
        error: error.message
      });
    }
  },

  // Lấy booking của user
  async getUserBookings(req, res) {
    try {
      const { userId } = req.params;
      const bookings = await Booking.getUserBookings(userId);

      if (bookings.length === 0) {
        return res.json({
          success: true,
          message: 'Người dùng chưa có đặt chỗ nào',
          data: []
        });
      }

      // Tạo QR code cho mỗi booking
      const bookingsWithQRCode = await Promise.all(bookings.map(async (booking) => {
        const qrCodeImage = await QRCode.toDataURL(booking.qr_code);
        return {
          ...booking,
          qrCodeImage
        };
      }));

      res.json({
        success: true,
        data: bookingsWithQRCode
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đặt chỗ:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi lấy danh sách đặt chỗ',
        error: error.message
      });
    }
  },

  // Hủy booking
  async cancelBooking(req, res) {
    try {
      const { bookingId, userId } = req.params;

      // Kiểm tra booking có tồn tại và thuộc về user không
      const [bookingCheck] = await db.query(
        'SELECT * FROM Bookings WHERE booking_id = ? AND user_id = ?',
        [bookingId, userId]
      );

      if (bookingCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin đặt chỗ'
        });
      }

      const booking = bookingCheck[0];

      // Kiểm tra xem booking đã hoàn thành hoặc đã hủy chưa
      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: `Không thể hủy đặt chỗ đã ${booking.status === 'completed' ? 'hoàn thành' : 'bị hủy'}`
        });
      }

      // Kiểm tra thời gian hủy (nếu là booking ngày và thời gian bắt đầu < 2 giờ nữa)
      const now = new Date();
      const startTime = new Date(booking.start_time);
      const timeUntilStart = startTime.getTime() - now.getTime();
      const hoursUntilStart = timeUntilStart / (1000 * 60 * 60);

      let cancellationFee = 0;
      
      // Nếu đặt theo ngày và sắp đến giờ đặt (< 2 giờ) thì tính phí hủy
      if (booking.booking_type === 'daily' && hoursUntilStart < 2 && hoursUntilStart > 0) {
        // Lấy thông tin payment
        const paymentInfo = await Payment.findByBookingId(bookingId);
        
        if (paymentInfo) {
          // Phí hủy là 50% tổng số tiền
          cancellationFee = paymentInfo.amount * 0.5;
        }
      }

      // Cập nhật trạng thái booking
      await Booking.updateStatus(bookingId, 'cancelled');

      // Kiểm tra xem đã có payment nào chưa và cập nhật
      const paymentInfo = await Payment.findByBookingId(bookingId);

      if (paymentInfo) {
        // Nếu đã có payment, cập nhật trạng thái
        await Payment.updateStatus(paymentInfo.payment_id, cancellationFee > 0 ? 'pending' : 'completed');
        await Payment.updateAmount(paymentInfo.payment_id, cancellationFee);
      } else if (cancellationFee > 0) {
        // Nếu chưa có payment và có phí hủy, tạo payment mới
        await Payment.create(bookingId, cancellationFee);
      }

      res.json({
        success: true,
        message: 'Hủy đặt chỗ thành công',
        data: {
          bookingId,
          cancellationFee
        }
      });
    } catch (error) {
      console.error('Lỗi khi hủy đặt chỗ:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi hủy đặt chỗ',
        error: error.message
      });
    }
  }
};

module.exports = bookingController; 