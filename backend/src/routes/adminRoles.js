const express = require('express');
const router = express.Router();
const adminRolesController = require('../controllers/adminRolesController');
const adminAuth = require('../middleware/adminAuth');
const requireRole = require('../middleware/requireRole');

router.use(adminAuth);

router.get('/', requireRole('admin'), adminRolesController.listRoles);
router.post('/', requireRole('admin'), adminRolesController.createRole);
router.delete('/:id', requireRole('admin'), adminRolesController.deleteRole);

module.exports = router;
