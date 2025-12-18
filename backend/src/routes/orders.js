const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

// Public: create order
router.post('/', ordersController.createOrder);

module.exports = router;
