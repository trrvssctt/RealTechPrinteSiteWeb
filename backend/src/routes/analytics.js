const express = require('express');
const router = express.Router();
const adminOrEmployeeAuth = require('../middleware/adminOrEmployeeAuth');
const analyticsController = require('../controllers/analyticsController');

// Enregistrement d'une visite : public (appelé par le site)
router.post('/visits', analyticsController.trackVisit);
// Lecture des visites : réservée au personnel (GET /api/analytics/visits et GET /api/analytics_visits)
router.get('/visits', adminOrEmployeeAuth, analyticsController.listVisits);
router.get('/', adminOrEmployeeAuth, analyticsController.listVisits);

module.exports = router;
