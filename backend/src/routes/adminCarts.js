const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminCartsController = require('../controllers/adminCartsController');

// Protect all admin cart routes
router.use(adminAuth);

// GET /api/admin/carts -> list carts with items
router.get('/', adminCartsController.listCarts);

// DELETE /api/admin/carts/:id -> delete cart
router.delete('/:id', adminCartsController.deleteCart);

module.exports = router;
