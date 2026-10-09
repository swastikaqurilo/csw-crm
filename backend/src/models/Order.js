const mongoose = require("mongoose");

const REEL_SIZES = ["2kg", "5kg", "8kg", "10kg"];

const orderItemSchema = new mongoose.Schema({
  productStock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductStock",
    required: [true, "Product stock is required"],
  },

  productName: {
    type: String,
    trim: true,
    maxlength: [100, "Product name too long"],
  },

  size: {
    type: String,
    enum: {
      values: REEL_SIZES,
      message: "{VALUE} is not a valid reel size",
    },
    required: [true, "Reel size is required"],
  },

  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [0.01, "Quantity must be greater than 0"],
    max: [1000000, "Quantity too large"],
  },

  reservedQtyUsed: {
    type: Number,
    default: 0,
    min: [0, "Reserved quantity used cannot be negative"],
    validate: {
      validator: function (value) {
        return value <= this.quantity;
      },
      message: "Reserved quantity used cannot exceed ordered quantity",
    },
  },

  unit: {
    type: String,
    enum: {
      values: ["Ton", "Kg", "Box", "Piece", "Coil", "Meter", "Reel"],
      message: "{VALUE} is not a valid unit",
    },
    required: [true, "Unit is required"],
    default: "Reel",
  },

  rate: {
    type: Number,
    required: [true, "Rate is required"],
    min: [0, "Rate cannot be negative"],
    max: [100000000, "Rate too large"],
  },

  discount: {
    type: Number,
    default: 0,
    min: [0, "Discount cannot be negative"],
    max: [100000000, "Discount too large"],
  },

  amount: {
    type: Number,
    required: [true, "Amount is required"],
    min: [0, "Amount cannot be negative"],
    max: [1e12, "Amount too large"],
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: [true, "Order number is required"],
      trim: true,
      maxlength: [50, "Order number too long"],
    },

    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
      default: null,
    },

    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: [true, "Contact is required"],
    },

    // Snapshot fields preserve customer details if the contact changes.
    customerName: {
      type: String,
      trim: true,
      maxlength: [150, "Customer name too long"],
      default: "",
    },

    customerPhone: {
      type: String,
      trim: true,
      maxlength: [30, "Customer phone too long"],
      default: "",
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        {
          validator: (items) =>
            Array.isArray(items) && items.length > 0,
          message: "Order must contain at least one item",
        },
        {
          validator: (items) =>
            Array.isArray(items) && items.length <= 100,
          message: "Order cannot contain more than 100 items",
        },
      ],
    },

    subTotal: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Subtotal cannot be negative"],
      max: [1e12, "Subtotal too large"],
    },

    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [1e12, "Discount too large"],
    },

    taxPercent: {
      type: Number,
      default: 18,
      min: [0, "Tax percent cannot be negative"],
      max: [100, "Tax percent cannot exceed 100"],
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: [0, "Tax amount cannot be negative"],
      max: [1e12, "Tax amount too large"],
    },

    grandTotal: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Grand total cannot be negative"],
      max: [1e12, "Grand total too large"],
    },

    status: {
      type: String,
      enum: {
        values: [
          "Draft",
          "Confirmed",
          "In Production",
          "Ready for Dispatch",
          "Dispatched",
          "Delivered",
          "Cancelled",
        ],
        message: "{VALUE} is not a valid status",
      },
      default: "Draft",
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },

    expectedDeliveryDate: {
      type: Date,
      default: null,
    },

    paymentDueDate: {
      type: Date,
      default: null,
    },

    dispatchedDate: {
      type: Date,
      default: null,
    },

    deliveredDate: {
      type: Date,
      default: null,
    },

    cancelledDate: {
      type: Date,
      default: null,
    },

    shippingAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Shipping address too long"],
      default: "",
    },

    billingAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Billing address too long"],
      default: "",
    },

    paymentStatus: {
      type: String,
      enum: {
        values: ["Pending", "Partial", "Paid", "Overdue"],
        message: "{VALUE} is not a valid payment status",
      },
      default: "Pending",
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
      max: [1e12, "Amount paid too large"],
    },

    stockStatus: {
      type: String,
      enum: {
        values: ["Pending", "Reserved", "Deducted", "Restored"],
        message: "{VALUE} is not a valid stock status",
      },
      default: "Pending",
    },

    stockReservedAt: {
      type: Date,
      default: null,
    },

    stockDeductedAt: {
      type: Date,
      default: null,
    },

    stockRestoredAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes too long"],
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

orderSchema.pre("validate", function () {
  if (this.amountPaid > this.grandTotal + 0.01) {
    this.invalidate(
      "amountPaid",
      "Amount paid cannot exceed the order grand total."
    );
  }
});

orderSchema.virtual("totalQuantity").get(function () {
  return (this.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

orderSchema.index({ contact: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ isActive: 1, orderDate: -1 });

module.exports = mongoose.model("Order", orderSchema);
module.exports.REEL_SIZES = REEL_SIZES;
