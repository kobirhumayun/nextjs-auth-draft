const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

/**
 * @description Middleware to authenticate requests using JWT.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
const authenticate = async (req, res, next) => {
    // Get the token from the Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

        // Find the user associated with the token ID
        const user = await User.findById(decoded._id).select('_id username email');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Attach the user object to the request
        req.user = user;

        // Proceed to the next middleware
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        // Handle specific JWT errors
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(403).json({ message: 'Forbidden: Token expired.' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({ message: 'Forbidden: Invalid token.' });
        }
        // Generic error
        res.status(500).json({ message: 'Error authenticating user.', error: error.message });
    }
};

module.exports = { authenticate };
