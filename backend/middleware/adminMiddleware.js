const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware xác thực admin
 * Kiểm tra JWT token và role phải là admin
 * 
 * Lưu ý: Đây là phiên bản riêng cho API admin
 * Xem thêm authMiddleware.js cho cách triển khai middleware phân quyền tổng quát
 */
const isAdmin = async (req, res, next) => {
  try {
    // Kiểm tra token tồn tại
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Không có token xác thực'
      });
    }

    // Lấy token
    const token = authHeader.split(' ')[1];
    
    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Lấy thông tin user từ database
    const [users] = await db.query('SELECT * FROM Users WHERE user_id = ?', [decoded.user_id]);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }
    
    const user = users[0];
    
    // Kiểm tra role admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập'
      });
    }
    
    // Lưu thông tin user vào request
    req.user = user;
    next();
  } catch (error) {
    console.error('Lỗi xác thực admin:', error);
    res.status(401).json({
      success: false,
      message: 'Token không hợp lệ',
      error: error.message
    });
  }
};

module.exports = { isAdmin }; 