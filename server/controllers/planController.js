const User = require('../models/User');
const Plan = require('../models/Plan');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');

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
 * @desc   Get all available subscription plans
 * @route  GET /api/all-plans
 * @access Public or Private (depending on filtering logic, if added)
 * @query  (Optional query params for filtering/sorting could be added later)
 */
const getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find()
            .sort({ price: 1 })
            .select('-__v'); // Exclude the version key

        res.status(200).json(plans);

    } catch (error) {
        // Log the detailed error for server-side debugging
        console.error('Error fetching plans:', error);
        // Send a generic error message to the client
        res.status(500).json({ message: 'Server error while fetching plans.' });
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

// Helper function to calculate next billing date (simplified)
const calculateNextBillingDate = (startingDate, billingCycle) => {
    const now = new Date(startingDate);
    if (billingCycle === 'monthly') {
        now.setMonth(now.getMonth() + 1);
    } else if (billingCycle === 'annually') {
        now.setFullYear(now.getFullYear() + 1);
    } else {
        // For 'free', 'lifetime', or unknown cycles, set no specific end date
        return null;
    }
    return now;
};

/**
 * @desc   Change the user's current subscription plan
 * @route  POST /api/users/change-plan (Example route, adjust as needed)
 * @access Private
 * @body   { newPlanId: string }
 */
const changePlan = async (req, res) => {
    const { newPlanId } = req.body;
    // Assuming authentication middleware adds user object to req
    const userId = req.user?._id;

    // Validate userId presence (essential after auth middleware)
    if (!userId) {
        // This usually indicates an issue with the auth middleware or route protection
        return res.status(401).json({ message: 'Authentication error: User not identified.' });
    }

    // Validate newPlanId format
    if (!mongoose.Types.ObjectId.isValid(newPlanId)) {
        return res.status(400).json({ message: 'Invalid Plan ID format.' });
    }

    try {
        // Fetch user and the target plan concurrently for efficiency
        const [user, newPlan] = await Promise.all([
            User.findById(userId),
            Plan.findById(newPlanId)
        ]);

        // --- Validation Checks ---
        if (!user) {
            // Should be rare if auth middleware is correct, but good practice
            return res.status(404).json({ message: 'User not found.' });
        }
        if (!newPlan) {
            return res.status(404).json({ message: `Plan with ID '${newPlanId}' not found.` });
        }

        // Check if the user is trying to switch to a non-public plan they aren't already on
        const currentPlanIdString = user.planId?.toString();
        if (!newPlan.isPublic && currentPlanIdString !== newPlanId) {
            return res.status(403).json({ message: 'This plan is not publicly available.' }); // 403 Forbidden might be more appropriate
        }

        // Check if the user is already actively subscribed to this plan
        let subscriptionStartinDate = user.subscriptionStartDate;
        if (currentPlanIdString === newPlanId && user.subscriptionStatus === 'active') {
            subscriptionStartinDate = user.subscriptionEndDate;
        } else {
            subscriptionStartinDate = new Date(); // Start from now
        }

        // --- Payment Processing Placeholder ---
        // TODO: Implement payment gateway logic here (e.g., Stripe)
        // if (newPlan.price > 0) {
        //   1. Check if user has existing payment method or needs to add one.
        //   2. Create/update Stripe subscription or charge one-time fee.
        //   3. Handle payment failures gracefully.
        //   4. Only proceed if payment is successful.
        //   const paymentSuccessful = await processPayment(user, newPlan);
        //   if (!paymentSuccessful) {
        //       return res.status(402).json({ message: 'Payment required or failed.' }); // 402 Payment Required
        //   }
        // } else {
        //    // If moving to a free plan, potentially cancel existing paid subscription in Stripe
        //    await cancelExistingSubscription(user);
        // }
        // --- End Placeholder ---

        // --- Update User Subscription Details ---

        user.planId = newPlan._id;
        // Determine status based on price (adjust if trials are implemented)
        user.subscriptionStatus = newPlan.price === 0 ? 'free' : 'active';
        user.subscriptionStartDate = subscriptionStartinDate;
        // Calculate next billing date based on the *current time* as the start
        user.subscriptionEndDate = calculateNextBillingDate(subscriptionStartinDate, newPlan.billingCycle);
        // Reset trial end date when changing plans (adjust logic if needed)
        user.trialEndsAt = null;

        // Save the updated user document
        await user.save();

        // --- Prepare and Send Response ---
        // Construct response using the already fetched newPlan details
        res.status(200).json({
            message: 'Subscription plan changed successfully.',
            subscription: {
                // Send the full plan object or selected fields
                plan: {
                    _id: newPlan._id,
                    name: newPlan.name,
                    slug: newPlan.slug,
                    price: newPlan.price,
                    billingCycle: newPlan.billingCycle,
                    // Add other relevant plan fields if needed by the frontend
                },
                status: user.subscriptionStatus,
                startDate: user.subscriptionStartDate,
                endDate: user.subscriptionEndDate,
            }
        });

    } catch (error) {
        // Handle potential database errors during find or save
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation failed during update', errors: messages });
        }
        res.status(500).json({ message: 'Server error while changing subscription plan.' });
    }
};

