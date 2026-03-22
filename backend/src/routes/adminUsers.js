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
router.get('/logs', requireRole('admin'), adminUsersController.listLogs);

module.exports = router;
