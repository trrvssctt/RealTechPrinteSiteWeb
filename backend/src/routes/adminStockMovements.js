const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const stockController = require('../controllers/stockMouvementController');

router.use(adminAuth);

router.get('/', stockController.list);
router.post('/', stockController.create);

module.exports = router;
