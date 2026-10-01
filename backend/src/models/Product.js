const mongoose = require("mongoose");

const SIZES = ["2kg", "5kg", "8kg", "10kg"];

const productProductionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Date is required"],
      unique: true,
      index: true,
    },

    /* Reel counts produced that day */
    qty2kg:  { type: Number, default: 0, min: 0 },
    qty5kg:  { type: Number, default: 0, min: 0 },
    qty8kg:  { type: Number, default: 0, min: 0 },
    qty10kg: { type: Number, default: 0, min: 0 },

    /* Rate per reel for each size (₹) */
    rate2kg:  { type: Number, default: 0, min: 0 },
    rate5kg:  { type: Number, default: 0, min: 0 },
    rate8kg:  { type: Number, default: 0, min: 0 },
    rate10kg: { type: Number, default: 0, min: 0 },

    tapeUsedBox: { type: Number, default: 0, min: 0 },
    scrapKg:    { type: Number, default: 0, min: 0 },

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
  { timestamps: true }
);

// Normalize the date to start-of-day so uniqueness works per calendar day
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

productProductionSchema.virtual("totalValue").get(function () {
  return (
    Number(this.qty2kg || 0) * Number(this.rate2kg || 0) +
    Number(this.qty5kg || 0) * Number(this.rate5kg || 0) +
    Number(this.qty8kg || 0) * Number(this.rate8kg || 0) +
    Number(this.qty10kg || 0) * Number(this.rate10kg || 0)
  );
});

productProductionSchema.set("toJSON", { virtuals: true });
productProductionSchema.set("toObject", { virtuals: true });

const ProductProduction = mongoose.model("ProductProduction", productProductionSchema);
module.exports = ProductProduction;
module.exports.SIZES = SIZES;