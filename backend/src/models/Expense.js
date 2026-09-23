const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "Employee",
        "Factory People",
        "Factory Expense",
        "Miscellaneous",
      ],
      required: true,
    },

    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "UPI", null],
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    transactionId: {
      type: String,
      trim: true,
      default: null,
    },

    // Employee / Factory People
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      default: null,
    },

    // Factory Expense
    expenseType: {
      type: String,
      trim: true,
    },

    vendor: {
      type: String,
      trim: true,
    },

    invoiceNumber: {
      type: String,
      trim: true,
    },

    // Miscellaneous
    expenseName: {
      type: String,
      trim: true,
    },

    expenseCategory: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Expense", expenseSchema);