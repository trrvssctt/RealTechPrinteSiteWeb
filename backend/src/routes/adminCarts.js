const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const adminCartsController = require('../controllers/adminCartsController');

// allow employees and admins to list carts, only admins can delete
router.get('/', adminOrEmployeeAuth, adminCartsController.listCarts);
router.delete('/:id', adminAuth, adminCartsController.deleteCart);

module.exports = router;
