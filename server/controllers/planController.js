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
 * @desc   Update a subscription plan identified by its slug in the request body (Admin only)
 * @route  PUT /api/plans  <-- Route no longer needs :slug param
 * @access Private/Admin
 * @body   { targetSlug: string, name?, slug?, description?, price?, billingCycle?, currency?, features?, limits?, isPublic?, displayOrder?, stripePriceId? } - targetSlug identifies the plan, other fields are updates.
 */
const updatePlan = async (req, res) => {
    // Get the slug of the plan to update AND the update data from the request body
    const { targetSlug, ...updateData } = req.body;

    // Basic validation: Check if targetSlug is provided in the body
    if (!targetSlug) {
        return res.status(400).json({ message: 'targetSlug is required in the request body to identify the plan.' });
    }

    // Check if there's any actual update data provided (besides targetSlug)
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No update data provided (besides targetSlug).' });
    }

    // Sanitize the potential new slug if provided in updateData
    if (updateData.slug) {
        updateData.slug = updateData.slug.toLowerCase().trim();
    }

    try {
        // Find the plan by its target slug first to ensure it exists
        const planToUpdate = await Plan.findOne({ slug: targetSlug.toLowerCase().trim() });

        if (!planToUpdate) {
            return res.status(404).json({ message: `Plan with slug '${targetSlug}' not found.` });
        }

        // --- Conflict Check (if name or new slug is being updated) ---
        // Check if the new name or new slug conflicts with another existing plan
        const conflictQuery = [];
        if (updateData.name && updateData.name !== planToUpdate.name) {
            conflictQuery.push({ name: updateData.name });
        }
        // Check if a *new* slug is provided and it's different from the *original* slug
        if (updateData.slug && updateData.slug !== planToUpdate.slug) {
            conflictQuery.push({ slug: updateData.slug });
        }

        if (conflictQuery.length > 0) {
            const conflictingPlan = await Plan.findOne({
                _id: { $ne: planToUpdate._id }, // Exclude the current plan itself
                $or: conflictQuery
            });

            if (conflictingPlan) {
                let conflictField = (conflictingPlan.name === updateData.name) ? 'name' : 'slug';
                return res.status(409).json({ message: `Another plan with the proposed ${conflictField} already exists.` });
            }
        }
        // --- End Conflict Check ---

        // Find the plan by the original target slug and update it with the new data
        // { new: true } returns the updated document
        // { runValidators: true } ensures schema validations run on the update
        const updatedPlan = await Plan.findOneAndUpdate(
            { slug: targetSlug.toLowerCase().trim() }, // Find by original target slug from body
            { $set: updateData }, // Apply the updates
            { new: true, runValidators: true, context: 'query' } // Options
        );

        // Although checked existence earlier, findOneAndUpdate could potentially fail
        // (e.g., race condition where it was deleted between the findOne and findOneAndUpdate).
        // It returns null if no document was found *to update*.
        if (!updatedPlan) {
            // This case is less likely given the initial check, but good for robustness
            return res.status(404).json({ message: `Plan with slug '${targetSlug}' not found during update attempt.` });
        }

        res.status(200).json({
            message: 'Plan updated successfully.',
            plan: updatedPlan
        });

    } catch (error) {
        // Handle Mongoose validation errors during update
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation failed during update', errors: messages });
        }
        // Handle duplicate key error during update (if conflict check somehow missed it or race condition)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ message: `Update failed: A plan with this ${field} already exists.` });
        }

        // Generic server error
        console.error(`Error updating plan identified by slug '${targetSlug}':`, error);
        res.status(500).json({ message: 'Server error while updating plan.' });
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
    updatePlan,
    deletePlan
};