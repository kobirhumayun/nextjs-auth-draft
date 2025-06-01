const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const { reloadPolicies } = require('../services/casbin');
const User = require('../models/User');

// Example of a protected route
router.put('/reload-policies',
    authenticate,
    authorize("admin"),
    async (req, res) => {
        try {
            await reloadPolicies();
            res.json({ message: 'Policies reloaded successfully. by', user: req.user });
        } catch (error) {
            res.status(500).json({ message: 'Error reloading policies.', error: error.message });
        }
    });

router.get('/user-profile',
    authenticate,
    authorize("admin"),
    async (req, res) => {
        try {

            const { identifier } = req.query;

            if (!identifier) {
                return res.status(400).json({ message: 'Please provide a username or email in the query parameters (e.g., /user-profile?identifier=your_username_or_email).' });
            }

            // Find user by username or email
            // Ensure you have database indexes on 'username' and 'email' fields for performance.
            const user = await User.findOne({
                $or: [{ username: identifier }, { email: identifier }]
            }).populate('planId');

            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            res.status(200).json({
                message: 'User profile fetched successfully.',
                user
            });

        } catch (error) {
            // Log the error for debugging purposes on the server
            console.error('Error fetching user profile:', error);
            res.status(500).json({ message: 'Error fetching user profile.', error: error.message });
        }
    }
);

router.post('/basic-info',
    authenticate,
    authorize("basic"),
    async (req, res) => {
        res.json({ message: 'This is a protected route. accessed by', user: req.user });
    });

router.post('/professional-info',
    authenticate,
    authorize("professional"),
    async (req, res) => {
        res.json({ message: 'This is a protected route. accessed by', user: req.user });
    });

router.post('/business-info',
    authenticate,
    authorize("business"),
    async (req, res) => {
        res.json({ message: 'This is a protected route. accessed by', user: req.user });
    });

router.post('/enterprise-info',
    authenticate,
    authorize("enterprise"),
    async (req, res) => {
        res.json({ message: 'This is a protected route. accessed by', user: req.user });
    });

router.get('/user-info',
    authenticate,
    async (req, res) => {
        res.json({ message: 'This is a protected route.', user: req.user });
    });

module.exports = router;
