const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: [
          "Employee",
          "Factory People",
          "Factory Expense",
          "Miscellaneous",
        ],
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
      max: [100000000, "Amount is too large"], // 10 Cr cap
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
        values: ["Cash", "UPI", null],
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

    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      default: null,
    },

    expenseType: {
      type: String,
      trim: true,
      maxlength: [100, "Expense type too long"],
    },

    vendor: {
      type: String,
      trim: true,
      maxlength: [150, "Vendor name too long"],
    },

    invoiceNumber: {
      type: String,
      trim: true,
      maxlength: [50, "Invoice number too long"],
    },

    expenseName: {
      type: String,
      trim: true,
      maxlength: [150, "Expense name too long"],
    },

    expenseCategory: {
      type: String,
      trim: true,
      maxlength: [100, "Category too long"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description too long"],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes too long"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Expense", expenseSchema);