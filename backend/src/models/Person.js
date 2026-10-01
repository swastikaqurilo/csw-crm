const mongoose = require("mongoose");

const personSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [150, "Name too long"],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone too long"],
      match: [/^[0-9+\-\s()]*$/, "Phone contains invalid characters"],
      default: "",
    },

    type: {
      type: String,
      enum: {
        values: ["Employee", "Factory People"],
        message: "{VALUE} is not a valid type",
      },
      required: [true, "Type is required"],
    },

    role: {
      type: String,
      trim: true,
      maxlength: [100, "Role too long"],
      default: "",
    },

    joiningDate: {
      type: Date,
      required: [true, "Joining date is required"],
    },

    salary: {
      type: Number,
      min: [0, "Salary cannot be negative"],
      max: [1000000000, "Salary too large"],
      default: null,
    },

    dailyWage: {
      type: Number,
      min: [0, "Daily wage cannot be negative"],
      max: [10000000, "Daily wage too large"],
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ["Active", "Inactive"],
        message: "{VALUE} is not a valid status",
      },
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Person", personSchema);