/**
 * @desc   Get current user's subscription details
 * @route  GET /api/subscriptions/my-details
 * @access Private
 */
const getSubscriptionDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('planId'); // Populate plan details

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            plan: user.planId,
            status: user.subscriptionStatus,
            startDate: user.subscriptionStartDate,
            endDate: user.subscriptionEndDate,
            trialEndsAt: user.trialEndsAt,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};



/**
 * @desc   Create a new payment record
 * @route  POST /api/payments
 * @access Private (or specific access control based on context, e.g., webhook handler, admin)
 * @body   { userId, amount, currency, paymentGateway, gatewayTransactionId, purpose, planId?, paymentMethodDetails?, processedAt? }
 */
const createPaymentRecord = async (req, res) => {
    // Destructure required and optional fields from the request body
    const {
        amount,
        currency,
        paymentGateway,
        gatewayTransactionId,
        purpose,
        planId, // Optional
        paymentMethodDetails, // Optional
        processedAt, // Optional (often set when payment is confirmed)
        invoiceId, // Optional
        refundedAmount // Optional (usually 0 on creation)
    } = req.body;
    const userId = req.user._id

    // --- Basic Input Validation (Optional but Recommended) ---
    if (!userId || !amount || !currency || !paymentGateway || !gatewayTransactionId || !purpose) {
        return res.status(400).json({ message: 'Missing required payment fields.' });
    }

    // Validate ObjectIds if provided
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid User ID format.' });
    }
    if (planId && !mongoose.Types.ObjectId.isValid(planId)) {
        return res.status(400).json({ message: 'Invalid Plan ID format.' });
    }

    // --- Create and Save Payment Document ---
    try {
        // Create a new payment document instance
        const newPayment = new Payment({
            userId,
            // Mongoose Decimal128 handles string/number conversion, but ensure input is valid
            amount: amount,
            currency: currency.toUpperCase(),
            paymentGateway: paymentGateway.toLowerCase(),
            gatewayTransactionId,
            purpose,
            planId: planId || null, // Set to null if not provided
            paymentMethodDetails: paymentMethodDetails || {},
            invoiceId: invoiceId || null,
            refundedAmount: refundedAmount || 0.00,
            processedAt: processedAt ? new Date(processedAt) : new Date() // Convert string date if provided
            // createdAt and updatedAt are handled automatically by timestamps: true
        });

        // Save the document to the database
        const savedPayment = await newPayment.save();

        // Respond with the created payment record
        res.status(201).json({ // 201 Created status
            message: 'Payment record created successfully.',
            payment: savedPayment
        });

    } catch (error) {
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation failed', errors: messages });
        }
        // Handle duplicate key error (likely on gatewayTransactionId)
        if (error.code === 11000) {
            // Determine which field caused the duplicate error
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ message: `Duplicate entry: A payment record with this ${field} already exists.` });
        }

        // Handle other potential errors (e.g., database connection issues)
        res.status(500).json({ message: 'Server error while creating payment record.' });
    }
};

/**
 * @desc   Get payment records based on status
 * @route  GET /api/payments?status=<status_value>&page=<page_number>&limit=<limit_value>
 * @access Private (Adjust access control as needed, e.g., Admin only)
 * @query  status (required), page (optional, default 1), limit (optional, default 10)
 */
const getPaymentsByStatus = async (req, res) => {
    const { status } = req.query;
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page
    const skip = (page - 1) * limit;

    // --- Validate Status ---
    if (!status) {
        return res.status(400).json({ message: 'Status query parameter is required.' });
    }

    // Get allowed enum values from the schema
    const allowedStatuses = Payment.schema.path('status').enumValues;
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            message: `Invalid status value. Allowed values are: ${allowedStatuses.join(', ')}`
        });
    }

    // --- Query Database ---
    try {
        // Find payments matching the status with pagination
        const payments = await Payment.find({ status: status })
            .sort({ createdAt: -1 }) // Sort by creation date, newest first (optional)
            .skip(skip)
            .limit(limit)
            .populate('userId', 'email username firstName lastName') // Example: Populate user email/name
            .populate('planId', 'name slug') // Example: Populate plan name/slug
            .exec(); // Execute the query

        // Get total count for pagination metadata
        const totalPayments = await Payment.countDocuments({ status: status });

        // --- Send Response ---
        res.status(200).json({
            message: `Successfully retrieved payments with status: ${status}`,
            data: payments,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPayments / limit),
                totalItems: totalPayments,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching payments.' });
    }
};


module.exports = {
    addPlan,
    updatePlan,
    deletePlan,
    changePlan,
    getSubscriptionDetails,
    getAllPlans,
    createPaymentRecord,
    getPaymentsByStatus
};