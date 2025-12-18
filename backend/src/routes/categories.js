const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const adminAuth = require('../middleware/adminAuth');

router.get('/', categoryController.list);
// create category (admin only)
router.post('/', adminAuth, categoryController.create);
// update category
router.put('/:id', adminAuth, categoryController.update);
// delete category
router.delete('/:id', adminAuth, categoryController.destroy);

module.exports = router;
