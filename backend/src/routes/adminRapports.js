const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const rapportsController = require('../controllers/rapportsController');

router.use(adminAuth);

router.get('/', rapportsController.list);
router.post('/', rapportsController.create);
router.get('/download/:filename', rapportsController.download);

module.exports = router;
