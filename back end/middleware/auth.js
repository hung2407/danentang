// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) throw new Error();

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Xác thực thất bại. Vui lòng đăng nhập lại.' });
  }
};

module.exports = auth;