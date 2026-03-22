const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const servicesController = require('../controllers/servicesController');

// allow admins and employees to list and view services
router.get('/', adminOrEmployeeAuth, servicesController.list);
router.get('/:id', adminOrEmployeeAuth, servicesController.getOne);

// create/update/delete remain admin-only
router.post('/', adminAuth, servicesController.create);
router.put('/:id', adminAuth, servicesController.update);
router.delete('/:id', adminAuth, servicesController.remove);

module.exports = router;
