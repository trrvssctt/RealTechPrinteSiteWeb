const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const analyticsController = require('../controllers/analyticsController');

// Protected by ADMIN_SETUP_TOKEN in header x-admin-setup-token or body.token
router.post('/setup', adminController.setupAdmin);

// Admin visits listing: allow employees and admins to view visits summary
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
router.get('/visits', adminOrEmployeeAuth, analyticsController.listVisits);

module.exports = router;
