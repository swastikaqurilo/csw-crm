const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: String,
    },
  },
  { _id: false }
);

const enquirySchema = new mongoose.Schema(
  {
    enquiryNumber: {
      type: String,
      unique: true,
      required: true,
    },

    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    customerRole: {
      type: String,
      trim: true,
      default: "",
    },
    company: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    project: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    projectRef: {
      type: String,
      trim: true,
      default: "",
    },

    product: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: String, 
      trim: true,
      default: "",
    },
    estimatedValue: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "In Progress",
        "In Discussion",
        "Quoted",
        "Converted",
        "Lost",
      ],
      default: "New",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    source: {
      type: String,
      enum: ["Website", "Referral", "Direct", "Phone", "Direct Tender Reference", "Other"],
      default: "Website",
    },
    assignedTo: {
      type: String,
      trim: true,
      default: "",
    },
    assignedRole: {
      type: String,
      trim: true,
      default: "",
    },

    requirement: {
      type: String,
      trim: true,
      default: "",
    },
    timeline: [timelineSchema],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

enquirySchema.index({ status: 1 });
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ customerName: "text", company: "text", project: "text" });

module.exports = mongoose.model("Enquiry", enquirySchema);