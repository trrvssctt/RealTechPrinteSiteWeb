const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');

router.get('/', productController.list);
// Liste complète pour l'admin et les employés (inclut les produits inactifs) — doit précéder '/:id'
router.get('/all', adminOrEmployeeAuth, productController.listAll);
router.get('/:id', productController.get);

// Admin-protected
router.post('/', adminAuth, productController.create);
router.put('/:id', adminAuth, productController.update);
router.delete('/:id', adminAuth, productController.destroy);

module.exports = router;
