const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    productCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    material: {
      type: String,
      default: "Steel",
      trim: true,
    },

    diameter: {
      type: Number,
      default: null,
    },

    diameterUnit: {
      type: String,
      enum: ["mm", "inch"],
      default: "mm",
    },

    unit: {
      type: String,
      enum: ["Kg", "Ton", "Meter", "Piece", "Coil"],
      default: "Kg",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
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

module.exports = mongoose.model("Product", productSchema);