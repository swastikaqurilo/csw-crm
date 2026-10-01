const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
    },
    text: {
      type: String,
      required: [true, "Timeline text is required"],
      trim: true,
      maxlength: [2000, "Timeline text too long"],
    },
    createdBy: {
      type: String,
      trim: true,
      maxlength: [100, "createdBy too long"],
      default: "System",
    },
  },
  { _id: false }
);

const enquirySchema = new mongoose.Schema(
  {
    enquiryNumber: {
      type: String,
      unique: true,
      required: [true, "Enquiry number is required"],
      trim: true,
      maxlength: [50, "Enquiry number too long"],
    },

    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [150, "Customer name too long"],
    },
    customerRole: {
      type: String,
      trim: true,
      maxlength: [100, "Customer role too long"],
      default: "",
    },
    company: {
      type: String,
      trim: true,
      maxlength: [200, "Company name too long"],
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone too long"],
      match: [/^[0-9+\-\s()]*$/, "Phone contains invalid characters"],
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [200, "Email too long"],
      match: [/^\S+@\S+\.\S+$|^$/, "Please provide a valid email"],
      default: "",
    },

    project: {
      type: String,
      trim: true,
      maxlength: [200, "Project name too long"],
      default: "",
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, "Location too long"],
      default: "",
    },
    projectRef: {
      type: String,
      trim: true,
      maxlength: [100, "Project ref too long"],
      default: "",
    },

    product: {
      type: String,
      trim: true,
      maxlength: [200, "Product name too long"],
      default: "",
    },
    quantity: {
      type: String,
      trim: true,
      maxlength: [100, "Quantity too long"],
      default: "",
    },
    estimatedValue: {
      type: Number,
      default: 0,
      min: [0, "Estimated value cannot be negative"],
      max: [1e12, "Estimated value too large"],
    },

    status: {
      type: String,
      enum: {
        values: [
          "New",
          "Contacted",
          "In Progress",
          "In Discussion",
          "Quoted",
          "Converted",
          "Lost",
        ],
        message: "{VALUE} is not a valid status",
      },
      default: "New",
    },
    priority: {
      type: String,
      enum: {
        values: ["Low", "Medium", "High"],
        message: "{VALUE} is not a valid priority",
      },
      default: "Medium",
    },
    source: {
      type: String,
      enum: {
        values: [
          "Website",
          "Referral",
          "Direct",
          "Phone",
          "Direct Tender Reference",
          "Other",
        ],
        message: "{VALUE} is not a valid source",
      },
      default: "Website",
    },
    assignedTo: {
      type: String,
      trim: true,
      maxlength: [100, "assignedTo too long"],
      default: "",
    },
    assignedRole: {
      type: String,
      trim: true,
      maxlength: [100, "assignedRole too long"],
      default: "",
    },

    requirement: {
      type: String,
      trim: true,
      maxlength: [2000, "Requirement too long"],
      default: "",
    },

    // 👈 timeline is capped at 200 entries — see controller pushTimeline()
    timeline: {
      type: [timelineSchema],
      validate: {
        validator: (arr) => !Array.isArray(arr) || arr.length <= 200,
        message: "Timeline cannot have more than 200 entries",
      },
      default: [],
    },

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