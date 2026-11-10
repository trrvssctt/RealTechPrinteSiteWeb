const express = require('express');
const router = express.Router();
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const clientsController = require('../controllers/clientsController');

// Recherche d'un client par email ou téléphone : réservée au personnel (données personnelles)
router.get('/lookup', adminOrEmployeeAuth, clientsController.lookup);

module.exports = router;
