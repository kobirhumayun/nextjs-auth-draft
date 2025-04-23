const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const authController = require('../controllers/authController');
// Optional: Add input validation middleware (e.g., express-validator)
// Optional: Add rate limiting middleware

// User registration route
router.post('/register', userController.registerUser);

// User login route
router.post('/login', userController.loginUser);

// User logout route
router.post('/logout', userController.logoutUser);

// Refresh access token route
router.post('/refresh-token', userController.refreshAccessToken);

// --- Password Reset Routes ---
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);


// Export the router

module.exports = router;
