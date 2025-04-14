const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Environment Variables ---
// Ensure these are set in your .env file
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m'; // Default: 15 minutes
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d'; // Default: 7 days
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    sameSite: 'strict', // Mitigate CSRF attacks
    // maxAge can be set if needed, often aligned with refresh token expiry
};


/**
 * @description Registers a new user.
 * @route POST /api/users/register
 * @access Public
 */
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Basic input validation (consider using a library like Joi or express-validator)
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide username, email, and password.' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists.' });
        }

        // Hash the password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = new User({
            username,
            email,
            password_hash,
            // Initialize refreshToken field if you store it in the DB
            // refreshToken: null
        });

        // Save the user
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error('Error registering user:', error);
        // Avoid sending detailed error messages in production
        res.status(500).json({ message: 'Error registering user.' });
    }
};

// --- Helper Functions ---

/**
 * @description Compares a plain password with a hashed password.
 *              NOTE: It's generally better practice to put this as an instance method
 *              on your Mongoose User model (e.g., user.isPasswordCorrect(password)).
 * @param {string} plainPassword - The password attempt from the user.
 * @param {string} hashedPassword - The stored hashed password.
 * @returns {Promise<boolean>} - True if passwords match, false otherwise.
 */
const isPasswordCorrect = async (plainPassword, hashedPassword) => {
    if (!plainPassword || !hashedPassword) {
        return false;
    }
    return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * @description Generates a JWT Access Token.
 * @param {object} user - The user object (must contain _id).
 * @returns {string} - The generated access token.
 * @throws {Error} - If ACCESS_TOKEN_SECRET is not defined.
 */
const generateAccessToken = (user) => {
    if (!ACCESS_TOKEN_SECRET) {
        throw new Error('ACCESS_TOKEN_SECRET is not defined in environment variables.');
    }
    return jwt.sign(
        {
            _id: user._id,
            // Include other non-sensitive info if needed (e.g., roles)
            // username: user.username
        },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * @description Generates a JWT Refresh Token.
 * @param {object} user - The user object (must contain _id).
 * @returns {string} - The generated refresh token.
 * @throws {Error} - If REFRESH_TOKEN_SECRET is not defined.
 */
const generateRefreshToken = (user) => {
    if (!REFRESH_TOKEN_SECRET) {
        throw new Error('REFRESH_TOKEN_SECRET is not defined in environment variables.');
    }
    return jwt.sign(
        { _id: user._id },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
};

/**
 * @description Generates both Access and Refresh Tokens for a user and updates the user's refresh token in the DB.
 * @param {object} user - The Mongoose user document.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} - The generated tokens.
 * @throws {Error} - If token generation or DB update fails.
 */
const generateAccessAndRefereshTokens = async (user) => {
    try {
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store the refresh token in the database associated with the user
        // This allows invalidating it on logout or if compromised
        user.refresh_token = refreshToken;
        await user.save({ validateBeforeSave: false }); // Skip validation if only updating token

        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Error generating tokens or updating user:", error);
        // Throw a more specific error or handle it appropriately
        throw new Error('Failed to generate tokens and update user.');
    }
};


// --- Controller Functions ---

/**
 * @description Logs in a user.
 * @route POST /api/users/login
 * @access Public
 */
const loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body; // Use 'identifier' for username or email

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Please provide username/email and password.' });
        }

        // Find user by username or email
        // Select '+password_hash' if it's excluded by default in your schema
        const user = await User.findOne({
            $or: [{ username: identifier }, { email: identifier }]
        }).select('+password_hash +refresh_token'); // Include fields needed for login

        if (!user) {
            return res.status(404).json({ message: 'Invalid credentials.' }); // Generic message
        }

        // Verify password
        // Assuming isPasswordCorrect is available or using bcrypt directly
        // const isMatch = await user.isPasswordCorrect(password); // If using model method
        const isMatch = await isPasswordCorrect(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' }); // Generic message
        }

        // Passwords match, generate tokens
        const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user);

        // Send tokens back to the client
        // Access token in the response body
        // Refresh token in an HTTP-only cookie
        res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

        res.status(200).json({
            message: 'Login successful.',
            accessToken,
            user: { // Send back non-sensitive user info
                _id: user._id,
                username: user.username,
                email: user.email,
                // Add other fields as needed
            }
        });

    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Error logging in user.', error: error.message });
    }
};

