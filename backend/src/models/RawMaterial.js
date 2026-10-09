const mongoose = require("mongoose");
const { getNextSequence } = require("./Counter");

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
    quantity: { type: Number, default: 0, min: [0, "Quantity cannot be negative"], max: [100000000, "Quantity too large"] },
    reorderLevel: { type: Number, default: 0, min: 0 },
    criticalLevel: { type: Number, default: 0, min: 0 },
    reservedQty: { type: Number, default: 0, min: [0, "Reserved quantity cannot be negative"] },
    lastReceivedAt: { type: Date, default: null },
    lastIssuedAt: { type: Date, default: null },
    warehouse: { type: String, default: "Main", trim: true, maxlength: [100, "Warehouse name too long"] },
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
    this.invalidate("criticalLevel", "Critical level cannot be greater than reorder level");
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
  return Math.max(Number(this.quantity || 0) - Number(this.reservedQty || 0), 0);
});
rawStockSchema.virtual("isLowStock").get(function () {
  return this.reorderLevel > 0 && this.freeQty <= this.reorderLevel;
});
rawStockSchema.virtual("isCritical").get(function () {
  return this.criticalLevel > 0 && this.freeQty <= this.criticalLevel;
});
rawStockSchema.virtual("displayName").get(function () {
  if (this.category === "Reel" && this.sizeKg) return `${this.name} (${this.sizeKg}kg)`;
  return this.name;
});
rawStockSchema.set("toJSON", { virtuals: true });
rawStockSchema.set("toObject", { virtuals: true });
rawStockSchema.index({ category: 1, isActive: 1 });
rawStockSchema.index({ category: 1, sizeKg: 1 });

const purchasePaymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be greater than 0"],
      max: [1e12, "Payment amount too large"],
    },
    paidAt: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ["Bank Transfer", "UPI", "Cheque", "Cash", "NEFT", "RTGS", "Other"],
      default: "Bank Transfer",
    },
    transactionId: { type: String, trim: true, maxlength: 100, default: null },
    chequeNumber: { type: String, trim: true, maxlength: 50, default: null },
    bankName: { type: String, trim: true, maxlength: 150, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true, timestamps: true }
);

const rawPurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 40,
    },

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

    supplierName: { type: String, trim: true, maxlength: 100, default: null },
    supplierPhone: { type: String, trim: true, maxlength: 20, default: null },

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

    /* ---------- NEW: payment tracking ---------- */
    dueDate: { type: Date, default: null, index: true },
    invoiceNumber: { type: String, trim: true, maxlength: 60, default: null },

    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Partial", "Paid", "Overdue"],
      default: "Pending",
      index: true,
    },
    payments: { type: [purchasePaymentSchema], default: [] },
    /* ------------------------------------------- */

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

/* ---------- Auto PO number ---------- */
rawPurchaseSchema.pre("save", async function () {
  if (this.purchaseNumber) return;
  if (this.status === "Pending" && !this.purchaseNumber) {
    // Only assign on first save; skip on subsequent edits
  }
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`purchase-${year}`);
  this.purchaseNumber = `PO-${year}-${String(seq).padStart(4, "0")}`;
});

rawPurchaseSchema.pre("save", function () {
  const total = Number(this.totalAmount || 0);
  const paid = (this.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  this.amountPaid = Number(paid.toFixed(2));

  if (paid <= 0) {
    this.paymentStatus = "Pending";
  } else if (paid + 0.01 < total) {
    this.paymentStatus = "Partial";
  } else {
    this.paymentStatus = "Paid";
  }
});

rawPurchaseSchema.index({ status: 1, orderedAt: -1 });
rawPurchaseSchema.index({ paymentStatus: 1, dueDate: 1 });

const RawStock = mongoose.model("RawStock", rawStockSchema);
const RawPurchase = mongoose.model("RawPurchase", rawPurchaseSchema);

module.exports = { RawStock, RawPurchase };