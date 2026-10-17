const mongoose = require("mongoose");

const syncOperationSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      unique: true,
    },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
      required: true,
    },
    statusCode: { type: Number, default: null },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

syncOperationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60, name: "idempotency_ttl_90d" }
);

module.exports = mongoose.model("SyncOperation", syncOperationSchema);