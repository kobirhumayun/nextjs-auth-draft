const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');

// User registration route
router.post('/register', userController.registerUser);

module.exports = router;
