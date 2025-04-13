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
    }
}, {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;