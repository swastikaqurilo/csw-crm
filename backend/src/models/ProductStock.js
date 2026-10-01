const mongoose = require("mongoose");

const movementEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["in", "out", "adjustment", "scrap", "production"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    unitAtTime: { type: String, required: true },
    beforeQty: { type: Number, required: true },
    afterQty: { type: Number, required: true },
    reason: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 500 },
    refType: {
      type: String,
      enum: ["Manual", "Production", "Dispatch", "Scrap"],
      default: "Manual",
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refLabel: { type: String, trim: true, maxlength: 60, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productStockSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      enum: ["2kg", "5kg", "8kg", "10kg"],
      required: true,
      unique: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },
    unit: {
      type: String,
      default: "Reel",
      immutable: true,
    },

    quantity: { type: Number, default: 0, min: 0 },
    reservedQty: { type: Number, default: 0, min: 0 },
    scrapQty: { type: Number, default: 0, min: 0 },

    reorderLevel: { type: Number, default: 0, min: 0 },
    criticalLevel: { type: Number, default: 0, min: 0 },

    lastReceivedAt: { type: Date, default: null },
    lastIssuedAt: { type: Date, default: null },
    lastScrapAt: { type: Date, default: null },

    movementLog: { type: [movementEntrySchema], default: [] },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

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