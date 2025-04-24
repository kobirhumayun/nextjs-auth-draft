const Plan = require('../models/Plan');
const mongoose = require('mongoose');

/**
 * @desc   Add a new subscription plan (Admin only)
 * @route  POST /api/plans
 * @access Private/Admin
 * @body   { name, slug, description?, price, billingCycle, currency?, features?, limits?, isPublic?, displayOrder?, stripePriceId? }
 */
const addPlan = async (req, res) => {
    // Destructure expected fields from request body
    const {
        name,
        slug,
        description,
        price,
        billingCycle,
        features, // Optional, defaults in schema
        // currency, // Optional, defaults in schema
        // limits,   // Optional, defaults in schema
        // isPublic, // Optional, defaults in schema
        // displayOrder, // Optional, defaults in schema
        // stripePriceId // Optional
    } = req.body;

    // Basic validation for required fields (Schema also validates, but good for early exit)
    if (!name || !slug || price === undefined || !billingCycle) {
        return res.status(400).json({ message: 'Please provide name, slug, price, and billingCycle for the plan.' });
    }

    try {
        // Check if a plan with the same name or slug already exists
        // Mongoose unique index handles this, but pre-checking gives specific errors
        const existingPlan = await Plan.findOne({ $or: [{ name }, { slug }] });
        if (existingPlan) {
            let conflictField = existingPlan.name === name ? 'name' : 'slug';
            return res.status(409).json({ message: `A plan with this ${conflictField} already exists.` });
        }

        // Create new plan instance
        const newPlan = new Plan({
            name,
            slug: slug.toLowerCase().trim(), // Ensure slug is lowercase and trimmed
            description,
            price,
            billingCycle,
            features, // Let schema default handle if undefined
            // currency, // Let schema default handle if undefined
            // limits,   // Let schema default handle if undefined
            // isPublic, // Let schema default handle if undefined
            // displayOrder, // Let schema default handle if undefined
            // stripePriceId
        });

        // Save the new plan to the database
        const savedPlan = await newPlan.save();

        res.status(201).json({ // 201 Created status
            message: 'Plan created successfully.',
            plan: savedPlan
        });

    } catch (error) {
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            // Extract specific validation messages
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation failed', errors: messages });
        }
        // Handle duplicate key error (if pre-check somehow missed it or during race condition)
        if (error.code === 11000) {
            // Determine which field caused the duplicate error
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ message: `A plan with this ${field} already exists.` });
        }

        // Generic server error
        console.error('Error adding plan:', error);
        res.status(500).json({ message: 'Server error while creating plan.' });
    }
};

/**
 * @desc   Delete a subscription plan by its slug (Admin only)
 * @route  DELETE /api/plans
 * @access Private/Admin
 * @param  {string} slug - The unique slug of the plan to delete
 */
const deletePlan = async (req, res) => {
    // Get the plan slug from the route parameters
    const { slug } = req.body;

    // Basic validation: Check if slug is provided
    if (!slug) {
        // Although the route matching usually handles this, it's good practice
        return res.status(400).json({ message: 'Plan slug is required.' });
    }

    try {
        // Find the plan by its unique slug and delete it
        // findOneAndDelete returns the deleted document or null if not found
        // Ensure the slug is matched case-insensitively
        // Assuming slugs are stored lowercase and trimmed (as done in addPlan)
        const deletedPlan = await Plan.findOneAndDelete({ slug: slug.toLowerCase().trim() });

        // Check if a plan was actually found and deleted
        if (!deletedPlan) {
            return res.status(404).json({ message: `Plan with slug '${slug}' not found.` });
        }

        // Respond with success message
        res.status(200).json({
            message: 'Plan deleted successfully.',
            deletedSlug: slug // Return the slug that was used for deletion
        });

    } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error deleting plan with slug '${slug}':`, error);

        // Generic server error response
        res.status(500).json({ message: 'Server error while deleting plan.' });
    }
};

module.exports = {
    addPlan,
    deletePlan // Export the new function
};