const express = require('express');
const router = express.Router();
const adminClientsController = require('../controllers/adminClientsController');
const adminAuth = require('../middleware/adminAuth');
const requireRole = require('../middleware/requireRole');

router.use(adminAuth);

router.get('/', requireRole('admin'), adminClientsController.listClients);
router.get('/:id', requireRole('admin'), adminClientsController.getClient);
router.post('/', requireRole('admin'), adminClientsController.createClient);
router.put('/:id', requireRole('admin'), adminClientsController.updateClient);
router.delete('/:id', requireRole('admin'), adminClientsController.deleteClient);
router.get('/stats', requireRole('admin'), adminClientsController.stats);

module.exports = router;
