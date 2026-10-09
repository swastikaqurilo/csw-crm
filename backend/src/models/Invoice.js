const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    description: {
      type: String,
      trim: true,
      required: true,
    },

    hsnSac: {
      type: String,
      trim: true,
      default: "",
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    rate: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      default: "kg",
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },

    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    eWayBillNumber: {
      type: String,
      trim: true,
      default: "",
    },

    seller: {
      name: {
        type: String,
        default: "",
      },

      address: {
        type: String,
        default: "",
      },

      gstin: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      stateCode: {
        type: String,
        default: "",
      },

      pan: {
        type: String,
        trim: true,
        uppercase: true,
        default: "",
      },

      cin: {
        type: String,
        trim: true,
        uppercase: true,
        default: "",
      },

      msme: {
        type: String,
        trim: true,
        default: "",
      },

      phone: {
        type: String,
        trim: true,
        default: "",
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },

      logoUrl: {
        type: String,
        trim: true,
        default: "",
      },

      signatureUrl: {
        type: String,
        trim: true,
        default: "",
      },
    },

    bank: {
      accountName: {
        type: String,
        trim: true,
        default: "",
      },

      accountNumber: {
        type: String,
        trim: true,
        default: "",
      },

      bankName: {
        type: String,
        trim: true,
        default: "",
      },

      ifsc: {
        type: String,
        trim: true,
        uppercase: true,
        default: "",
      },

      branch: {
        type: String,
        trim: true,
        default: "",
      },

      upiId: {
        type: String,
        trim: true,
        default: "",
      },
    },

    buyer: {
      name: {
        type: String,
        default: "",
      },

      company: {
        type: String,
        default: "",
      },

      address: {
        type: String,
        default: "",
      },

      gstin: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      stateCode: {
        type: String,
        default: "",
      },

      phone: {
        type: String,
        default: "",
      },

      email: {
        type: String,
        default: "",
      },
    },

    consignee: {
      name: {
        type: String,
        default: "",
      },

      company: {
        type: String,
        default: "",
      },

      address: {
        type: String,
        default: "",
      },

      gstin: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      stateCode: {
        type: String,
        default: "",
      },
    },

    items: {
      type: [invoiceItemSchema],
      required: true,
    },

    subTotal: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    taxableAmount: {
      type: Number,
      default: 0,
    },

    taxType: {
      type: String,
      enum: ["IGST", "CGST_SGST"],
      default: "IGST",
    },

    taxPercent: {
      type: Number,
      default: 0,
    },

    igstPercent: {
      type: Number,
      default: 0,
    },

    igstAmount: {
      type: Number,
      default: 0,
    },

    cgstPercent: {
      type: Number,
      default: 0,
    },

    cgstAmount: {
      type: Number,
      default: 0,
    },

    sgstPercent: {
      type: Number,
      default: 0,
    },

    sgstAmount: {
      type: Number,
      default: 0,
    },

    totalTax: {
      type: Number,
      default: 0,
    },

    roundOff: {
      type: Number,
      default: 0,
    },

    grandTotal: {
      type: Number,
      default: 0,
    },

    amountInWords: {
      type: String,
      default: "",
    },

    taxAmountInWords: {
      type: String,
      default: "",
    },

    reference: {
      type: String,
      default: "",
    },

    declaration: {
      type: String,
      default:
        "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    },

    termsAndConditions: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    footerNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    authorisedSignatory: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ "buyer.gstin": 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);