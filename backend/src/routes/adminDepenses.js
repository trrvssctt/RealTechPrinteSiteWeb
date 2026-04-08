const express = require('express');
const router = express.Router();

const adminAuth             = require('../middleware/adminAuth');
const adminOrEmployeeAuth   = require('../middleware/adminOrEmployeeAuth');
const ctrl                  = require('../controllers/depensesController');

// Lecture (admin + employé)
router.get('/',              adminOrEmployeeAuth, ctrl.list);
router.get('/categories',    adminOrEmployeeAuth, ctrl.getCategories);

// Création (admin + employé) — immuable après création
router.post('/',             adminOrEmployeeAuth, ctrl.create);

// Actions admin uniquement (pas de suppression définitive)
router.patch('/:id/valider', adminAuth, ctrl.valider);
router.patch('/:id/rejeter', adminAuth, ctrl.rejeter);
router.patch('/:id/annuler', adminAuth, ctrl.annuler);

module.exports = router;
