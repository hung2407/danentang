const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Đảm bảo import đúng model User

router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body; // Thêm phone

    if (!name || !email || !password || !phone) {
        return res.status(400).json({ msg: 'Vui lòng nhập đầy đủ thông tin' });
    }

    let user = await User.findOne({ email });
    if (user) {
        return res.status(400).json({ msg: 'User already exists' });
    }

    let phoneExists = await User.findOne({ phone });
    if (phoneExists) {
        return res.status(400).json({ msg: 'Số điện thoại đã tồn tại' });
    }

    user = new User({ name, email, password, phone });

    await user.save();
    res.status(201).json({ msg: 'Đăng ký thành công' });
});

// Xuất router để dùng trong server.js
module.exports = router;
