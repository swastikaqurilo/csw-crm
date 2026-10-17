const SyncOperation = require("../models/SyncOperation");

const STALE_CLAIM_MS = 5 * 60 * 1000; 

module.exports = function idempotency() {
  return async function (req, res, next) {
    const key =
      req.header("Idempotency-Key") ||
      (req.body && req.body.operationId) ||
      req.query.operationId;

    if (!key) {
      return res.status(400).json({ error: "missing_idempotency_key" });
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(String(key))) {
      return res.status(400).json({ error: "invalid_idempotency_key_format" });
    }

    try {
      await SyncOperation.create({
        operationId: key,
        endpoint: req.originalUrl,
        method: req.method,
        userId: req.user ? req.user._id : null,
        status: "in_progress",
        createdAt: new Date(),
      });
    } catch (err) {
      if (err.code !== 11000) return next(err);

      const existing = await SyncOperation.findOne({ operationId: key }).lean();

      if (existing.status === "completed") {
        res.set("Idempotent-Replayed", "true");
        return res.status(existing.statusCode || 200).json(existing.result);
      }

      const ageMs = Date.now() - new Date(existing.createdAt).getTime();
      if (ageMs < STALE_CLAIM_MS) {
        return res
          .status(409)
          .json({ error: "operation_in_progress", operationId: key });
      }

      await SyncOperation.updateOne(
        { operationId: key },
        { $set: { status: "in_progress", createdAt: new Date() } }
      );
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 500) {
        SyncOperation.deleteOne({ operationId: key }).catch(() => {});
        return originalJson(body);
      }
      SyncOperation.updateOne(
        { operationId: key },
        {
          $set: {
            status: "completed",
            statusCode: res.statusCode,
            result: body,
            completedAt: new Date(),
          },
        }
      ).catch((err) =>
        console.error("[idempotency] persist failed:", err.message)
      );
      return originalJson(body);
    };

    next();
  };
};