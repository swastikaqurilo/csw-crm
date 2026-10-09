const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
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
      match: [
        /^[0-9+\-\s()]*$/,
        "Phone contains invalid characters",
      ],
      default: "",
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

    status: {
      type: String,
      enum: {
        values: ["Active", "Inactive"],
        message: "{VALUE} is not a valid status",
      },
      default: "Active",
    },

    payType: {
      type: String,
      enum: {
        values: ["Fixed", "Variable"],
        message: "{VALUE} is not a valid pay type",
      },
      required: [true, "Pay type is required"],
      default: "Fixed",
    },

    fixedPay: {
      amount: {
        type: Number,
        min: [0, "Fixed pay cannot be negative"],
        max: [1000000000, "Fixed pay too large"],
        default: null,
      },

      cycle: {
        type: String,
        enum: {
          values: ["Daily", "Weekly", "Monthly"],
          message: "{VALUE} is not a valid payment cycle",
        },
        default: "Monthly",
      },
    },
    
    variablePay: {
      rate2kg: {
        type: Number,
        min: [2, "2 KG rate cannot be less than ₹2"],
        max: [3, "2 KG rate cannot be more than ₹3"],
        default: null,
      },

      rate5kg: {
        type: Number,
        min: [2, "5 KG rate cannot be less than ₹2"],
        max: [3, "5 KG rate cannot be more than ₹3"],
        default: null,
      },

      rate8kg: {
        type: Number,
        min: [2, "8 KG rate cannot be less than ₹2"],
        max: [3, "8 KG rate cannot be more than ₹3"],
        default: null,
      },

      rate10kg: {
        type: Number,
        min: [2, "10 KG rate cannot be less than ₹2"],
        max: [3, "10 KG rate cannot be more than ₹3"],
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);


const attendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: [true, "Date is required"],
      unique: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"],
    },

    allPresent: {
      type: Boolean,
      default: true,
    },

    absentWorkers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
      },
    ],

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const Worker = mongoose.model("Worker", workerSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = { Worker, Attendance };