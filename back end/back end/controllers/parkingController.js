// controllers/parkingController.js
const ParkingLocation = require('../models/ParkingLocation');
const Floor = require('../models/Floor');
const ParkingSpot = require('../models/ParkingSpot');

exports.getParkingLocations = async (req, res) => {
  try {
    const locations = await ParkingLocation.find();
    res.json(locations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getFloorsByLocation = async (req, res) => {
  const { locationId } = req.params;
  try {
    const floors = await Floor.find({ parkingLocation: locationId });
    res.json(floors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getSpotsByFloor = async (req, res) => {
  const { floorId } = req.params;
  try {
    const spots = await ParkingSpot.find({ floor: floorId });
    res.json(spots);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
