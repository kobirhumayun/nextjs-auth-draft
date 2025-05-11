const express = require('express');
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

// Optional: Add rate limiting middleware

// User registration route
router.post('/register', registerValidationRules(), handleValidationErrors, userController.registerUser);

// User login route
router.post('/login', loginValidationRules(), handleValidationErrors, userController.loginUser);

// User logout route
router.post('/logout', userController.logoutUser);

// Refresh access token route
router.post('/refresh-token', userController.refreshAccessToken);

// --- Password Reset Routes ---
router.post('/request-password-reset', requestPasswordResetValidationRules(), handleValidationErrors, authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);



// Export the router

module.exports = router;
