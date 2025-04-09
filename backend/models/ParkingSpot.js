// models/ParkingSpot.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ParkingSpot = sequelize.define('ParkingSpot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  spotNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  floorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'floors',
      key: 'id'
    }
  },
  parkingLocationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'parking_locations',
      key: 'id'
    }
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'parking_spots',
  timestamps: true
});

module.exports = ParkingSpot;
