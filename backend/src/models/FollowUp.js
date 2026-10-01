const mongoose = require("mongoose");

const followUpSchema = new mongoose.Schema(
  {
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: [true, "Contact is required"],
      index: true,
    },

    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enquiry",
      default: null,
    },

    type: {
      type: String,
      enum: {
        values: ["Call", "Email", "Meeting", "WhatsApp", "Other"],
        message: "{VALUE} is not a valid follow-up type",
      },
      default: "Call",
    },

    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject too long"],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes too long"],
      default: "",
    },

    scheduledAt: {
      type: Date,
      required: [true, "Scheduled date is required"],
    },

    status: {
      type: String,
      enum: {
        values: ["Pending", "Completed", "Cancelled"],
        message: "{VALUE} is not a valid status",
      },
      default: "Pending",
    },

    priority: {
      type: String,
      enum: {
        values: ["Low", "Medium", "High"],
        message: "{VALUE} is not a valid priority",
      },
      default: "Medium",
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

followUpSchema.index({ scheduledAt: 1 });
followUpSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model("FollowUp", followUpSchema);