const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.post('/visits', analyticsController.trackVisit);
// allow GET /api/analytics/visits and GET /api/analytics_visits
router.get('/visits', analyticsController.listVisits);
// also support GET / (for mounting at /api/analytics_visits)
router.get('/', analyticsController.listVisits);

module.exports = router;
