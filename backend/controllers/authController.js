const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authController = {
  // Đăng ký tài khoản
  async register(req, res) {
    try {
      console.log('Đang xử lý đăng ký với dữ liệu:', req.body);
      
      // Kiểm tra dữ liệu gửi lên
      if (!req.body || !req.body.username || !req.body.password || !req.body.email) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc'
        });
      }

      const { username, password, email, phone } = req.body;

      // Đăng ký user mới
      const newUser = await User.register({
        username,
        password,
        email,
        phone
      });

      console.log('Đăng ký thành công:', newUser);
      res.status(201).json({
        success: true,
        message: 'Đăng ký thành công',
        data: newUser
      });
    } catch (error) {
      console.error('Lỗi đăng ký:', error);
      res.status(400).json({
        success: false,
        message: 'Đăng ký thất bại',
        error: error.message
      });
    }
  },

  // Đăng nhập
  async login(req, res) {
    try {
      console.log('Đang xử lý đăng nhập với:', req.body);

      // Kiểm tra dữ liệu gửi lên
      if (!req.body || !req.body.username || !req.body.password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập username và password'
        });
      }

      const { username, password } = req.body;

      // Kiểm tra đăng nhập
      const user = await User.login(username, password);
      console.log('Đăng nhập thành công với user:', user);

      // Tạo JWT token
      const token = jwt.sign(
        { 
          user_id: user.user_id, 
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          user,
          token
        }
      });
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      res.status(401).json({
        success: false,
        message: 'Đăng nhập thất bại',
        error: error.message
      });
    }
  }
};

module.exports = authController; 