/**
 * @description Logs out a user by clearing the refresh token.
 * @route POST /api/users/logout
 * @access Private (Requires authentication - typically via access token)
 */
const logoutUser = async (req, res) => {
    // Assumes user ID is available from authentication middleware (e.g., req.user._id)
    // If not using middleware, you might need to get the refresh token from the cookie
    // and find the user based on that (less secure if token isn't verified first).

    const userId = req.user?._id; // Get user ID from request (set by auth middleware)
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
        // Even if no cookie, proceed to clear any potential server-side token
        // and respond successfully, as the client state is effectively logged out.
        console.warn('Logout attempt without refresh token cookie.');
        // return res.status(400).json({ message: 'No refresh token found.' });
    }

    // Clear the refresh token cookie regardless
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    try {
        // Find the user and remove their refresh token from the database
        // This invalidates the specific refresh token they were using.
        const user = await User.findOneAndUpdate(
            // Find criteria: either by ID (if auth middleware provides it) or by the token itself
            userId ? { _id: userId } : { refresh_token: incomingRefreshToken },
            { $unset: { refresh_token: "" } }, // Use $unset or set to null/undefined
            { new: true } // Optional: return the updated document
        );

        if (!user && incomingRefreshToken) {
            // This could happen if the token in the cookie is invalid or already cleared
            console.warn(`Logout: User not found for refresh token provided or token already cleared.`);
        } else if (!userId && !incomingRefreshToken) {
            console.warn('Logout: No user ID from auth middleware and no refresh token cookie.');
        }

        res.status(200).json({ message: 'User logged out successfully.' });

    } catch (error) {
        console.error('Error logging out user:', error);
        res.status(500).json({ message: 'Error logging out user.', error: error.message });
    }
};


/**
 * @description Refreshes the access token using a valid refresh token.
 * @route POST /api/users/refresh-token
 * @access Public (but requires a valid refresh token cookie)
 */
const refreshAccessToken = async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;

    if (!incomingRefreshToken) {
        return res.status(401).json({ message: 'Unauthorized: No refresh token provided.' });
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET);

        // Find the user associated with the token ID
        const user = await User.findById(decoded._id).select('+refresh_token'); // Ensure refreshToken is selected

        // Check if user exists and if the incoming token matches the one stored in the DB
        if (!user || user.refresh_token !== incomingRefreshToken) {
            // If mismatch, potentially compromised token or user logged out elsewhere.
            // Consider clearing the cookie here as a security measure.
            res.clearCookie('refreshToken', COOKIE_OPTIONS);
            return res.status(403).json({ message: 'Forbidden: Invalid refresh token.' });
        }

        // Generate new tokens (optional: implement refresh token rotation)
        // For simplicity here, we'll just generate a new access token.
        // For rotation: generate new access AND refresh tokens, update DB, send new cookie.
        const newAccessToken = generateAccessToken(user);

        // --- Optional: Refresh Token Rotation ---
        // const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshTokens(user);
        // res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
        // --- End Optional Rotation ---


        res.status(200).json({
            message: 'Access token refreshed.',
            accessToken: newAccessToken,
        });

    } catch (error) {
        console.error('Error refreshing access token:', error);
        // Handle specific JWT errors (e.g., TokenExpiredError, JsonWebTokenError)
        if (error instanceof jwt.TokenExpiredError) {
            res.clearCookie('refreshToken', COOKIE_OPTIONS); // Clear expired token cookie
            return res.status(403).json({ message: 'Forbidden: Refresh token expired.' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            res.clearCookie('refreshToken', COOKIE_OPTIONS); // Clear invalid token cookie
            return res.status(403).json({ message: 'Forbidden: Invalid refresh token.' });
        }
        // Generic server error
        res.status(500).json({ message: 'Error refreshing access token.', error: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    // Export helpers if needed elsewhere, though often kept internal
    // isPasswordCorrect,
    // generateAccessToken,
    // generateRefreshToken,
    // generateAccessAndRefereshTokens
};
