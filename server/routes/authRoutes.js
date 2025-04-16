const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');

// Example of a protected route
router.get('/user-info', authenticate, (req, res) => {
    res.json({ message: 'This is a protected route.', user: req.user });
});

module.exports = router;
