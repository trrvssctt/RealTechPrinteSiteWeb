const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const ordersController = require('../controllers/ordersController');


// allow employees and admins to GET the orders list, and allow employees to update as well
router.get('/', adminOrEmployeeAuth, ordersController.listOrders);
router.put('/:id', adminOrEmployeeAuth, ordersController.updateOrder);

module.exports = router;
