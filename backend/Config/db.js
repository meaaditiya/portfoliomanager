const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connection to Database Successful, MongoDB connected!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // stop server if DB fails
  }
};

module.exports = connectDB;
