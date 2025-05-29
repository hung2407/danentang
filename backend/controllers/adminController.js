const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminController = {
  // Dashboard - Thống kê tổng quan
  async getDashboardSummary(req, res) {
    try {
      // Lấy tổng số người dùng
      const [userCountResult] = await db.query('SELECT COUNT(*) as total FROM Users WHERE role = "customer"');
      const userCount = userCountResult[0].total;
      
      // Lấy tổng số khu vực
      const [zoneCountResult] = await db.query('SELECT COUNT(*) as total FROM Zones');
      const zoneCount = zoneCountResult[0].total;
      
      // Lấy tổng số đặt chỗ
      const [bookingCountResult] = await db.query('SELECT COUNT(*) as total FROM Bookings');
      const bookingCount = bookingCountResult[0].total;
      
      // Lấy doanh thu của ngày hôm nay (chỉ tính các thanh toán đã hoàn thành)
      const [todayRevenueResult] = await db.query(
        'SELECT SUM(amount) as total FROM Payments WHERE payment_status = "completed" AND DATE(payment_time) = CURDATE()'
      );
      const todayRevenue = todayRevenueResult[0].total || 0;
      
      // Lấy doanh thu của tháng này (chỉ tính các thanh toán đã hoàn thành)
      const [monthRevenueResult] = await db.query(
        'SELECT SUM(amount) as total FROM Payments WHERE payment_status = "completed" AND MONTH(payment_time) = MONTH(CURDATE()) AND YEAR(payment_time) = YEAR(CURDATE())'
      );
      const monthRevenue = monthRevenueResult[0].total || 0;
      
      // Lấy số đặt chỗ theo trạng thái
      const [bookingStatusResult] = await db.query(
        'SELECT status, COUNT(*) as count FROM Bookings GROUP BY status'
      );
      
      res.json({
        success: true,
        data: {
          userCount,
          zoneCount,
          bookingCount,
          todayRevenue,
          monthRevenue,
          bookingsByStatus: bookingStatusResult
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy thống kê dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê dashboard',
        error: error.message
      });
    }
  },
  
  // Quản lý người dùng
  async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      const searchQuery = req.query.search ? `%${req.query.search}%` : null;
      
      let query = 'SELECT user_id, username, full_name, email, phone, role, created_at FROM Users';
      let countQuery = 'SELECT COUNT(*) as total FROM Users';
      
      // Thêm điều kiện tìm kiếm nếu có
      if (searchQuery) {
        query += ' WHERE username LIKE ? OR full_name LIKE ? OR email LIKE ?';
        countQuery += ' WHERE username LIKE ? OR full_name LIKE ? OR email LIKE ?';
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      
      // Thực hiện truy vấn
      let users, countResult;
      if (searchQuery) {
        [users] = await db.query(query, [searchQuery, searchQuery, searchQuery, limit, offset]);
        [countResult] = await db.query(countQuery, [searchQuery, searchQuery, searchQuery]);
      } else {
        [users] = await db.query(query, [limit, offset]);
        [countResult] = await db.query(countQuery);
      }
      
      const totalUsers = countResult[0].total;
      const totalPages = Math.ceil(totalUsers / limit);
      
      res.json({
        success: true,
        data: users,
        pagination: {
          total: totalUsers,
          page,
          limit,
          totalPages
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách người dùng:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách người dùng',
        error: error.message
      });
    }
  },
  
  // Tạo người dùng mới
  async createUser(req, res) {
    try {
      const { username, password, full_name, email, phone, role } = req.body;
      
      // Kiểm tra dữ liệu đầu vào
      if (!username || !password || !full_name || !email || !role) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc'
        });
      }
      
      // Kiểm tra username đã tồn tại chưa
      const [existingUsers] = await db.query(
        'SELECT * FROM Users WHERE username = ?',
        [username]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Tên đăng nhập đã tồn tại'
        });
      }
      
      // Kiểm tra email đã tồn tại chưa
      const [existingEmails] = await db.query(
        'SELECT * FROM Users WHERE email = ?',
        [email]
      );
      
      if (existingEmails.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email đã tồn tại'
        });
      }
      
      // Hash mật khẩu
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Thêm người dùng mới
      const [result] = await db.query(
        'INSERT INTO Users (username, password, full_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, full_name, email, phone, role]
      );
      
      res.status(201).json({
        success: true,
        message: 'Tạo người dùng thành công',
        data: {
          user_id: result.insertId,
          username,
          full_name,
          email,
          phone,
          role
        }
      });
    } catch (error) {
      console.error('Lỗi khi tạo người dùng:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo người dùng',
        error: error.message
      });
    }
  },
  
  // Lấy thông tin chi tiết người dùng
  async getUserById(req, res) {
    try {
      const userId = req.params.userId;
      
      // Lấy thông tin người dùng
      const [users] = await db.query(
        'SELECT user_id, username, full_name, email, phone, role, created_at FROM Users WHERE user_id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }
      
      // Lấy thông tin đặt chỗ của người dùng
      const [bookings] = await db.query(
        'SELECT * FROM Bookings WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        [userId]
      );
      
      res.json({
        success: true,
        data: {
          user: users[0],
          recentBookings: bookings
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy thông tin người dùng:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin người dùng',
        error: error.message
      });
    }
  },
  
  // Cập nhật thông tin người dùng
  async updateUser(req, res) {
    try {
      const userId = req.params.userId;
      const { full_name, email, phone, role } = req.body;
      
      // Kiểm tra người dùng tồn tại
      const [existingUsers] = await db.query(
        'SELECT * FROM Users WHERE user_id = ?',
        [userId]
      );
      
      if (existingUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }
      
      // Cập nhật thông tin
      await db.query(
        'UPDATE Users SET full_name = ?, email = ?, phone = ?, role = ? WHERE user_id = ?',
        [full_name, email, phone, role, userId]
      );
      
      res.json({
        success: true,
        message: 'Cập nhật thông tin người dùng thành công'
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin người dùng:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật thông tin người dùng',
        error: error.message
      });
    }
  },
  
  // Xóa người dùng
  async deleteUser(req, res) {
    try {
      const userId = req.params.userId;
      
      // Kiểm tra người dùng tồn tại
      const [existingUsers] = await db.query(
        'SELECT * FROM Users WHERE user_id = ?',
        [userId]
      );
      
      if (existingUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }
      
      // Xóa người dùng
      await db.query('DELETE FROM Users WHERE user_id = ?', [userId]);
      
      res.json({
        success: true,
        message: 'Xóa người dùng thành công'
      });
    } catch (error) {
      console.error('Lỗi khi xóa người dùng:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa người dùng',
        error: error.message
      });
    }
  },
  
  // Quản lý khu vực
  // Lấy danh sách khu vực
  async getAllZones(req, res) {
    try {
      const [zones] = await db.query(`
        SELECT 
          z.zone_id, z.zone_name, z.total_slots, z.available_slots,
          zl.layout_type, zl.grid_rows, zl.grid_cols
        FROM Zones z
        LEFT JOIN Zone_Layouts zl ON z.zone_id = zl.zone_id
        ORDER BY z.zone_id
      `);

      res.json({
        success: true,
        data: zones
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách khu vực:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách khu vực',
        error: error.message
      });
    }
  },
  
  async createZone(req, res) {
    try {
      const { zone_name, total_slots, layout_type, grid_rows, grid_cols } = req.body;
      
      // Tạo khu vực mới
      const [result] = await db.query(
        'INSERT INTO Zones (zone_name, total_slots, available_slots) VALUES (?, ?, ?)',
        [zone_name, total_slots, total_slots]
      );
      
      const zoneId = result.insertId;
      
      // Thêm thông tin layout
      await db.query(
        'INSERT INTO Zone_Layouts (zone_id, layout_type, grid_rows, grid_cols) VALUES (?, ?, ?, ?)',
        [zoneId, layout_type, grid_rows, grid_cols]
      );
      
      // Tạo các slot trong khu vực
      for (let i = 1; i <= total_slots; i++) {
        // Tạo mã code cho slot (ví dụ: A01, A02, ...)
        const slotCode = `${zone_name.charAt(0)}${i.toString().padStart(2, '0')}`;
        await db.query(
          'INSERT INTO Slots (zone_id, slot_code, status) VALUES (?, ?, "available")',
          [zoneId, slotCode]
        );
      }
      
      res.status(201).json({
        success: true,
        message: 'Tạo khu vực đỗ xe thành công',
        data: { zone_id: zoneId }
      });
    } catch (error) {
      console.error('Lỗi khi tạo khu vực đỗ xe:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo khu vực đỗ xe',
        error: error.message
      });
    }
  },
  
  // Cập nhật khu vực
  async updateZone(req, res) {
    try {
      const zoneId = req.params.zoneId;
      const { zone_name, layout_type, grid_rows, grid_cols } = req.body;
      
      // Cập nhật khu vực
      await db.query(
        'UPDATE Zones SET zone_name = ? WHERE zone_id = ?',
        [zone_name, zoneId]
      );
      
      // Cập nhật thông tin layout
      await db.query(
        `UPDATE Zone_Layouts SET layout_type = ?, grid_rows = ?, grid_cols = ? 
         WHERE zone_id = ?`,
        [layout_type, grid_rows, grid_cols, zoneId]
      );
      
      res.json({
        success: true,
        message: 'Cập nhật khu vực đỗ xe thành công'
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật khu vực đỗ xe:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật khu vực đỗ xe',
        error: error.message
      });
    }
  },
  
  // Xóa khu vực
  async deleteZone(req, res) {
    try {
      const zoneId = req.params.zoneId;
      
      // Kiểm tra khu vực có tồn tại
      const [existingZones] = await db.query(
        'SELECT * FROM Zones WHERE zone_id = ?',
        [zoneId]
      );
      
      if (existingZones.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khu vực'
        });
      }
      
      // Kiểm tra có đặt chỗ nào đang sử dụng khu vực này không
      const [activeBookings] = await db.query(
        `SELECT COUNT(*) as count FROM Bookings b
         JOIN Slots s ON b.slot_id = s.slot_id
         WHERE s.zone_id = ? AND b.status IN ('confirmed', 'pending', 'in_progress')`,
        [zoneId]
      );
      
      if (activeBookings[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xóa khu vực đang có đặt chỗ'
        });
      }
      
      // Xóa các slots của khu vực
      await db.query('DELETE FROM Slots WHERE zone_id = ?', [zoneId]);
      
      // Xóa layout
      await db.query('DELETE FROM Zone_Layouts WHERE zone_id = ?', [zoneId]);
      
      // Xóa khu vực
      await db.query('DELETE FROM Zones WHERE zone_id = ?', [zoneId]);
      
      res.json({
        success: true,
        message: 'Xóa khu vực đỗ xe thành công'
      });
    } catch (error) {
      console.error('Lỗi khi xóa khu vực đỗ xe:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa khu vực đỗ xe',
        error: error.message
      });
    }
  },
  
  // Quản lý đặt chỗ
  async getAllBookings(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      const status = req.query.status;
      const searchQuery = req.query.search ? `%${req.query.search}%` : null;
      
      let query = `
        SELECT 
          b.booking_id, b.user_id, b.slot_id, b.start_time, b.end_time, 
          b.status, b.created_at,
          u.username, u.full_name, u.email, u.phone,
          s.slot_code, z.zone_name
        FROM Bookings b
        JOIN Users u ON b.user_id = u.user_id
        JOIN Slots s ON b.slot_id = s.slot_id
        JOIN Zones z ON s.zone_id = z.zone_id
      `;
      
      let countQuery = 'SELECT COUNT(*) as total FROM Bookings b';
      
      if (status || searchQuery) {
        query += ' WHERE';
        countQuery += ' WHERE';
        
        if (status) {
          query += ' b.status = ?';
          countQuery += ' b.status = ?';
        }
        
        if (status && searchQuery) {
          query += ' AND';
          countQuery += ' AND';
        }
        
        if (searchQuery) {
          query += ' (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)';
          countQuery += ' b.booking_id IN (SELECT b2.booking_id FROM Bookings b2 JOIN Users u2 ON b2.user_id = u2.user_id WHERE u2.username LIKE ? OR u2.full_name LIKE ? OR u2.email LIKE ?)';
        }
      }
      
      query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
      
      // Thực hiện truy vấn
      let bookings, countResult;
      if (status && searchQuery) {
        [bookings] = await db.query(query, [status, searchQuery, searchQuery, searchQuery, limit, offset]);
        [countResult] = await db.query(countQuery, [status, searchQuery, searchQuery, searchQuery]);
      } else if (status) {
        [bookings] = await db.query(query, [status, limit, offset]);
        [countResult] = await db.query(countQuery, [status]);
      } else if (searchQuery) {
        [bookings] = await db.query(query, [searchQuery, searchQuery, searchQuery, limit, offset]);
        [countResult] = await db.query(countQuery, [searchQuery, searchQuery, searchQuery]);
      } else {
        [bookings] = await db.query(query, [limit, offset]);
        [countResult] = await db.query(countQuery);
      }
      
      const totalBookings = countResult[0].total;
      const totalPages = Math.ceil(totalBookings / limit);
      
      res.json({
        success: true,
        data: bookings,
        pagination: {
          total: totalBookings,
          page,
          limit,
          totalPages
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đặt chỗ:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách đặt chỗ',
        error: error.message
      });
    }
  },
  
  // Cập nhật trạng thái đặt chỗ
  async updateBookingStatus(req, res) {
    try {
      const bookingId = req.params.bookingId;
      const { status } = req.body;
      
      // Kiểm tra đặt chỗ tồn tại
      const [existingBookings] = await db.query(
        'SELECT * FROM Bookings WHERE booking_id = ?',
        [bookingId]
      );
      
      if (existingBookings.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đặt chỗ'
        });
      }
      
      // Cập nhật trạng thái
      await db.query(
        'UPDATE Bookings SET status = ? WHERE booking_id = ?',
        [status, bookingId]
      );
      
      // Nếu hủy đặt chỗ, cập nhật trạng thái slot
      if (status === 'cancelled') {
        await db.query(
          `UPDATE Slots s
           JOIN Bookings b ON s.slot_id = b.slot_id
           SET s.status = 'available'
           WHERE b.booking_id = ?`,
          [bookingId]
        );
      }
      
      res.json({
        success: true,
        message: 'Cập nhật trạng thái đặt chỗ thành công'
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái đặt chỗ:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật trạng thái đặt chỗ',
        error: error.message
      });
    }
  },
  
  // Xác minh mã đặt chỗ được quét
  async verifyScannedBooking(req, res) {
    try {
      const bookingId = req.params.bookingId;
      console.log('Verifying booking with ID:', bookingId);
      // Kiểm tra bookingId là UUID (qr_code) hay là số (booking_id)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let query, params;
      if (uuidRegex.test(bookingId)) {
        // Nếu là UUID, chỉ tìm theo qr_code
        query = `SELECT b.*, u.full_name, u.phone, z.zone_name, s.slot_code 
          FROM Bookings b
          JOIN Users u ON b.user_id = u.user_id
          JOIN Slots s ON b.slot_id = s.slot_id
          JOIN Zones z ON s.zone_id = z.zone_id
          WHERE b.qr_code = ?`;
        params = [bookingId];
      } else if (!isNaN(bookingId)) {
        // Nếu là số, chỉ tìm theo booking_id
        query = `SELECT b.*, u.full_name, u.phone, z.zone_name, s.slot_code 
          FROM Bookings b
          JOIN Users u ON b.user_id = u.user_id
          JOIN Slots s ON b.slot_id = s.slot_id
          JOIN Zones z ON s.zone_id = z.zone_id
          WHERE b.booking_id = ?`;
        params = [bookingId];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Mã đặt chỗ không hợp lệ'
        });
      }
      console.log('Executing query:', query, 'with params:', params);
      const [bookings] = await db.query(query, params);
      console.log('Query result:', bookings);
      if (bookings.length === 0) {
        console.log('No booking found with ID:', bookingId);
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đặt chỗ'
        });
      }
      const booking = bookings[0];
      // Kiểm tra trạng thái đặt chỗ
      if (booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Đặt chỗ đã bị hủy'
        });
      }
      if (booking.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Đặt chỗ đã hoàn thành'
        });
      }
      res.json({
        success: true,
        message: 'Xác minh đặt chỗ thành công',
        data: {
          bookingId: booking.booking_id,
          status: booking.status,
          licensePlate: booking.license_plate,
          userName: booking.full_name,
          userPhone: booking.phone,
          zoneName: booking.zone_name,
          slotNumber: booking.slot_code,
          startTime: booking.start_time,
          endTime: booking.end_time,
          createdAt: booking.created_at,
          bookingType: booking.booking_type
        }
      });
    } catch (error) {
      console.error('Lỗi khi xác minh đặt chỗ:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xác minh đặt chỗ',
        error: error.message
      });
    }
  },
  
  // Báo cáo doanh thu
  async getRevenueReport(req, res) {
    try {
      const { timeRange, startDate, endDate } = req.query;
      
      let query;
      let params = [];
      
      switch (timeRange) {
        case 'day':
          query = `
            SELECT 
              DATE(payment_time) as date,
              SUM(amount) as revenue,
              COUNT(*) as count
            FROM Payments
            WHERE DATE(payment_time) BETWEEN ? AND ?
            GROUP BY DATE(payment_time)
            ORDER BY date
          `;
          params = [startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
                   endDate || new Date().toISOString().split('T')[0]];
          break;
          
        case 'month':
          query = `
            SELECT 
              CONCAT(YEAR(payment_time), '-', MONTH(payment_time)) as month,
              SUM(amount) as revenue,
              COUNT(*) as count
            FROM Payments
            WHERE payment_time BETWEEN ? AND ?
            GROUP BY YEAR(payment_time), MONTH(payment_time)
            ORDER BY YEAR(payment_time), MONTH(payment_time)
          `;
          params = [startDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
                   endDate || new Date().toISOString().split('T')[0]];
          break;
          
        default:
          query = `
            SELECT 
              DATE(payment_time) as date,
              SUM(amount) as revenue,
              COUNT(*) as count
            FROM Payments
            WHERE DATE(payment_time) = CURDATE()
            GROUP BY DATE(payment_time)
          `;
      }
      
      const [results] = await db.query(query, params);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo doanh thu:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy báo cáo doanh thu',
        error: error.message
      });
    }
  },
  
  // Đăng nhập admin
  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      // Tìm user theo username
      const [users] = await db.query(
        'SELECT * FROM Users WHERE username = ? AND role = "admin"',
        [username]
      );
      
      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại hoặc không phải admin'
        });
      }
      
      const user = users[0];
      
      // Kiểm tra password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Mật khẩu không chính xác'
        });
      }
      
      // Tạo JWT token
      const token = jwt.sign(
        { user_id: user.user_id, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Không trả về password
      delete user.password;
      
      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          user,
          token
        },
        auth_token: token
      });
    } catch (error) {
      console.error('Lỗi đăng nhập admin:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi đăng nhập',
        error: error.message
      });
    }
  },
  
  // Đặt lại mật khẩu admin
  async resetPassword(req, res) {
    try {
      const { userId, newPassword } = req.body;
      
      // Kiểm tra người dùng tồn tại và là admin
      const [users] = await db.query(
        'SELECT * FROM Users WHERE user_id = ? AND role = "admin"',
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản admin'
        });
      }
      
      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Cập nhật mật khẩu
      await db.query(
        'UPDATE Users SET password = ? WHERE user_id = ?',
        [hashedPassword, userId]
      );
      
      res.json({
        success: true,
        message: 'Đặt lại mật khẩu thành công'
      });
    } catch (error) {
      console.error('Lỗi đặt lại mật khẩu admin:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi đặt lại mật khẩu',
        error: error.message
      });
    }
  },
  
  // Thay đổi thiết lập hệ thống
  async updateSettings(req, res) {
    try {
      const { settingName, settingValue } = req.body;
      
      // Kiểm tra thiết lập đã tồn tại chưa
      const [existingSettings] = await db.query(
        'SELECT * FROM Settings WHERE setting_name = ?',
        [settingName]
      );
      
      if (existingSettings.length > 0) {
        // Cập nhật thiết lập
        await db.query(
          'UPDATE Settings SET setting_value = ? WHERE setting_name = ?',
          [settingValue, settingName]
        );
      } else {
        // Tạo thiết lập mới
        await db.query(
          'INSERT INTO Settings (setting_name, setting_value) VALUES (?, ?)',
          [settingName, settingValue]
        );
      }
      
      res.json({
        success: true,
        message: 'Cập nhật thiết lập thành công'
      });
    } catch (error) {
      console.error('Lỗi cập nhật thiết lập:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi cập nhật thiết lập',
        error: error.message
      });
    }
  },
  
  // Lấy tất cả thiết lập
  async getSettings(req, res) {
    try {
      const [settings] = await db.query('SELECT * FROM Settings');
      
      const settingsObj = {};
      settings.forEach(setting => {
        settingsObj[setting.setting_name] = setting.setting_value;
      });
      
      res.json({
        success: true,
        data: settingsObj
      });
    } catch (error) {
      console.error('Lỗi lấy thiết lập:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi lấy thiết lập',
        error: error.message
      });
    }
  },
  
  // Quản lý giá vé
  
  // Lấy tất cả giá vé
  async getAllPrices(req, res) {
    try {
      const [prices] = await db.query(
        `SELECT price_id, p.zone_id, ticket_type, price, 
         DATE_FORMAT(valid_from, '%Y-%m-%d') as valid_from, 
         DATE_FORMAT(valid_to, '%Y-%m-%d') as valid_to, 
         z.zone_name 
         FROM Ticket_Prices p
         LEFT JOIN Zones z ON p.zone_id = z.zone_id
         ORDER BY p.valid_from DESC`
      );
      
      res.json({
        success: true,
        data: prices
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách giá vé:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách giá vé',
        error: error.message
      });
    }
  },
  
  // Lấy thông tin chi tiết của một giá vé
  async getPriceById(req, res) {
    try {
      const priceId = req.params.priceId;
      
      const [prices] = await db.query(
        `SELECT price_id, p.zone_id, ticket_type, price, 
         DATE_FORMAT(valid_from, '%Y-%m-%d') as valid_from, 
         DATE_FORMAT(valid_to, '%Y-%m-%d') as valid_to, 
         z.zone_name 
         FROM Ticket_Prices p
         LEFT JOIN Zones z ON p.zone_id = z.zone_id
         WHERE price_id = ?`,
        [priceId]
      );
      
      if (prices.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy giá vé'
        });
      }
      
      res.json({
        success: true,
        data: prices[0]
      });
    } catch (error) {
      console.error('Lỗi khi lấy thông tin giá vé:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin giá vé',
        error: error.message
      });
    }
  },
  
  // Thêm giá vé mới
  async addPrice(req, res) {
    try {
      const { zone_id, ticket_type, price, valid_from, valid_to } = req.body;
      
      // Validate input
      if (!zone_id || !ticket_type || !price || !valid_from) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc'
        });
      }
      
      // Kiểm tra zone_id có tồn tại
      const [zones] = await db.query('SELECT * FROM Zones WHERE zone_id = ?', [zone_id]);
      if (zones.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Khu vực không tồn tại'
        });
      }
      
      // Nếu valid_to không được cung cấp, set là NULL
      const validToValue = valid_to || null;
      
      // Thêm giá vé mới
      await db.query(
        `INSERT INTO Ticket_Prices (zone_id, ticket_type, price, valid_from, valid_to) 
         VALUES (?, ?, ?, ?, ?)`,
        [zone_id, ticket_type, price, valid_from, validToValue]
      );
      
      res.status(201).json({
        success: true,
        message: 'Thêm giá vé thành công'
      });
    } catch (error) {
      console.error('Lỗi khi thêm giá vé:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi thêm giá vé',
        error: error.message
      });
    }
  },
  
  // Cập nhật giá vé
  async updatePrice(req, res) {
    try {
      const priceId = req.params.priceId;
      const { zone_id, ticket_type, price, valid_from, valid_to } = req.body;
      
      // Validate input
      if (!priceId || !zone_id || !ticket_type || !price || !valid_from) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc'
        });
      }
      
      // Kiểm tra price_id có tồn tại
      const [prices] = await db.query('SELECT * FROM Ticket_Prices WHERE price_id = ?', [priceId]);
      if (prices.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Giá vé không tồn tại'
        });
      }
      
      // Kiểm tra zone_id có tồn tại
      const [zones] = await db.query('SELECT * FROM Zones WHERE zone_id = ?', [zone_id]);
      if (zones.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Khu vực không tồn tại'
        });
      }
      
      // Nếu valid_to không được cung cấp, set là NULL
      const validToValue = valid_to || null;
      
      // Cập nhật giá vé
      await db.query(
        `UPDATE Ticket_Prices 
         SET zone_id = ?, ticket_type = ?, price = ?, valid_from = ?, valid_to = ? 
         WHERE price_id = ?`,
        [zone_id, ticket_type, price, valid_from, validToValue, priceId]
      );
      
      res.json({
        success: true,
        message: 'Cập nhật giá vé thành công'
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật giá vé:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật giá vé',
        error: error.message
      });
    }
  },
  
  // Xóa giá vé
  async deletePrice(req, res) {
    try {
      const priceId = req.params.priceId;
      
      // Kiểm tra price_id có tồn tại
      const [prices] = await db.query('SELECT * FROM Ticket_Prices WHERE price_id = ?', [priceId]);
      if (prices.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Giá vé không tồn tại'
        });
      }
      
      // Kiểm tra có booking nào liên quan đến giá vé này không
      const [bookings] = await db.query(
        'SELECT * FROM Bookings WHERE ticket_price_id = ? AND status NOT IN ("completed", "cancelled") LIMIT 1', 
        [priceId]
      );
      
      if (bookings.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xóa giá vé này vì đang có đơn đặt chỗ liên quan'
        });
      }
      
      // Xóa giá vé
      await db.query('DELETE FROM Ticket_Prices WHERE price_id = ?', [priceId]);
      
      res.json({
        success: true,
        message: 'Xóa giá vé thành công'
      });
    } catch (error) {
      console.error('Lỗi khi xóa giá vé:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa giá vé',
        error: error.message
      });
    }
  },
  
  // Lấy lịch sử giá vé của một khu vực
  async getZonePriceHistory(req, res) {
    try {
      const zoneId = req.params.zoneId;
      
      // Kiểm tra zone_id có tồn tại
      const [zones] = await db.query('SELECT * FROM Zones WHERE zone_id = ?', [zoneId]);
      if (zones.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Khu vực không tồn tại'
        });
      }
      
      // Lấy lịch sử giá vé
      const [prices] = await db.query(
        `SELECT price_id, ticket_type, price, 
         DATE_FORMAT(valid_from, '%Y-%m-%d') as valid_from, 
         DATE_FORMAT(valid_to, '%Y-%m-%d') as valid_to
         FROM Ticket_Prices
         WHERE zone_id = ?
         ORDER BY valid_from DESC`,
        [zoneId]
      );
      
      res.json({
        success: true,
        data: prices
      });
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử giá vé:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch sử giá vé',
        error: error.message
      });
    }
  },
  
  // Lấy giá vé hiện tại của một khu vực
  async getCurrentZonePrices(req, res) {
    try {
      const zoneId = req.params.zoneId;
      
      // Kiểm tra zone_id có tồn tại
      const [zones] = await db.query('SELECT * FROM Zones WHERE zone_id = ?', [zoneId]);
      if (zones.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Khu vực không tồn tại'
        });
      }
      
      // Lấy giá vé hiện tại
      const currentDate = new Date().toISOString().split('T')[0];
      const [prices] = await db.query(
        `SELECT price_id, ticket_type, price, 
         DATE_FORMAT(valid_from, '%Y-%m-%d') as valid_from, 
         DATE_FORMAT(valid_to, '%Y-%m-%d') as valid_to
         FROM Ticket_Prices
         WHERE zone_id = ? AND valid_from <= ?
         AND (valid_to IS NULL OR valid_to >= ?)
         ORDER BY ticket_type`,
        [zoneId, currentDate, currentDate]
      );
      
      res.json({
        success: true,
        data: prices
      });
    } catch (error) {
      console.error('Lỗi khi lấy giá vé hiện tại:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy giá vé hiện tại',
        error: error.message
      });
    }
  },
  
  // Xem tất cả booking ID cho debug
  async getAllBookingIds(req, res) {
    try {
      const [bookings] = await db.query(
        'SELECT booking_id, qr_code, status FROM Bookings LIMIT 10'
      );
      
      res.json({
        success: true,
        data: bookings
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách booking ID:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách booking ID',
        error: error.message
      });
    }
  },
  
  // Lấy lịch sử đặt chỗ (admin)
  async getBookingHistory(req, res) {
    try {
      const { userId } = req.query; // userId là optional, nếu có thì lọc theo user cụ thể
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      
      // Base query
      let query = `
        SELECT 
          b.booking_id, b.user_id, b.start_time, b.end_time, b.status, 
          b.created_at, b.checkin_time, b.checkout_time,
          u.username, u.full_name, u.email, u.phone,
          v.license_plate, v.vehicle_type,
          s.slot_code, z.zone_name,
          p.amount, p.payment_status, p.payment_method
        FROM Bookings b
        JOIN Users u ON b.user_id = u.user_id
        LEFT JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        LEFT JOIN Slots s ON b.slot_id = s.slot_id
        LEFT JOIN Zones z ON s.zone_id = z.zone_id
        LEFT JOIN Payments p ON b.booking_id = p.booking_id
        WHERE b.status IN ('completed', 'cancelled')
      `;
      
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM Bookings b
        WHERE b.status IN ('completed', 'cancelled')
      `;
      
      // Thêm filter theo userId nếu có
      const queryParams = [];
      if (userId) {
        query += ' AND b.user_id = ?';
        countQuery += ' AND b.user_id = ?';
        queryParams.push(userId);
      }
      
      // Thêm order và limit
      query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);
      
      // Thực hiện truy vấn
      const [bookings] = await db.query(query, queryParams);
      const [countResult] = await db.query(countQuery, userId ? [userId] : []);
      
      const totalBookings = countResult[0].total;
      const totalPages = Math.ceil(totalBookings / limit);
      
      // Format kết quả
      const formattedBookings = bookings.map(booking => ({
        bookingId: booking.booking_id,
        userId: booking.user_id,
        userName: booking.full_name,
        userPhone: booking.phone,
        userEmail: booking.email,
        status: booking.status,
        licensePlate: booking.license_plate,
        vehicleType: booking.vehicle_type,
        zoneName: booking.zone_name,
        slotCode: booking.slot_code,
        startTime: booking.start_time,
        endTime: booking.end_time,
        checkInTime: booking.checkin_time,
        checkOutTime: booking.checkout_time,
        amount: booking.amount,
        paymentStatus: booking.payment_status,
        paymentMethod: booking.payment_method,
        createdAt: booking.created_at
      }));
      
      res.json({
        success: true,
        data: {
          bookings: formattedBookings,
          pagination: {
            total: totalBookings,
            page,
            limit,
            totalPages
          }
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử đặt chỗ:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch sử đặt chỗ',
        error: error.message
      });
    }
  }
};

module.exports = adminController;