const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');

// Optional: Add input validation middleware (e.g., express-validator)
// Optional: Add rate limiting middleware

// Add plan route
router.post('/plan', planController.addPlan);

// Delete plan route
router.delete('/plan', planController.deletePlan);




// Export the router

module.exports = router;
