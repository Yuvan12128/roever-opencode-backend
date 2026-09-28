const express = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const { loginRules } = require('../validators/authValidators');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Stricter rate limit for login to slow down brute-force attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes',
    errorCode: 'LOGIN_RATE_LIMITED',
  },
});

router.post('/login', loginLimiter, loginRules, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
