const express = require('express');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const router = express.Router();
const userController = require('../controllers/user');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const {
    registerValidationRules,
    loginValidationRules,
    requestPasswordResetValidationRules,
    handleValidationErrors
} = require('../validators/validatorsIndex'); // Adjust path as needed

// Slow down brute-force attempts
const speedLimiter = slowDown({
    windowMs: 60 * 1000,       // 1 minute
    delayMs: () => 1000,         // every request over the limit is delayed by 1 s
    maxDelayMs: 5 * 1000         // cap the delay at 5 s (optional)
});

// Final rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 5,                    // limit each IP to 5 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false
});
// User registration route
router.post('/register', registerValidationRules(), handleValidationErrors, userController.registerUser);

// User login route
router.post('/login', speedLimiter, limiter, loginValidationRules(), handleValidationErrors, userController.loginUser);

// User logout route
router.post('/logout', userController.logoutUser);

// Refresh access token route
router.post('/refresh-token', userController.refreshAccessToken);

// --- Password Reset Routes ---
router.post('/request-password-reset', requestPasswordResetValidationRules(), handleValidationErrors, authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);



// Export the router

module.exports = router;
