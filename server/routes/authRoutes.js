const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const { reloadPolicies } = require('../services/casbin');

// Example of a protected route
router.put('/reload-policies', authenticate, authorize("admin"), async (req, res) => {
    try {
        await reloadPolicies();
        res.json({ message: 'Policies reloaded successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error reloading policies.', error: error.message });
    }
}
)
router.get('/user-info', authenticate, (req, res) => {
    res.json({ message: 'This is a protected route.', user: req.user });
});

module.exports = router;
