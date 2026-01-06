const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const optionalAuth = require('../middleware/optionalAuth');

// Public: create order (supports optional auth to record creator)
router.post('/', optionalAuth, ordersController.createOrder);

module.exports = router;
