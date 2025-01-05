import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const p = await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
        console.log(`MongoDB is connected to ${p.connection.host}`);
    } catch (error) {
        console.error("Error occurred during database connection:", error); // Changed 'console.log' to 'console.error' for better error logging
        process.exit(1);
    }
};

export { connectDB };
