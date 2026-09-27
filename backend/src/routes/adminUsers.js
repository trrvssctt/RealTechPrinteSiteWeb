const express = require('express');
const router = express.Router();
const adminUsersController = require('../controllers/adminUsersController');
const adminAuth = require('../middleware/adminAuth');
const requireRole = require('../middleware/requireRole');

// All routes require admin auth. Additional role checks can be applied.
router.use(adminAuth);

router.get('/', requireRole('admin'), adminUsersController.listUsers);
router.post('/', requireRole('admin'), adminUsersController.createUser);
router.put('/:id', requireRole('admin'), adminUsersController.updateUser);
router.delete('/:id', requireRole('admin'), adminUsersController.deleteUser);
router.post('/:id/restore', requireRole('admin'), adminUsersController.restoreUser);
router.get('/logs', requireRole('admin'), adminUsersController.listLogs);
router.get('/:id/activity', requireRole('admin'), adminUsersController.getUserActivity);
router.get('/:id/history', requireRole('admin'), adminUsersController.getUserHistory);
router.get('/:id', requireRole('admin'), adminUsersController.getUser);

module.exports = router;
