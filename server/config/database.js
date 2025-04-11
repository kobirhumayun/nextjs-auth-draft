const mongoose = require('mongoose');
const dotenv = require('dotenv'); // Ensure dotenv is configured if not done globally early enough

dotenv.config(); // Load environment variables

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        console.error('Error: MONGO_URI is not defined in the environment variables.');
        process.exit(1); // Exit if the connection string is missing
    }

    try {
        // Mongoose 6+ no longer requires useNewUrlParser and useUnifiedTopology
        const conn = await mongoose.connect(mongoUri);

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Optional: Listen for connection events after initial connection
        mongoose.connection.on('error', (err) => {
            console.error(`MongoDB connection error after initial connection: ${err.message}`);
            // Consider more sophisticated error handling or logging here
            // Depending on the error, you might want to attempt reconnection or alert administrators
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected.');
            // You might want to implement reconnection logic here if needed
        });

    } catch (error) {
        // Catch errors specifically during the initial connection attempt
        console.error(`Initial MongoDB Connection Error: ${error.message}`);
        // Exit the process with a failure code
        process.exit(1);
    }
};

module.exports = connectDB;
