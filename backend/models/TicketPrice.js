const db = require('../config/database');

class TicketPrice {
  static async getCurrentPrice(ticketType) {
    const [prices] = await db.query(`
      SELECT price_id, price, ticket_type
      FROM Ticket_Prices
      WHERE ticket_type = ? 
      AND valid_from <= CURDATE()
      AND (valid_to IS NULL OR valid_to >= CURDATE())
      ORDER BY valid_from DESC
      LIMIT 1
    `, [ticketType]);
    
    return prices.length ? prices[0] : null;
  }

  static async getAllPrices() {
    const [prices] = await db.query(`
      SELECT price_id, ticket_type, price, valid_from, valid_to
      FROM Ticket_Prices
      WHERE valid_from <= CURDATE()
      AND (valid_to IS NULL OR valid_to >= CURDATE())
      ORDER BY ticket_type, valid_from DESC
    `);
    
    return prices;
  }
}

module.exports = TicketPrice; 