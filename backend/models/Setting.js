const db = require('../config/database');

const Setting = {
  // Lấy giá trị của một thiết lập
  async get(settingName) {
    try {
      const [settings] = await db.query(
        'SELECT setting_value FROM Settings WHERE setting_name = ?',
        [settingName]
      );
      
      if (settings.length === 0) {
        return null;
      }
      
      return settings[0].setting_value;
    } catch (error) {
      console.error('Lỗi khi lấy thiết lập:', error);
      throw error;
    }
  },
  
  // Lấy tất cả thiết lập
  async getAll() {
    try {
      const [settings] = await db.query('SELECT * FROM Settings');
      
      const settingsObj = {};
      settings.forEach(setting => {
        settingsObj[setting.setting_name] = setting.setting_value;
      });
      
      return settingsObj;
    } catch (error) {
      console.error('Lỗi khi lấy tất cả thiết lập:', error);
      throw error;
    }
  },
  
  // Cập nhật hoặc tạo mới thiết lập
  async set(settingName, settingValue) {
    try {
      // Kiểm tra thiết lập đã tồn tại chưa
      const [existingSettings] = await db.query(
        'SELECT * FROM Settings WHERE setting_name = ?',
        [settingName]
      );
      
      if (existingSettings.length > 0) {
        // Cập nhật thiết lập
        await db.query(
          'UPDATE Settings SET setting_value = ? WHERE setting_name = ?',
          [settingValue, settingName]
        );
      } else {
        // Tạo thiết lập mới
        await db.query(
          'INSERT INTO Settings (setting_name, setting_value) VALUES (?, ?)',
          [settingName, settingValue]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Lỗi khi cập nhật thiết lập:', error);
      throw error;
    }
  }
};

module.exports = Setting; 