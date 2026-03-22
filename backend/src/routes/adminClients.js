const express = require('express');
const router = express.Router();
const adminClientsController = require('../controllers/adminClientsController');
const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const requireRole = require('../middleware/requireRole');

// Allow admins and employees to list and create clients
router.get('/', adminOrEmployeeAuth, adminClientsController.listClients);
router.get('/:id', adminOrEmployeeAuth, adminClientsController.getClient);
router.post('/', adminOrEmployeeAuth, adminClientsController.createClient);

// Update/delete/stats remain admin-only
router.put('/:id', adminAuth, requireRole('admin'), adminClientsController.updateClient);
router.delete('/:id', adminAuth, requireRole('admin'), adminClientsController.deleteClient);
router.get('/stats', adminAuth, requireRole('admin'), adminClientsController.stats);

module.exports = router;
