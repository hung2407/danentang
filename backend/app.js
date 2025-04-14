const express = require('express');
const app = express();
const vehicleRoutes = require('./routes/vehicleRoutes');

app.use(vehicleRoutes);

