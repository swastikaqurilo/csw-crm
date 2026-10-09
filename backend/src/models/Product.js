const mongoose = require("mongoose");

const SIZES = ["2kg", "5kg", "8kg", "10kg"];

const REEL_WEIGHTS = {
  "2kg": 2,
  "5kg": 5,
  "8kg": 8,
  "10kg": 10,
};

const workerProductionSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
    },

    production: {
      "2kg": { type: Number, default: 0, min: 0 },
      "5kg": { type: Number, default: 0, min: 0 },
      "8kg": { type: Number, default: 0, min: 0 },
      "10kg": { type: Number, default: 0, min: 0 },
    },

    totalReels: {
      type: Number,
      default: 0,
      min: 0,
    },

    grossKg: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* ▼ NEW — snapshot of what this worker earned on this day */
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: true,
  }
);

const productProductionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Date is required"],
      unique: true,
      index: true,
    },

    qty2kg: { type: Number, default: 0, min: 0 },
    qty5kg: { type: Number, default: 0, min: 0 },
    qty8kg: { type: Number, default: 0, min: 0 },
    qty10kg: { type: Number, default: 0, min: 0 },

    workers: {
      type: [workerProductionSchema],
      default: [],
    },

    tapeUsedBox: { type: Number, default: 0, min: 0 },
    scrapKg: { type: Number, default: 0, min: 0 },

    consumed: {
      steel: {
        rawStock: { type: mongoose.Schema.Types.ObjectId, ref: "RawStock" },
        name: String,
        quantity: Number,
        reservedUsed: { type: Number, default: 0 },
        unit: String,
      },

      reels: [
        {
          rawStock: { type: mongoose.Schema.Types.ObjectId, ref: "RawStock" },
          name: String,
          size: String,
          spoolKg: Number,
          quantity: Number,
          reservedUsed: { type: Number, default: 0 },
          unit: String,
        },
      ],

      deductedAt: Date,
    },

    notes: { type: String, trim: true, maxlength: 1000 },

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

productProductionSchema.pre("validate", function () {
  if (this.date) {
    const d = new Date(this.date);
    d.setHours(0, 0, 0, 0);
    this.date = d;
  }
});

productProductionSchema.virtual("totalReels").get(function () {
  return (
    Number(this.qty2kg || 0) +
    Number(this.qty5kg || 0) +
    Number(this.qty8kg || 0) +
    Number(this.qty10kg || 0)
  );
});

productProductionSchema.virtual("totalKg").get(function () {
  return (
    Number(this.qty2kg || 0) * 2 +
    Number(this.qty5kg || 0) * 5 +
    Number(this.qty8kg || 0) * 8 +
    Number(this.qty10kg || 0) * 10
  );
});

productProductionSchema.set("toJSON", { virtuals: true });
productProductionSchema.set("toObject", { virtuals: true });

const ProductProduction = mongoose.model(
  "ProductProduction",
  productProductionSchema
);

module.exports = ProductProduction;
module.exports.SIZES = SIZES;
module.exports.REEL_WEIGHTS = REEL_WEIGHTS;