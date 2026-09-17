const mongoose = require("mongoose");
const { Schema } = mongoose;

const contactSchema = new Schema(
  {
    contactId: {
      type: String,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
    },
    company: {
      type: String,
      required: [true, "Company is required"],
      trim: true,
    },
    role: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please provide a valid email",
        ],
    },
    phone: {
      type: String,
      trim: true,
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
      min: 0,
    },
    lastContact: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

contactSchema.pre("save", async function () {
  if (this.contactId) return;

  const Contact = this.constructor;

  const last = await Contact.findOne(
    {},
    {},
    { sort: { createdAt: -1 } }
  );

  let nextNumber = 1;

  if (last && last.contactId) {
    const lastNumber = parseInt(
      last.contactId.split("-")[1],
      10
    );

    if (!Number.isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  this.contactId = `CON-${String(nextNumber).padStart(3, "0")}`;
});

contactSchema.index({ name: "text", company: "text", email: "text" });

module.exports = mongoose.model("Contact", contactSchema);