
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getNextSequence } = require("./Counter");

const contactSchema = new Schema(
  {
    contactId: {
      type: String,
      unique: true,
      trim: true,
      maxlength: 50,
    },

    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: [150, "Name too long"],
    },

    company: {
      type: String,
      trim: true,
      maxlength: [200, "Company name too long"],
      default: "",
    },

    role: {
      type: String,
      trim: true,
      lowercase: true,
      enum: {
        values: ["customer", "supplier", "partner", "other", ""],
        message: "{VALUE} is not a valid role",
      },
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [200, "Email too long"],
      match: [
        /^\S+@\S+\.\S+$|^$/,
        "Please provide a valid email",
      ],
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone too long"],
      match: [
        /^[6-9]\d{9}$|^$/,
        "Enter a valid 10-digit Indian mobile number",
      ],
      default: "",
    },

    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address too long"],
      default: "",
    },

    billingAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Billing address too long"],
      default: "",
    },

    shippingAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Shipping address too long"],
      default: "",
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [15, "GSTIN must be 15 characters"],
      match: [
        /^[0-9A-Z]{15}$|^$/,
        "Invalid GSTIN format",
      ],
      default: "",
    },

    state: {
      type: String,
      trim: true,
      maxlength: [100, "State name too long"],
      default: "",
    },

    stateCode: {
      type: String,
      trim: true,
      maxlength: [5, "State code too long"],
      default: "",
    },

    enquiry: {
      type: Schema.Types.ObjectId,
      ref: "Enquiry",
      default: null,
    },

    enquiries: {
      type: Number,
      default: 0,
      min: [0, "Enquiries cannot be negative"],
      max: [100000, "Enquiries count too large"],
    },

    lastContact: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: {
        values: ["active", "inactive"],
        message: "{VALUE} is not a valid status",
      },
      default: "active",
    },

    shippingName: {
      type: String,
      trim: true,
      maxlength: [150, "Name too long"],
      default: "",
    },

    shippingCompany: {
      type: String,
      trim: true,
      maxlength: [200, "Company name too long"],
      default: "",
    },

    shippingGstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [15, "GSTIN must be 15 characters"],
      match: [
        /^[0-9A-Z]{15}$|^$/,
        "Invalid GSTIN format",
      ],
      default: "",
    },

    shippingState: {
      type: String,
      trim: true,
      maxlength: [100, "State name too long"],
      default: "",
    },

    shippingStateCode: {
      type: String,
      trim: true,
      maxlength: [5, "State code too long"],
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

contactSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.contactId) {
      const seq = await getNextSequence("contact");
      this.contactId = `CON-${String(seq).padStart(3, "0")}`;
    }

    return;
  }

  if (this.isModified()) {
    this.version = (this.version || 1) + 1;
  }
});

contactSchema.index({
  name: "text",
  company: "text",
  email: "text",
});

contactSchema.index(
  { updatedAt: 1, _id: 1 },
  { name: "contacts_sync_cursor" }
);

contactSchema.index(
  { deletedAt: 1, updatedAt: 1 },
  { name: "contacts_deleted_sync" }
);

module.exports = mongoose.model("Contact", contactSchema);
