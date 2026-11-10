const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/funnelPublicController');

const router = express.Router();

// Réservations et déclarations de paiement : limitées par adresse IP (anti-abus du stock promo)
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});
const visitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.get('/orders/:token', ctrl.getOrder);
router.post('/orders/:token/declare', orderLimiter, ctrl.declarePayment);
router.get('/:slug', ctrl.getFunnel);
router.post('/:slug/visit', visitLimiter, ctrl.trackVisit);
router.post('/:slug/orders', orderLimiter, ctrl.createReservation);

module.exports = router;
