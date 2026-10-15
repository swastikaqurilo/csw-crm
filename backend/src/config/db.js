
const mongoose = require("mongoose");

let connectionPromise = null;

const connectDB = async () => {
  // Reuse an established connection.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Reuse a connection attempt already in progress.
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not configured");
  }

  console.log("Connecting to MongoDB...");

  connectionPromise = mongoose
    .connect(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
    })
    .then(() => {
      console.log("MongoDB connected successfully");
      return mongoose.connection;
    })
    .catch((error) => {
      // Allow a later request to retry after a failed connection.
      connectionPromise = null;
      console.error("MongoDB connection failed:", error.message);
      throw error;
    });

  return connectionPromise;
};

module.exports = connectDB;