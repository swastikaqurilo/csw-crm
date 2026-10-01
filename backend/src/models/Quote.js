const mongoose = require("mongoose");

const quoteItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, "Item description is required"],
      trim: true,
      maxlength: [500, "Description too long"],
    },
    gauge: {
      type: String,
      trim: true,
      maxlength: [50, "Gauge too long"],
      default: "",
    },
    qty: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      max: [1000000, "Quantity too large"],
    },
    unit: {
      type: String,
      enum: {
        values: ["kg", "MT", "Bundle", "Coil", "Roll", "Nos"],
        message: "{VALUE} is not a valid unit",
      },
      default: "kg",
    },
    rate: {
      type: Number,
      required: [true, "Rate is required"],
      min: [0, "Rate cannot be negative"],
      max: [10000000, "Rate too large"],
    },
    discountPct: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    lineTotal: {
      type: Number,
      required: true,
      min: [0, "Line total cannot be negative"],
    },
  },
  { _id: false }
);

const termsSchema = new mongoose.Schema(
  {
    payment: { type: String, default: "", maxlength: 500 },
    delivery: { type: String, default: "", maxlength: 500 },
    freight: { type: String, default: "", maxlength: 500 },
    validity: { type: String, default: "", maxlength: 500 },
    notes: { type: String, default: "", maxlength: 1000 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 100,
    },

    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
      required: true,
      index: true,
    },
    enquiryNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [200, "Customer name too long"],
    },
    company: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 15,
      match: [/^[0-9A-Z]{15}$|^$/, "Invalid GSTIN format"],
      default: "",
    },
    billingAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Billing address too long"],
      default: "",
    },

    quoteDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validTill: {
      type: Date,
      required: [true, "Valid-till date is required"],
    },

    items: {
      type: [quoteItemSchema],
      validate: [
        {
          validator: (items) => Array.isArray(items) && items.length > 0,
          message: "A quotation needs at least one item.",
        },
        {
          validator: (items) => !Array.isArray(items) || items.length <= 50,
          message: "A quotation cannot have more than 50 items.",
        },
      ],
    },

    subtotal: { type: Number, required: true, min: 0, max: 1e12 },
    discountTotal: { type: Number, required: true, min: 0, max: 1e12, default: 0 },
    taxableAmount: { type: Number, required: true, min: 0, max: 1e12 },
    cgst: { type: Number, required: true, min: 0, max: 1e12 },
    sgst: { type: Number, required: true, min: 0, max: 1e12 },
    roundOff: { type: Number, required: true, default: 0 },
    grandTotal: { type: Number, required: true, min: 0, max: 1e12 },
    amountInWords: { type: String, default: "", maxlength: 500 },

    terms: { type: termsSchema, default: () => ({}) },

    status: {
      type: String,
      enum: {
        values: ["Draft", "Sent", "Accepted", "Rejected", "Expired"],
        message: "{VALUE} is not a valid status",
      },
      default: "Draft",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

quotationSchema.index({ enquiry: 1, createdAt: -1 });

module.exports = mongoose.model("Quotation", quotationSchema);