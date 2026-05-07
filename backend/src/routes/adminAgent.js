const express  = require('express');
const router   = express.Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl     = require('../controllers/agentController');

// Toutes les routes sont admin uniquement
router.use(adminAuth);

// ── Données pour les outils n8n (aussi appelées par le workflow) ────────────
router.get('/stats',        ctrl.getStats);
router.get('/employees',    ctrl.getEmployees);
router.get('/sales',        ctrl.getSales);
router.get('/stock',        ctrl.getStock);
router.get('/top-products', ctrl.getTopProducts);
router.get('/clients',      ctrl.getClients);
router.get('/depenses',     ctrl.getDepenses);

// ── Chat admin (interface panel) ───────────────────────────────────────────
router.post('/chat', ctrl.chat);
router.get('/conversations',     ctrl.listConversations);
router.get('/conversations/:id', ctrl.getConversation);

// ── Journal notifications WhatsApp ────────────────────────────────────────
router.get('/notifications',           ctrl.listNotifications);
router.post('/notifications/:id/retry', ctrl.retryNotification);

module.exports = router;
