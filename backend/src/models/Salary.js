const mongoose = require("mongoose");

const salaryPaymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 1000000000,
    },

    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    paymentMode: {
      type: String,
      enum: [
        "Cash",
        "UPI",
        "Bank Transfer",
        "Cheque",
        "NEFT",
        "RTGS",
        "Other",
      ],
      required: true,
    },

    transactionId: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { _id: true }
);

const salaryAdvanceSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: 1000000000,
    },

    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    paymentMode: {
      type: String,
      enum: [
        "Cash",
        "UPI",
        "Bank Transfer",
        "Cheque",
        "NEFT",
        "RTGS",
        "Other",
      ],
      default: "Cash",
    },

    transactionId: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: true }
);

const productionBreakdownSchema = new mongoose.Schema(
  {
    "2kg": {
      quantity: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
    },

    "5kg": {
      quantity: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
    },

    "8kg": {
      quantity: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
    },

    "10kg": {
      quantity: { type: Number, default: 0, min: 0 },
      rate: { type: Number, default: 0, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
    },
  },
  { _id: false }
);

const salarySchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
    },

    payType: {
      type: String,
      enum: ["Fixed", "Variable"],
      required: true,
    },

    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    basicSalary: {
      type: Number,
      required: true,
      min: 0,
      max: 1000000000,
    },

    allowances: {
      type: Number,
      min: 0,
      default: 0,
    },

    deductions: {
      type: Number,
      min: 0,
      default: 0,
    },

    attendance: {
      workingDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      presentDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      absentDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      dailyRate: {
        type: Number,
        default: 0,
        min: 0,
      },

      absenceDeduction: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    production: {
      "2kg": {
        quantity: { type: Number, default: 0, min: 0 },
        rate: { type: Number, default: 0, min: 0 },
        amount: { type: Number, default: 0, min: 0 },
      },

      "5kg": {
        quantity: { type: Number, default: 0, min: 0 },
        rate: { type: Number, default: 0, min: 0 },
        amount: { type: Number, default: 0, min: 0 },
      },

      "8kg": {
        quantity: { type: Number, default: 0, min: 0 },
        rate: { type: Number, default: 0, min: 0 },
        amount: { type: Number, default: 0, min: 0 },
      },

      "10kg": {
        quantity: { type: Number, default: 0, min: 0 },
        rate: { type: Number, default: 0, min: 0 },
        amount: { type: Number, default: 0, min: 0 },
      },

      totalReels: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalEarnings: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    advanceAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    advances: {
      type: [salaryAdvanceSchema],
      default: [],
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Partial", "Paid"],
      default: "Pending",
    },

    lastPaymentDate: {
      type: Date,
      default: null,
    },

    payments: {
      type: [salaryPaymentSchema],
      default: [],
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

salarySchema.index(
  { worker: 1, periodStart: 1, periodEnd: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

module.exports = mongoose.model("Salary", salarySchema);