const db = require('../config/database');

const zoneController = {
    // Lấy danh sách tất cả các khu vực
    async getAllZones(req, res) {
        try {
            const [zones] = await db.query(`
                SELECT 
                    z.zone_id,
                    z.zone_name,
                    z.total_slots,
                    z.available_slots,
                    zl.layout_type,
                    zl.grid_rows,
                    zl.grid_cols
                FROM Zones z
                LEFT JOIN Zone_Layouts zl ON z.zone_id = zl.zone_id
            `);
            
            res.json({
                success: true,
                data: zones
            });
        } catch (error) {
            console.error('Lỗi khi lấy danh sách khu vực:', error);
            res.status(500).json({
                success: false,
                message: 'Đã xảy ra lỗi khi lấy danh sách khu vực'
            });
        }
    },

    // Lấy chi tiết một khu vực và sơ đồ slots
    async getZoneDetails(req, res) {
        try {
            const { zoneId } = req.params;

            // Lấy thông tin zone và layout
            const [zones] = await db.query(`
                SELECT 
                    z.zone_id,
                    z.zone_name,
                    z.total_slots,
                    z.available_slots,
                    zl.layout_type,
                    zl.grid_rows,
                    zl.grid_cols
                FROM Zones z
                LEFT JOIN Zone_Layouts zl ON z.zone_id = zl.zone_id
                WHERE z.zone_id = ?
            `, [zoneId]);

            if (zones.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy khu vực'
                });
            }

            // Lấy thông tin tất cả các slots trong zone
            const [slots] = await db.query(`
                SELECT 
                    slot_id,
                    slot_code,
                    status,
                    position_x,
                    position_y
                FROM Slots
                WHERE zone_id = ?
                ORDER BY position_y, position_x
            `, [zoneId]);

            // Tạo grid layout
            const zone = zones[0];
            const grid = Array(zone.grid_rows).fill().map(() => 
                Array(zone.grid_cols).fill(null)
            );

            // Điền thông tin slots vào grid
            slots.forEach(slot => {
                if (slot.position_x <= zone.grid_cols && slot.position_y <= zone.grid_rows) {
                    grid[slot.position_y - 1][slot.position_x - 1] = {
                        slot_id: slot.slot_id,
                        slot_code: slot.slot_code,
                        status: slot.status
                    };
                }
            });

            res.json({
                success: true,
                data: {
                    ...zone,
                    layout: grid
                }
            });
        } catch (error) {
            console.error('Lỗi khi lấy chi tiết khu vực:', error);
            res.status(500).json({
                success: false,
                message: 'Đã xảy ra lỗi khi lấy chi tiết khu vực'
            });
        }
    }
};

module.exports = zoneController; 