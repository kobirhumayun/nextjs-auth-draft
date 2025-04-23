
/**
 * Sends an email. To be replace with actual email sending implementation.
 * @param {object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - Optional HTML body
 */
const sendEmail = async ({ to, subject, text, html }) => {
    console.log("--- Sending Email ---");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text}`);
    if (html) {
        console.log(`HTML: ${html}`);
    }
    console.log("--- Email Service Placeholder ---");
    // --- TODO: Replace this with actual email sending code ---
    // Example using Nodemailer:
    // const transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
    // --- End of TODO ---

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay

    // Simulate success for now
    return true;
};

module.exports = {
    sendEmail,
};