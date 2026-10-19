const mongoose = require("mongoose");

const syncOperationSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    endpoint: {
      type: String,
      required: true,
      maxlength: 500,
    },

    method: {
      type: String,
      required: true,
      uppercase: true,
      maxlength: 10,
    },

    requestHash: {
      type: String,
      required: true,
      immutable: true,
      match: /^[a-f0-9]{64}$/,
    },

    status: {
      type: String,
      enum: ["in_progress", "completed", "failed"],
      default: "in_progress",
      required: true,
    },

    claimToken: {
      type: String,
      required: true,
    },

    statusCode: {
      type: Number,
      default: null,
      min: 100,
      max: 599,
    },

    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
    strict: true,
  }
);

syncOperationSchema.index(
  { userId: 1, operationId: 1 },
  {
    unique: true,
    name: "user_operation_unique",
  }
);

syncOperationSchema.index(
  { status: 1, createdAt: 1 },
  { name: "sync_operation_status_created" }
);

module.exports = mongoose.model(
  "SyncOperation",
  syncOperationSchema
);
