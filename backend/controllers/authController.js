const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

      const { username, password, email, phone, full_name } = req.body;

      // Đăng ký user mới
      const newUser = await User.register({
        username,
        password,
        email,
        phone,
        full_name: full_name || username
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
  },

  // Quên mật khẩu - gửi OTP qua email
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập email' });
      }
      // Kiểm tra email tồn tại
      const [users] = await require('../config/database').query('SELECT * FROM Users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'Email không tồn tại' });
      }
      // Sinh mã OTP 6 số
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
      await require('../config/database').query('UPDATE Users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?', [otp, expiry, email]);
      // Gửi email
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Mã OTP đặt lại mật khẩu',
        html: `<p>Mã OTP đặt lại mật khẩu của bạn là: <b>${otp}</b> (có hiệu lực trong 10 phút)</p>`
      });
      res.json({ success: true, message: 'Đã gửi mã OTP về email' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi gửi email', error: error.message });
    }
  },

  // Đặt lại mật khẩu bằng OTP
  async resetPassword(req, res) {
    try {
      const { otp, email, newPassword } = req.body;
      if (!otp || !email || !newPassword) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
      }
      // Kiểm tra OTP hợp lệ
      const [users] = await require('../config/database').query(
        'SELECT * FROM Users WHERE email = ? AND reset_token = ? AND reset_token_expiry > NOW()',
        [email, otp]
      );
      if (users.length === 0) {
        return res.status(400).json({ success: false, message: 'OTP không hợp lệ hoặc đã hết hạn' });
      }
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash(newPassword, 10);
      await require('../config/database').query(
        'UPDATE Users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE user_id = ?',
        [hashed, users[0].user_id]
      );
      res.json({ success: true, message: 'Đặt lại mật khẩu thành công' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi đặt lại mật khẩu', error: error.message });
    }
  }
};

module.exports = authController;