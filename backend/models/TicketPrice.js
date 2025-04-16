const db = require('../config/database');

class TicketPrice {
  static async getCurrentPrice(lotId, ticketType) {
    const [prices] = await db.query(`
      SELECT price_id, price, ticket_type
      FROM Ticket_Prices
      WHERE lot_id = ? AND ticket_type = ? 
      AND valid_from <= CURDATE()
      AND (valid_to IS NULL OR valid_to >= CURDATE())
      ORDER BY valid_from DESC
      LIMIT 1
    `, [lotId, ticketType]);
    
    return prices.length ? prices[0] : null;
  }
}

module.exports = TicketPrice; 