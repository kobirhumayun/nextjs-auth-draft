const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { authenticate } = require('../middleware/authMiddleware');

// Optional: Add input validation middleware (e.g., express-validator)
// Optional: Add rate limiting middleware

// Add plan route
router.post('/plan', authenticate, planController.addPlan);

// Delete plan route
router.delete('/plan', authenticate, planController.deletePlan);

// Update plan route
router.put('/plan', authenticate, planController.updatePlan);

// Get subscription details route
router.get('/my-plan', authenticate, planController.getSubscriptionDetails);

// Change plan route
router.post('/change-plan', authenticate, planController.changePlan);

// Get all plans route
router.get('/all-plans', planController.getAllPlans);

// Create payment record route
router.post('/payment', authenticate, planController.createPaymentRecord);

// Get payments by status route
router.get('/payment', authenticate, planController.getPaymentsByStatus);

// Export the router

module.exports = router;
