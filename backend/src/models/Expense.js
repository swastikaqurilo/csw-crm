const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: ["Factory Expense", "Miscellaneous"],
        message: "{VALUE} is not a valid expense type",
      },
      required: [true, "Expense type is required"],
    },

    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
      max: [100000000, "Amount is too large"],
    },

    paymentStatus: {
      type: String,
      enum: {
        values: ["Pending", "Paid"],
        message: "{VALUE} is not a valid payment status",
      },
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      enum: {
        values: ["Cash", "UPI", "Bank Transfer", "Cheque", "NEFT", "RTGS", null],
        message: "{VALUE} is not a valid payment method",
      },
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    transactionId: {
      type: String,
      trim: true,
      maxlength: [100, "Transaction ID too long"],
      default: null,
    },

    // Factory Expense specific
    expenseType: {
      type: String,
      trim: true,
      maxlength: [100, "Expense type too long"],
      default: null,
    },

    vendor: {
      type: String,
      trim: true,
      maxlength: [150, "Vendor name too long"],
      default: null,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      maxlength: [50, "Invoice number too long"],
      default: null,
    },

    // Miscellaneous specific
    expenseName: {
      type: String,
      trim: true,
      maxlength: [150, "Expense name too long"],
      default: null,
    },

    expenseCategory: {
      type: String,
      trim: true,
      maxlength: [100, "Category too long"],
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description too long"],
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes too long"],
      default: "",
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Expense", expenseSchema);