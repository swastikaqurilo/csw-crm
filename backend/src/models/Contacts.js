const mongoose = require("mongoose");
const { Schema } = mongoose;

const contactSchema = new Schema(
  {
    contactId: {
      type: String,
      unique: true,
      index: true,
      trim: true,
      maxlength: 50,
    },

    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: [150, "Name too long"],
    },

    company: {
      type: String,
      required: [true, "Company is required"],
      trim: true,
      maxlength: [200, "Company name too long"],
    },

    role: {
      type: String,
      trim: true,
      maxlength: [100, "Role too long"],
      default: "",
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [200, "Email too long"],
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone too long"],
      match: [/^[0-9+\-\s()]*$/, "Phone contains invalid characters"],
      default: "",
    },

    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address too long"],
      default: "",
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [15, "GSTIN must be 15 characters"],
      match: [/^[0-9A-Z]{15}$|^$/, "Invalid GSTIN format"],
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
      type: mongoose.Schema.Types.ObjectId,
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
  },
  { timestamps: true }
);

contactSchema.pre("save", async function () {
  if (this.contactId) return;

  const Contact = this.constructor;

  const lastContact = await Contact.findOne(
    {
      contactId: /^CON-\d+$/,
    },
    { contactId: 1 }
  ).sort({ contactId: -1 });

  let nextNumber = 1;

  if (lastContact?.contactId) {
    const lastNumber = parseInt(
      lastContact.contactId.replace("CON-", ""),
      10
    );

    if (!Number.isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  this.contactId = `CON-${String(nextNumber).padStart(3, "0")}`;
});

contactSchema.index({
  name: "text",
  company: "text",
  email: "text",
});

module.exports = mongoose.model("Contact", contactSchema);