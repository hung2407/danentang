// models/Floor.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Floor = sequelize.define('Floor', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  floorNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  parkingLocationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'parking_locations',
      key: 'id'
    }
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
  tableName: 'floors',
  timestamps: true
});

// Thêm virtual field để tính availableSpots
Floor.prototype.availableSpots = async function() {
  const spots = await ParkingSpot.findAll({ 
    where: { 
      floorId: this.id, 
      status: 'available' 
    }
  });
  return spots.length;
};

module.exports = Floor;