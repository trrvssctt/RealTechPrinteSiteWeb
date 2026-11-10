const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/funnelsController');

// Funnels promo : réservé aux admins
const router = express.Router();
router.use(adminAuth);

router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);
router.get('/settings/payment', ctrl.getSettings);
router.put('/settings/payment', ctrl.updateSettings);
router.post('/orders/:orderId/confirm', ctrl.confirmOrder);
router.post('/orders/:orderId/not-received', ctrl.markNotReceived);
router.post('/orders/:orderId/cancel', ctrl.cancelOrder);
router.post('/', ctrl.create);
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/orders', ctrl.listOrders);

module.exports = router;
