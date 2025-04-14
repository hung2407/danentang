const parkingModel = require('../models/parkingModel');

const registerVehicle = async (req, res) => {
  try {
    const { userId, plateNumber, phoneNumber } = req.body;
    
    // Validate input
    if (!userId || !plateNumber || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Create vehicle
    const vehicleId = await parkingModel.createVehicle({
      userId,
      plateNumber,
      phoneNumber
    });

    res.status(201).json({ 
      success: true, 
      vehicleId 
    });
  } catch (error) {
    console.error('Error registering vehicle:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to register vehicle' 
    });
  }
};

module.exports = {
  registerVehicle
};