const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const contactController = require('../controllers/contactController');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// rate limit: protect contact form from abuse (5 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many contact submissions from this IP, please try again later.' }
});

// Public: submit contact
router.post(
  '/',
  limiter,
  [
    body('name').trim().isLength({ min: 2, max: 200 }).withMessage('Name is required (2-200 chars)'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('subject').optional().trim().isLength({ max: 200 }).withMessage('Subject too long'),
    body('message').trim().isLength({ min: 3, max: 10000 }).withMessage('Message is required (3-10000 chars)'),
    body('recaptchaToken').optional().trim().notEmpty().withMessage('recaptchaToken is required')
  ],
  contactController.create
);

// Admin: list/get/mark handled (requires admin auth)
router.get('/', adminAuth, contactController.list);
router.get('/:id', adminAuth, contactController.get);
router.post('/:id/handle', adminAuth, contactController.handle);

module.exports = router;
