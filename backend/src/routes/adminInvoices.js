const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const ctrl = require('../controllers/invoicesController');

// Les employés facturent les commandes qu'ils gèrent ; seule l'annulation est réservée à l'admin
router.get('/',            adminOrEmployeeAuth, ctrl.listInvoices);
router.post('/from-order', adminOrEmployeeAuth, ctrl.createFromOrder);
router.post('/proforma',   adminOrEmployeeAuth, ctrl.createProforma);
router.get('/:id',         adminOrEmployeeAuth, ctrl.getInvoice);
router.patch('/:id/cancel', adminAuth,          ctrl.cancelInvoice);

module.exports = router;
