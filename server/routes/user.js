const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');

// User registration route
router.post('/register', userController.registerUser);

// User login route
router.post('/login', userController.loginUser);

// User logout route
router.post('/logout', userController.logoutUser);

// Refresh access token route
router.post('/refresh-token', userController.refreshAccessToken);

// Export the router

module.exports = router;
