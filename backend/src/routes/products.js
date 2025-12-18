const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const adminAuth = require('../middleware/adminAuth');

router.get('/', productController.list);
router.get('/:id', productController.get);

// Admin-protected
router.post('/', adminAuth, productController.create);
router.put('/:id', adminAuth, productController.update);
router.delete('/:id', adminAuth, productController.destroy);

module.exports = router;
