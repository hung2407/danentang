const express = require('express');
const app = express();
const cors = require('cors');
const vehicleRoutes = require('./routes/vehicleRoutes');
const zoneRoutes = require('./routes/zoneRoutes');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(vehicleRoutes);
app.use(zoneRoutes);

module.exports = app;

