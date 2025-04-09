// controllers/parkingController.js
const ParkingLocation = require('../models/ParkingLocation');
const ParkingFloor = require('../models/ParkingFloor');
const ParkingSpot = require('../models/ParkingSpot');

exports.getLocations = async (req, res) => {
  try {
    const locations = await ParkingLocation.find();
    res.json(locations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getFloorsByLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    const floors = await ParkingFloor.find({ location: locationId });
    
    // Get available spots count for each floor
    const floorsWithAvailability = await Promise.all(floors.map(async (floor) => {
      const availableSpots = await ParkingSpot.countDocuments({
        floor: floor._id,
        status: 'available'
      });
      
      return {
        ...floor.toObject(),
        availableSpots,
        totalSpots: floor.totalSpots,
        pricePerHour: floor.pricePerHour
      };
    }));
    
    res.json(floorsWithAvailability);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getSpotsByFloor = async (req, res) => {
  try {
    const { floorId } = req.params;
    const spots = await ParkingSpot.find({ floor: floorId })
      .populate('floor', 'pricePerHour');
    res.json(spots);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
