const express = require('express');
const router = express.Router();
const cartsController = require('../controllers/cartsController');

router.get('/', cartsController.getCartBySession);
router.get('/:id/items', cartsController.getCartItems);
router.post('/', cartsController.createCart);
router.put('/:id', cartsController.updateCart);

module.exports = router;
