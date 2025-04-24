const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');

// Optional: Add input validation middleware (e.g., express-validator)
// Optional: Add rate limiting middleware

// Add plan route
router.post('/add-plan', planController.addPlan);




// Export the router

module.exports = router;
