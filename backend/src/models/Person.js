const mongoose = require("mongoose");

const personSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: ["Employee", "Factory People"],
      required: true,
    },

    role: {
      type: String,
      trim: true,
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    // Used only for regular employees
    salary: {
      type: Number,
      min: 0,
      default: null,
    },

    // Used only for factory people
    // This is the amount paid per working day
    dailyWage: {
      type: Number,
      min: 0,
      default: null,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Person", personSchema);