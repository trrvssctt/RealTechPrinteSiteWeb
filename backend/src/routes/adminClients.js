const express = require('express');
const router = express.Router();
const adminClientsController = require('../controllers/adminClientsController');
const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const requireRole = require('../middleware/requireRole');

// Allow admins and employees to list and create clients
router.get('/',          adminOrEmployeeAuth, adminClientsController.listClients);
router.get('/ranking',   adminOrEmployeeAuth, adminClientsController.getRanking);
router.post('/',         adminOrEmployeeAuth, adminClientsController.createClient);

// Stats par client — accessible à tous les employés
router.get('/:id/stats', adminOrEmployeeAuth, adminClientsController.getClientStats);
router.get('/:id',       adminOrEmployeeAuth, adminClientsController.getClient);

// Update/delete/stats globales — admin uniquement
router.put('/:id',    adminAuth, requireRole('admin'), adminClientsController.updateClient);
router.delete('/:id', adminAuth, requireRole('admin'), adminClientsController.deleteClient);
router.get('/stats',  adminAuth, requireRole('admin'), adminClientsController.stats);

module.exports = router;
