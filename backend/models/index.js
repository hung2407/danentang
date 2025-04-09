const User = require('./User');
const ParkingLocation = require('./ParkingLocation');
const Floor = require('./Floor');
const ParkingSpot = require('./ParkingSpot');
const Booking = require('./Booking');

// Định nghĩa mối quan hệ
ParkingLocation.hasMany(Floor, {
  foreignKey: 'parkingLocationId',
  as: 'floors'
});
Floor.belongsTo(ParkingLocation, {
  foreignKey: 'parkingLocationId',
  as: 'parkingLocation'
});

Floor.hasMany(ParkingSpot, {
  foreignKey: 'floorId',
  as: 'parkingSpots'
});
ParkingSpot.belongsTo(Floor, {
  foreignKey: 'floorId',
  as: 'floor'
});

ParkingLocation.hasMany(ParkingSpot, {
  foreignKey: 'parkingLocationId',
  as: 'parkingSpots'
});
ParkingSpot.belongsTo(ParkingLocation, {
  foreignKey: 'parkingLocationId',
  as: 'parkingLocation'
});

User.hasMany(Booking, {
  foreignKey: 'userId',
  as: 'bookings'
});
Booking.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

ParkingSpot.hasMany(Booking, {
  foreignKey: 'parkingSpotId',
  as: 'bookings'
});
Booking.belongsTo(ParkingSpot, {
  foreignKey: 'parkingSpotId',
  as: 'parkingSpot'
});

module.exports = {
  User,
  ParkingLocation,
  Floor,
  ParkingSpot,
  Booking
}; 