const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

// Các hàm xử lý user
const userModel = {
  // Đăng ký user mới
  async register(userData) {
    try {
      // Validate dữ liệu
      await this.validateUserData(userData);

      const { username, password, email, phone, full_name = username } = userData;
      
      // Kiểm tra username đã tồn tại
      const [existingUsers] = await db.query(
        'SELECT username FROM Users WHERE username = ?',
        [username]
      );
      if (existingUsers.length > 0) {
        throw new Error('Tên tài khoản đã tồn tại');
      }

      // Kiểm tra email đã tồn tại
      const [existingEmails] = await db.query(
        'SELECT email FROM Users WHERE email = ?',
        [email]
      );
      if (existingEmails.length > 0) {
        throw new Error('Email đã tồn tại');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Thêm user mới
      const [result] = await db.query(
        `INSERT INTO Users (username, password, full_name, email, phone, role) 
         VALUES (?, ?, ?, ?, ?, 'customer')`,
        [username, hashedPassword, full_name, email, phone]
      );

      return {
        user_id: result.insertId,
        username,
        full_name,
        email,
        phone,
        role: 'customer'
      };
    } catch (error) {
      console.error('Lỗi trong quá trình đăng ký:', error);
      throw error;
    }
  },

  // Đăng nhập
  async login(username, password) {
    try {
      // Tìm user theo username
      const [users] = await db.query(
        'SELECT user_id, username, password, full_name, email, phone, role FROM Users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        throw new Error('Tài khoản không tồn tại');
      }

      const user = users[0];

      // Kiểm tra password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Mật khẩu không chính xác');
      }

      // Không trả về password
      delete user.password;
      return user;
    } catch (error) {
      console.error('Lỗi trong quá trình đăng nhập:', error);
      throw error;
    }
  },

  // Validate dữ liệu user
  async validateUserData(data) {
    const { username, password, email, phone } = data;

    if (!username || !password || !email) {
      throw new Error('Vui lòng điền đầy đủ thông tin bắt buộc');
    }

    // Kiểm tra username
    if (username.length < 6) {
      throw new Error('Tên tài khoản phải có ít nhất 6 ký tự');
    }

    // Kiểm tra password
    if (password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    }

    // Kiểm tra email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Email không hợp lệ');
    }

    // Kiểm tra số điện thoại
    if (phone && phone.length !== 10) {
      throw new Error('Số điện thoại phải có 10 chữ số');
    }
  },

  // Cập nhật số điện thoại
  async updatePhone(userId, phone) {
    try {
      // Kiểm tra số điện thoại hợp lệ
      if (phone && phone.length !== 10) {
        throw new Error('Số điện thoại phải có 10 chữ số');
      }

      await db.query(
        'UPDATE Users SET phone = ? WHERE user_id = ?',
        [phone, userId]
      );
      return true;
    } catch (error) {
      console.error('Lỗi khi cập nhật số điện thoại:', error);
      throw error;
    }
  }
};

module.exports = userModel; 