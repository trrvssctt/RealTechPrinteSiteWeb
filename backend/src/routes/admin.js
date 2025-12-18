const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const analyticsController = require('../controllers/analyticsController');

// Protected by ADMIN_SETUP_TOKEN in header x-admin-setup-token or body.token
router.post('/setup', adminController.setupAdmin);

// Admin visits listing (requires admin session)
router.get('/visits', adminAuth, analyticsController.listVisits);

module.exports = router;
