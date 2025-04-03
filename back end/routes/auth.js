const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    // Kiểm tra trường bắt buộc
    if (!name || !email || !password || !phone) {
        return res.status(400).json({ msg: 'Vui lòng nhập đầy đủ thông tin' });
    }

    try {
        // Kiểm tra trùng email HOẶC số điện thoại (tối ưu bằng $or)
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ 
                msg: existingUser.email === email ? 'Email đã tồn tại' : 'Số điện thoại đã tồn tại' 
            });
        }

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Tạo user mới
        const user = new User({ 
            name, 
            email, 
            password: hashedPassword, 
            phone 
        });

        await user.save();

        // Tạo và trả về JWT token
        const payload = { user: { id: user.id } };
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.status(201).json({ token, msg: 'Đăng ký thành công' });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Lỗi server');
    }
});

module.exports = router;