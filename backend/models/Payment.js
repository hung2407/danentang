const db = require('../config/database');

class Payment {
  static async create(bookingId, amount, paymentMethod = 'card') {
    const [result] = await db.query(`
      INSERT INTO Payments
      (booking_id, amount, payment_method, payment_status)
      VALUES (?, ?, ?, 'pending')
    `, [bookingId, amount, paymentMethod]);
    
    return result.insertId;
  }

  static async findByBookingId(bookingId) {
    const [payments] = await db.query('SELECT * FROM Payments WHERE booking_id = ?', [bookingId]);
    return payments.length ? payments[0] : null;
  }

  static async updateStatus(paymentId, status) {
    await db.query('UPDATE Payments SET payment_status = ? WHERE payment_id = ?', [status, paymentId]);
    return true;
  }

  static async updateAmount(paymentId, amount) {
    await db.query('UPDATE Payments SET amount = ? WHERE payment_id = ?', [amount, paymentId]);
    return true;
  }
}

module.exports = Payment; 