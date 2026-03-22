const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clientsController');

// Public lookup for clients by email or phone
router.get('/lookup', clientsController.lookup);

module.exports = router;
