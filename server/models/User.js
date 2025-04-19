const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * @description Represents a user account in the system.
 */
const userSchema = new Schema({
    username: {
        type: String,
        required: [true, 'Username is required.'],
        unique: true,
        trim: true,
        index: true // Index for faster username lookups
    },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'], // Basic email validation
        index: true // Index for faster email lookups
    },
    password_hash: {
        type: String,
        required: [true, 'Password hash is required.'],
        select: false // Exclude password hash from query results by default
    },
    refresh_token: {
        type: String,
        select: false // Exclude refresh token from query results by default
    },
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    profilePictureUrl: {
        type: String,
        trim: true
    },
    planId: {
        type: Schema.Types.ObjectId,
        ref: 'Plan', // Reference to the Plan model
        index: true // Index for queries filtering/populating by plan
        // Consider making this required depending on your logic (e.g., assign a default 'free' plan on signup)
        // required: [true, 'User must have a plan assigned.']
    },
    subscriptionStatus: {
        type: String,
        enum: ['active', 'trialing', 'canceled', 'past_due', 'pending', 'free'], // Added 'free', 'pending'
        default: 'pending', // Default status until activation/payment
        index: true
    },
    subscriptionStartDate: {
        type: Date
    },
    subscriptionEndDate: { // End of current billing cycle or trial
        type: Date,
        index: true
    },
    trialEndsAt: {
        type: Date,
        index: true
    },
    roles: {
        type: [String],
        enum: ['user', 'admin', 'editor', 'support'], // Define roles
        default: ['user'],
        index: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        select: false // Usually sensitive
    },
    emailVerificationExpires: {
        type: Date,
        select: false
    },
    resetPasswordToken: {
        type: String,
        select: false
    },
    resetPasswordExpires: {
        type: Date,
        select: false
    },
    authProvider: {
        type: String,
        enum: ['local', 'google', 'facebook', 'github'], // Add providers as needed
        default: 'local',
        index: true
    },
    providerId: { // User ID from the external provider (e.g., Google ID)
        type: String,
        index: true,
        sparse: true // Allows multiple nulls, unique when set (compound index with authProvider might be better)
    },
    isActive: { // For soft deletion or suspension
        type: Boolean,
        default: true,
        index: true
    },
    lastLoginAt: {
        type: Date
    },
    preferences: { // User-specific settings
        type: Schema.Types.Mixed,
        default: {}
    },
    metadata: { // Flexible field for extra data
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;