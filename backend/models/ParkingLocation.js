// models/ParkingLocation.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ParkingLocation = sequelize.define('ParkingLocation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  totalSpots: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  availableSpots: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'parking_locations',
  timestamps: true
});

module.exports = ParkingLocation;
