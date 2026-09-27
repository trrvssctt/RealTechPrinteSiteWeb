const express = require('express');
const router = express.Router();
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const rapportsController = require('../controllers/rapportsController');

router.use(adminOrEmployeeAuth);

router.get('/', rapportsController.list);
router.post('/', rapportsController.create);
router.get('/download/:filename', rapportsController.download);
router.get('/:id/data', rapportsController.data);

module.exports = router;
