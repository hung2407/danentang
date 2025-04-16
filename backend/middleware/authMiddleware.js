const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Middleware xác thực
const authMiddleware = async (req, res, next) => {
  try {
    // Lấy token từ header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Không có token xác thực',
      });
    }

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kiểm tra user có tồn tại không
    const [users] = await db.query(
      'SELECT user_id, username, email, role FROM Users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    // Lưu thông tin user vào request
    req.user = users[0];
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ',
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn',
      });
    }

    console.error('Lỗi xác thực:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xác thực',
      error: error.message,
    });
  }
};

module.exports = authMiddleware; 