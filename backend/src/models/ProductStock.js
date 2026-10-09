const mongoose = require("mongoose");

const REEL_SIZES = ["2kg", "5kg", "8kg", "10kg"];

const movementEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["in", "out", "adjustment", "scrap", "production"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [0, "Movement quantity cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Movement quantity must be a finite number",
      },
    },

    unitAtTime: {
      type: String,
      required: true,
      trim: true,
    },

    beforeQty: {
      type: Number,
      required: true,
      min: [0, "Previous quantity cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Previous quantity must be a finite number",
      },
    },

    afterQty: {
      type: Number,
      required: true,
      min: [0, "Updated quantity cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Updated quantity must be a finite number",
      },
    },

    reason: {
      type: String,
      trim: true,
      maxlength: [200, "Reason cannot exceed 200 characters"],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },

    refType: {
      type: String,
      enum: ["Manual", "Production", "Dispatch", "Scrap"],
      default: "Manual",
    },

    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    refLabel: {
      type: String,
      trim: true,
      maxlength: [60, "Reference label cannot exceed 60 characters"],
      default: null,
    },

    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const productStockSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      enum: REEL_SIZES,
      required: [true, "Reel size is required"],
      unique: true,
      immutable: true,
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
      immutable: true,
    },

    unit: {
      type: String,
      default: "Reel",
      trim: true,
      immutable: true,
    },

    quantity: {
      type: Number,
      default: 0,
      min: [0, "Stock quantity cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Stock quantity must be a finite number",
      },
    },

    reservedQty: {
      type: Number,
      default: 0,
      min: [0, "Reserved quantity cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Reserved quantity must be a finite number",
      },
    },

    scrapQty: {
      type: Number,
      default: 0,
      min: [0, "Scrap quantity cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Scrap quantity must be a finite number",
      },
    },

    reorderLevel: {
      type: Number,
      default: 0,
      min: [0, "Reorder level cannot be negative"],
    },

    criticalLevel: {
      type: Number,
      default: 0,
      min: [0, "Critical level cannot be negative"],
    },

    lastReceivedAt: {
      type: Date,
      default: null,
    },

    lastIssuedAt: {
      type: Date,
      default: null,
    },

    lastScrapAt: {
      type: Date,
      default: null,
    },

    movementLog: {
      type: [movementEntrySchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Document-level stock reservation validation.
productStockSchema.pre("validate", function () {
  if (this.reservedQty > this.quantity) {
    this.invalidate(
      "reservedQty",
      "Reserved quantity cannot exceed total stock quantity"
    );
  }
});

// Available stock after reservations.
productStockSchema.virtual("freeQty").get(function () {
  return Math.max(
    Number(this.quantity || 0) - Number(this.reservedQty || 0),
    0
  );
});

productStockSchema.set("toJSON", { virtuals: true });
productStockSchema.set("toObject", { virtuals: true });

productStockSchema.index({ isActive: 1 });

const ProductStock = mongoose.model("ProductStock", productStockSchema);

module.exports = ProductStock;
module.exports.REEL_SIZES = REEL_SIZES;

