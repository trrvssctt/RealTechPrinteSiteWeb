const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ordersController = require('../controllers/ordersController');

router.use(adminAuth);

router.get('/', ordersController.listOrders);
router.put('/:id', ordersController.updateOrder);

module.exports = router;
