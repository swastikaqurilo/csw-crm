const mongoose = require("mongoose");

const movementEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["in", "out", "adjustment", "purchase-received"],
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
        enum: ["Manual", "Purchase", "Production"],   
        default: "Manual",
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refLabel: { type: String, trim: true, maxlength: 60, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const rawStockSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["Steel", "Tape", "Reel"],
      required: [true, "Category is required"],
      immutable: true,
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      unique: true,
      trim: true,
      maxlength: [80, "Name too long"],
      immutable: true,
    },

    // Only meaningful for Reel category. The empty spool's weight class.
    sizeKg: {
      type: Number,
      default: null,
      min: [0, "Size cannot be negative"],
      max: [1000, "Size too large"],
      immutable: true,
    },

    unit: {
      type: String,
      enum: ["Kg", "Box", "Piece"],
      required: [true, "Unit is required"],
      immutable: true,
    },

    quantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity cannot be negative"],
      max: [100000000, "Quantity too large"],
    },

    reorderLevel: { type: Number, default: 0, min: 0 },
    criticalLevel: { type: Number, default: 0, min: 0 },

    reservedQty: {
      type: Number,
      default: 0,
      min: [0, "Reserved quantity cannot be negative"],
    },

    lastReceivedAt: { type: Date, default: null },
    lastIssuedAt: { type: Date, default: null },

    warehouse: {
      type: String,
      default: "Main",
      trim: true,
      maxlength: [100, "Warehouse name too long"],
    },

    notes: { type: String, trim: true, maxlength: 5000 },
    movementLog: { type: [movementEntrySchema], default: [] },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

rawStockSchema.pre("validate", function () {
  if (this.category === "Reel") {
    if (this.sizeKg == null || this.sizeKg <= 0) {
      this.invalidate("sizeKg", "Size is required for Reel category");
    }
  } else {
    this.sizeKg = null;
  }

  if (Number(this.criticalLevel) > Number(this.reorderLevel)) {
    this.invalidate(
      "criticalLevel",
      "Critical level cannot be greater than reorder level"
    );
  }
});

rawStockSchema.pre("save", function () {
  if (!this.isNew) {
    const guarded = ["category", "name", "sizeKg", "unit"];
    for (const field of guarded) {
      if (this.isModified(field)) {
        throw new Error(`"${field}" cannot be changed after creation.`);
      }
    }
  }
});

rawStockSchema.virtual("freeQty").get(function () {
  return Math.max(
    Number(this.quantity || 0) - Number(this.reservedQty || 0),
    0
  );
});

rawStockSchema.virtual("isLowStock").get(function () {
  return this.reorderLevel > 0 && this.freeQty <= this.reorderLevel;
});

rawStockSchema.virtual("isCritical").get(function () {
  return this.criticalLevel > 0 && this.freeQty <= this.criticalLevel;
});

rawStockSchema.virtual("displayName").get(function () {
  if (this.category === "Reel" && this.sizeKg) {
    return `${this.name} (${this.sizeKg}kg)`;
  }
  return this.name;
});

rawStockSchema.set("toJSON", { virtuals: true });
rawStockSchema.set("toObject", { virtuals: true });

rawStockSchema.index({ category: 1, isActive: 1 });
rawStockSchema.index({ category: 1, sizeKg: 1 });

const rawPurchaseSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawStock",
      required: [true, "Material is required"],
      index: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
      index: true,
    },

    supplierName: {
      type: String,
      trim: true,
      maxlength: [100, "Supplier name too long"],
      default: null,
    },
    
    supplierPhone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number too long"],
      default: null,
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.001, "Quantity must be greater than 0"],
      max: [100000000, "Quantity too large"],
    },

    unit: { type: String, required: true },

    unitPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },

    orderedAt: { type: Date, default: Date.now, index: true },
    expectedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["Pending", "Received", "Cancelled"],
      default: "Pending",
      index: true,
    },

    notes: { type: String, trim: true, maxlength: 1000 },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

rawPurchaseSchema.index({ status: 1, orderedAt: -1 });

const RawStock = mongoose.model("RawStock", rawStockSchema);
const RawPurchase = mongoose.model("RawPurchase", rawPurchaseSchema);

module.exports = { RawStock, RawPurchase };