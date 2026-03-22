const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const stockController = require('../controllers/stockMouvementController');

// allow admins and employees to list stock movements
router.get('/', adminOrEmployeeAuth, stockController.list);

// creating movements remains admin-only
router.post('/', adminAuth, stockController.create);

module.exports = router;
