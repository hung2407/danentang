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
      const { startTime, endTime } = req.query; // Lấy startTime và endTime từ query parameters

      // Tạo timeFilter nếu có startTime và endTime
      const timeFilter = (startTime && endTime) ? { startTime, endTime } : null;

      // Lấy thông tin zone với timeFilter
      const zoneDetails = await ParkingZone.getZoneDetails(zoneId, timeFilter);
      
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
        // Kiểm tra xem xe này có booking nào chưa hoàn thành không
        const [activeBookings] = await db.query(
          'SELECT * FROM Bookings WHERE vehicle_id = ? AND status NOT IN ("completed", "cancelled")',
          [existingVehicle.vehicle_id]
        );
        if (activeBookings.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Biển số xe này đang có booking chưa hoàn thành'
          });
        }
        // Nếu không còn booking nào active, cho phép booking lại
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
        let durationHours = Math.ceil((end - start) / (1000 * 60 * 60));
        if (durationHours <= 0) {
          // Nếu end < start, cộng thêm 24h (qua ngày hôm sau)
          durationHours += 24;
        }
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

  // Đặt chỗ đỗ xe (cập nhật xác thực thời gian thực, giữ chỗ tạm thời)
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

      if (!userId || !slotId || !priceId || !bookingType || !startTime || !endTime || !licensePlate || !phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin cần thiết'
        });
      }

      await db.query('START TRANSACTION');
      try {
        // Kiểm tra trạng thái slot: chỉ cho phép nếu available hoặc pending nhưng đã hết hạn giữ
        const [slotRows] = await db.query(
          `SELECT status, pending_until FROM Slots WHERE slot_id = ? FOR UPDATE`,
          [slotId]
        );
        if (slotRows.length === 0) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Chỗ đỗ xe không tồn tại'
          });
        }
        const slot = slotRows[0];
        const now = new Date();
        let canHold = false;
        if (slot.status === 'available') {
          canHold = true;
        } else if (slot.status === 'pending' && slot.pending_until && new Date(slot.pending_until) < now) {
          canHold = true;
        }
        if (!canHold) {
          await db.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: 'Chỗ đỗ xe đã có người giữ hoặc đang được đặt.'
          });
        }
        // Giữ chỗ: cập nhật status = 'pending', pending_until = NOW() + 5 phút
        await db.query(
          `UPDATE Slots SET status = 'pending', pending_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE slot_id = ?`,
          [slotId]
        );

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
          let durationHours = Math.ceil((end - start) / (1000 * 60 * 60));
          if (durationHours <= 0) {
            durationHours += 24;
          }
          totalPrice = bookingDetails.price * durationHours;
        } else {
          totalPrice = bookingDetails.price;
        }
        const paymentId = await Payment.create(bookingId, totalPrice);
        
        // Lấy thông tin zone
        const [slotInfo] = await db.query(
          `SELECT zone_id FROM Slots WHERE slot_id = ?`,
          [slotId]
        );
        const zoneId = slotInfo[0].zone_id;
        
        // Lấy thông tin zone sau khi cập nhật
        const [zoneInfo] = await db.query(
          `SELECT 
            z.zone_id as id, z.zone_name as name, 
            z.total_slots as totalSpots, z.available_slots as availableSpots
          FROM Zones z WHERE z.zone_id = ?`,
          [zoneId]
        );
        
        // Gửi thông báo WebSocket về booking mới
        const wss = req.app.get('wss');
        if (wss) {
          wss.clients.forEach(client => {
            if (client.readyState === 1) { // 1 = WebSocket.OPEN
              client.send(JSON.stringify({
                event: 'bookingCreated',
                data: {
                  bookingId,
                  slotId,
                  zoneId,
                  zoneInfo: zoneInfo[0],
                  status: 'pending',
                  timeFrame: {
                    startTime,
                    endTime
                  }
                }
              }));
            }
          });
        }
        
        // Commit transaction
        await db.query('COMMIT');
        // Tạo QR code
        const qrCodeImage = await QRCode.toDataURL(qrCode);
        res.status(201).json({
          success: true,
          message: 'Đặt chỗ thành công. Chỗ của bạn sẽ được giữ trong 5 phút, vui lòng xác nhận và thanh toán.',
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
      
      // Lấy thông tin slot và zone
      const [slotInfo] = await db.query(
        'SELECT s.slot_id, s.zone_id FROM Slots s JOIN Bookings b ON s.slot_id = b.slot_id WHERE b.booking_id = ?',
        [bookingId]
      );
      
      if (slotInfo.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin slot'
        });
      }
      
      const slotId = slotInfo[0].slot_id;
      const zoneId = slotInfo[0].zone_id;

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
      
      // Cập nhật trạng thái slot về available
      await db.query('UPDATE Slots SET status = "available" WHERE slot_id = ?', [slotId]);
      
      // Cập nhật số lượng chỗ trống trong zone
      await db.query('UPDATE Zones SET available_slots = available_slots + 1 WHERE zone_id = ?', [zoneId]);

      // Gửi thông báo WebSocket về booking bị hủy
      const wss = req.app.get('wss');
      if (wss) {
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // 1 = WebSocket.OPEN
            client.send(JSON.stringify({
              event: 'bookingCancelled',
              data: {
                bookingId,
                slotId,
                zoneId,
                status: 'available',
                timeFrame: {
                  startTime: booking.start_time,
                  endTime: booking.end_time
                }
              }
            }));
          }
        });
      }

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
      
      // Lấy thông tin zone sau khi cập nhật
      const [zoneInfo] = await db.query(
        `SELECT 
          z.zone_id as id, z.zone_name as name, 
          z.total_slots as totalSpots, z.available_slots as availableSpots
        FROM Zones z WHERE z.zone_id = ?`,
        [zoneId]
      );
      
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
  },

  // Check-in booking (ghi vào bảng check_in_out)
  async checkInBooking(req, res) {
    try {
      const { bookingId } = req.body;
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
      }
      if (booking.status !== 'confirmed' && booking.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Booking không hợp lệ để check-in' });
      }
      
      // Lấy thông tin slot và zone
      const [slotInfo] = await db.query(
        'SELECT s.slot_id, s.zone_id FROM Slots s WHERE s.slot_id = ?',
        [booking.slot_id]
      );
      
      if (slotInfo.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin slot' });
      }
      
      const slotId = slotInfo[0].slot_id;
      const zoneId = slotInfo[0].zone_id;
      
      await Booking.updateStatus(bookingId, 'checked_in');
      await db.query('UPDATE Slots SET status = ? WHERE slot_id = ?', ['occupied', booking.slot_id]);
      await db.query('UPDATE Bookings SET checkin_time = NOW() WHERE booking_id = ?', [bookingId]);
      // Ghi vào bảng check_in_out
      await db.query('INSERT INTO check_in_out (booking_id, check_in_time) VALUES (?, NOW())', [bookingId]);
      
      // Lấy thông tin zone sau khi cập nhật
      const [zoneInfo] = await db.query(
        `SELECT 
          z.zone_id as id, z.zone_name as name, 
          z.total_slots as totalSpots, z.available_slots as availableSpots
        FROM Zones z WHERE z.zone_id = ?`,
        [zoneId]
      );
      
      // Gửi thông báo WebSocket về check-in
      const wss = req.app.get('wss');
      if (wss) {
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // 1 = WebSocket.OPEN
            client.send(JSON.stringify({
              event: 'bookingCheckedIn',
              data: {
                bookingId,
                slotId,
                zoneId,
                zoneInfo: zoneInfo[0],
                status: 'checked_in'
              }
            }));
          }
        });
      }
      
      res.json({ success: true, message: 'Check-in thành công' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi check-in', error: error.message });
    }
  },

  // Check-out booking (ghi vào bảng check_in_out)
  async checkOutBooking(req, res) {
    try {
      const { bookingId } = req.body;
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
      }
      if (booking.status !== 'checked_in') {
        return res.status(400).json({ success: false, message: 'Booking chưa check-in hoặc đã check-out' });
      }
      
      // Lấy thông tin slot và zone
      const [slotInfo] = await db.query(
        'SELECT s.slot_id, s.zone_id FROM Slots s WHERE s.slot_id = ?',
        [booking.slot_id]
      );
      
      if (slotInfo.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin slot' });
      }
      
      const slotId = slotInfo[0].slot_id;
      const zoneId = slotInfo[0].zone_id;
      
      await Booking.updateStatus(bookingId, 'completed');
      await db.query('UPDATE Slots SET status = ? WHERE slot_id = ?', ['available', booking.slot_id]);
      await db.query('UPDATE Bookings SET checkout_time = NOW() WHERE booking_id = ?', [bookingId]);
      // Cập nhật check_out_time vào bảng check_in_out
      await db.query('UPDATE check_in_out SET check_out_time = NOW() WHERE booking_id = ? AND check_out_time IS NULL', [bookingId]);
      
      // Cập nhật số lượng chỗ trống trong zone
      await db.query('UPDATE Zones SET available_slots = available_slots + 1 WHERE zone_id = ?', [zoneId]);
      
      // Lấy thông tin zone sau khi cập nhật
      const [zoneInfo] = await db.query(
        `SELECT 
          z.zone_id as id, z.zone_name as name, 
          z.total_slots as totalSpots, z.available_slots as availableSpots
        FROM Zones z WHERE z.zone_id = ?`,
        [zoneId]
      );
      
      // Gửi thông báo WebSocket về check-out
      const wss = req.app.get('wss');
      if (wss) {
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // 1 = WebSocket.OPEN
            client.send(JSON.stringify({
              event: 'bookingCheckedOut',
              data: {
                bookingId,
                slotId,
                zoneId,
                zoneInfo: zoneInfo[0],
                status: 'completed'
              }
            }));
          }
        });
      }
      
      res.json({ success: true, message: 'Check-out thành công' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi check-out', error: error.message });
    }
  },

  // Lấy hóa đơn và mã QR sau khi thanh toán thành công
  async getInvoiceAndQRCode(req, res) {
    try {
      const { bookingId } = req.body;
      // Lấy thông tin booking
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
      }
      // Kiểm tra trạng thái thanh toán
      const [payments] = await db.query('SELECT * FROM Payments WHERE booking_id = ? AND payment_status = "completed"', [bookingId]);
      if (!payments.length) {
        return res.status(400).json({ success: false, message: 'Chưa thanh toán thành công' });
      }
      // Lấy mã QR đã tạo khi booking
      const qrCode = booking.qr_code;
      const qrCodeImage = await QRCode.toDataURL(qrCode);
      res.json({
        success: true,
        message: 'Thanh toán thành công, đây là mã QR để check-in/check-out',
        data: {
          bookingId,
          qrCode: qrCodeImage
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi lấy mã QR', error: error.message });
    }
  },

  // Lấy hóa đơn và mã QR bằng bookingId (GET)
  async getInvoiceById(req, res) {
    try {
      const { bookingId } = req.params;
      // Lấy thông tin booking
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
      }
      // Kiểm tra trạng thái thanh toán
      const [payments] = await db.query('SELECT * FROM Payments WHERE booking_id = ? AND payment_status = "completed"', [bookingId]);
      if (!payments.length) {
        return res.status(400).json({ success: false, message: 'Chưa thanh toán thành công' });
      }
      // Lấy mã QR đã tạo khi booking
      const qrCode = booking.qr_code;
      const qrCodeImage = await QRCode.toDataURL(qrCode);
      res.json({
        success: true,
        message: 'Thanh toán thành công, đây là mã QR để check-in/check-out',
        data: {
          bookingId,
          qrCode: qrCodeImage
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi lấy mã QR', error: error.message });
    }
  },

  // Xác nhận thanh toán
  async confirmPayment(req, res) {
    try {
      const { bookingId, paymentStatus } = req.body;
      if (!bookingId || !paymentStatus) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
      }

      // Bắt đầu transaction
      await db.query('START TRANSACTION');

      try {
        // Kiểm tra booking có tồn tại không
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          await db.query('ROLLBACK');
          return res.status(404).json({ 
            success: false, 
            message: 'Không tìm thấy thông tin đặt chỗ' 
          });
        }

        // Cập nhật trạng thái payment
        await db.query('UPDATE Payments SET payment_status = ? WHERE booking_id = ?', [paymentStatus, bookingId]);

        // Cập nhật trạng thái booking nếu thanh toán thành công
        if (paymentStatus === 'completed') {
          await Booking.updateStatus(bookingId, 'confirmed');
        }

        // Lấy thông tin booking sau khi cập nhật
        const updatedBooking = await Booking.getBookingDetails(bookingId);

        // Commit transaction
        await db.query('COMMIT');

        res.json({ 
          success: true, 
          message: 'Cập nhật trạng thái thanh toán thành công',
          data: {
            bookingId: updatedBooking.booking_id,
            bookingStatus: updatedBooking.status,
            paymentStatus: paymentStatus,
            bookingDetails: {
              startTime: updatedBooking.start_time,
              endTime: updatedBooking.end_time,
              bookingType: updatedBooking.booking_type,
              totalPrice: updatedBooking.price,
              licensePlate: updatedBooking.license_plate,
              phoneNumber: updatedBooking.phone,
              userName: updatedBooking.username
            }
          }
        });
      } catch (error) {
        // Rollback nếu có lỗi
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Lỗi xác nhận thanh toán:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi xác nhận thanh toán', 
        error: error.message 
      });
    }
  },

  // Lấy thông tin chi tiết về một khu vực đỗ xe với nhiều khung giờ
  async getZoneDetailsMultipleTimeSlots(req, res) {
    try {
      const { zoneId } = req.params;
      const { date, timeSlots } = req.body;
      
      if (!zoneId || !date || !timeSlots || !Array.isArray(timeSlots)) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin cần thiết hoặc định dạng không đúng'
        });
      }

      // Lấy thông tin cơ bản về zone
      const [zoneData] = await db.query(`
        SELECT z.zone_id as id, z.zone_name as name, z.total_slots as totalSpots, 
               z.available_slots as availableSpots
        FROM Zones z
        WHERE z.zone_id = ?
      `, [zoneId]);

      if (zoneData.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khu vực đỗ xe'
        });
      }

      // Lấy thông tin layout
      const [layoutData] = await db.query(`
        SELECT layout_type, grid_rows, grid_cols, layout_data
        FROM Zone_Layouts
        WHERE zone_id = ?
      `, [zoneId]);

      // Lấy danh sách tất cả slot trong zone
      const [slots] = await db.query(`
        SELECT 
          s.slot_id as id, 
          s.slot_code as code, 
          s.status as db_status, 
          s.position_x, 
          s.position_y
        FROM Slots s
        WHERE s.zone_id = ?
      `, [zoneId]);

      // Xử lý dữ liệu cho từng khung giờ
      const time_slots = await Promise.all(timeSlots.map(async (timeSlot) => {
        const { startTime, endTime } = timeSlot;
        
        // Đảm bảo startTime và endTime có ngày tháng từ tham số date
        const fullStartTime = `${date}T${startTime}`;
        const fullEndTime = `${date}T${endTime}`;
        
        // Lấy booking cho khung giờ này
        const [bookings] = await db.query(`
          SELECT 
            b.booking_id,
            b.slot_id,
            b.start_time,
            b.end_time,
            b.status as booking_status
          FROM Bookings b
          WHERE b.slot_id IN (?)
          AND b.status IN ('pending', 'confirmed', 'checked_in')
          AND ((b.start_time < ? AND b.end_time > ?) OR
               (b.start_time BETWEEN ? AND ?) OR
               (b.end_time BETWEEN ? AND ?))
        `, [slots.map(s => s.id), fullEndTime, fullStartTime, fullStartTime, fullEndTime, fullStartTime, fullEndTime]);
        
        // Xử lý trạng thái từng slot trong khung giờ này
        const processedSlots = slots.map(slot => {
          // Tìm booking cho slot này trong khung giờ hiện tại
          const slotBookings = bookings.filter(b => b.slot_id === slot.id);
          
          // Xác định trạng thái của slot
          let status = 'available';
          
          // Nếu slot có booking trong khung giờ này
          if (slotBookings.length > 0) {
            // Xác định trạng thái dựa trên booking
            const booking = slotBookings[0]; // Lấy booking đầu tiên
            if (booking.booking_status === 'checked_in') {
              status = 'occupied';
            } else if (booking.booking_status === 'pending') {
              status = 'pending';
            } else {
              status = 'booked';
            }
          } else if (slot.db_status === 'occupied' || slot.db_status === 'pending') {
            // Nếu slot đang có trạng thái đặc biệt trong database
            status = slot.db_status;
          }
          
          return {
            id: slot.id,
            code: slot.code,
            status,
            position_x: slot.position_x,
            position_y: slot.position_y
          };
        });
        
        return {
          time: `${startTime}-${endTime}`,
          slots: processedSlots
        };
      }));

      res.json({
        success: true,
        data: {
          zone: zoneData[0],
          layout: layoutData.length > 0 ? layoutData[0] : null,
          date,
          time_slots
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy thông tin chi tiết khu vực với nhiều khung giờ:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi lấy thông tin chi tiết khu vực',
        error: error.message
      });
    }
  }
};

module.exports = bookingController;