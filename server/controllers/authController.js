const User = require('../models/User');
const Token = require('../models/Token');
const Plan = require('../models/Plan');
const { generateOtp } = require('../utils/otpUtils');
const { sendNotification } = require('../services/notificationService');
const bcrypt = require('bcryptjs');

// --- Helper Function to create and save token ---
const createAndSaveToken = async (userId, type, otpExpiryMinutes) => {
    // --- Best Practice: Handle Resend ---
    // Invalidate previous tokens of the same type for this user
    await Token.deleteMany({ userId, type });

    const otp = generateOtp(6); // Generate a 6-digit OTP
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000); // Set expiry

    // IMPORTANT: The 'Token' model's pre-save hook handles hashing the 'otp' value automatically
    const token = new Token({
        userId,
        token: otp, // Store the plain OTP here; it gets hashed before saving
        type,
        expiresAt,
    });

    await token.save();

    return otp; // Return the plain OTP for sending
};

// --- Request Password Reset ---
const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // --- Best Practice: Security through Obscurity ---
            // Don't reveal if the email exists or not.
            return res.status(200).json({ message: 'If an account with that email exists, a password reset OTP has been sent.' });
        }

        // Generate, hash, and save the OTP
        const otpExpiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10); // Use env variable
        const plainOtp = await createAndSaveToken(user._id, 'passwordReset', otpExpiryMinutes);

        // Send OTP via email (using the notification service)
        const subject = 'Your Password Reset OTP';
        const text = `Your password reset OTP is: ${plainOtp}\nIt is valid for ${process.env.OTP_EXPIRY_MINUTES || '10'} minutes.`;
        // Optional HTML version
        const html = `<p>Your password reset OTP is: <b>${plainOtp}</b></p><p>It is valid for ${process.env.OTP_EXPIRY_MINUTES || '10'} minutes.</p>`;

        await sendNotification({
            method: 'email', // Specify email method
            user: user,
            subject: subject,
            text: text,
            html: html // Optional
        });

        // --- Best Practice: Consistent Response ---
        res.status(200).json({ message: 'If an account with that email exists, a password reset OTP has been sent.' });

    } catch (error) {
        console.error("Error in requestPasswordReset:", error);
        // Pass error to the central error handler
        next(error);
    }
};

// --- Reset Password ---
const resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP, and new password are required' });
        }

        // --- TODO: Add password complexity validation here ---

        const user = await User.findOne({ email });
        if (!user) {
            // Although unlikely if they got this far, handle it.
            return res.status(400).json({ message: 'Invalid request.' });
        }

        // Find the most recent password reset token for the user
        const resetToken = await Token.findOne({
            userId: user._id,
            type: 'passwordReset',
            expiresAt: { $gt: Date.now() } // Check if token hasn't expired
        }).sort({ createdAt: -1 }); // Get the latest one if multiple somehow exist (shouldn't due to deleteMany)

        if (!resetToken) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        // Verify the submitted OTP against the hashed token in the DB
        const isValidOtp = await resetToken.compareToken(otp); // Use the instance method

        if (!isValidOtp) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        // --- Success: Update the user's password ---
        // The User model's pre-save hook should handle hashing the new password
        // to be implement pre-save hook
        // Hash the password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(newPassword, saltRounds);
        user.password_hash = password_hash;
        await user.save();

        // --- Best Practice: Invalidate the token immediately after use ---
        await Token.deleteOne({ _id: resetToken._id });

        // --- Optional: Send confirmation email ---
        try {
            await sendNotification({
                method: 'email',
                user: user,
                subject: 'Your Password Has Been Reset',
                text: 'Your password for our service has been successfully reset.',
            });
        } catch (emailError) {
            console.error("Failed to send password reset confirmation email:", emailError);
            // Don't fail the whole request if confirmation email fails
        }

        res.status(200).json({ message: 'Password reset successfully.' });

    } catch (error) {
        console.error("Error in resetPassword:", error);
        // Pass error to the central error handler
        next(error);
    }
};

// --- Helper Function to create and save subscription token ---
const createAndSaveSubscriptionToken = async (userId, type, otpExpiryMinutes, billingCycle, slug) => {
    // --- Best Practice: Handle Resend ---
    // Invalidate previous tokens of the same type for this user
    await Token.deleteMany({ userId, type });

    let subscriptionOtp = generateOtp(6); // Generate a 6-digit OTP
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000); // Set expiry

    if (billingCycle === 'monthly') {
        subscriptionOtp = subscriptionOtp + '-m-' + slug;
    } else if (billingCycle === 'annually') {
        subscriptionOtp = subscriptionOtp + '-y-' + slug;
    } else {
        // For 'free', 'lifetime', or unknown cycles, set no specific end date
        subscriptionOtp = subscriptionOtp + slug;
    }

    // IMPORTANT: The 'Token' model's pre-save hook handles hashing the 'subscriptionOtp' value automatically
    const token = new Token({
        userId,
        token: subscriptionOtp, // Store the plain OTP here; it gets hashed before saving
        type,
        expiresAt,
    });

    await token.save();

    return subscriptionOtp; // Return the plain subscriptionOtp for sending
};

// --- Generate subscription token ---
const generateSubscriptionToken = async (req, res, next) => {
    try {
        const { planId, billingCycle } = req.body;
        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(400).json({ message: 'Invalid plan ID.' });
        }

        // Generate, hash, and save the OTP
        const otpExpiryMinutes = parseInt(process.env.SUBSCRIPTION_OTP_EXPIRY_MINUTES || '4320', 10); // Use env variable
        const plainOtp = await createAndSaveSubscriptionToken(req.user._id, 'subscriptionToken', otpExpiryMinutes, billingCycle, plan.slug);

        // Send OTP via email (using the notification service)
        const subject = 'Your subscription token';
        const text = `Your subscription token is: ${plainOtp}\nIt is valid for ${process.env.SUBSCRIPTION_OTP_EXPIRY_MINUTES || '72'} hours.`;
        // Optional HTML version
        const html = `<p>Your subscription token is: <b>${plainOtp}</b></p><p>It is valid for ${process.env.SUBSCRIPTION_OTP_EXPIRY_MINUTES || '72'} hours.</p>`;

        await sendNotification({
            method: 'email', // Specify email method
            user: req.user,
            subject: subject,
            text: text,
            html: html // Optional
        });

        // --- Best Practice: Consistent Response ---
        res.status(200).json({ message: 'subscription token has been sent to your email.' });

    } catch (error) {
        console.error("Error in subscription token:", error);
        // Pass error to the central error handler
        next(error);
    }
};

module.exports = {
    requestPasswordReset,
    resetPassword,
    generateSubscriptionToken
};