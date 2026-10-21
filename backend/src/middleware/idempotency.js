const crypto = require("node:crypto");
const SyncOperation = require("../models/SyncOperation");

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();

  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )
    .join(",")}}`;
}

function hashRequest({ userId, method, endpoint, body }) {
  const canonical = stableStringify({
    userId: String(userId),
    method,
    endpoint,
    body: body ?? null,
  });

  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function sendStoredResponse(res, operation) {
  res.set("Idempotent-Replayed", "true");

  return res
    .status(operation.statusCode || 200)
    .json(operation.result);
}

module.exports = function idempotency({ required = false } = {}) {
  return async function idempotencyMiddleware(req, res, next) {
    const rawKey =
      req.get("Idempotency-Key") ||
      req.body?.operationId;

    if (!rawKey) {
      // Idempotency is optional: routes that need replay protection pass
      // { required: true }; everything else behaves as before.
      if (!required) {
        return next();
      }

      return res.status(400).json({
        success: false,
        error: "missing_idempotency_key",
      });
    }

    const operationId = String(rawKey);

    if (!/^[A-Za-z0-9_-]{8,100}$/.test(operationId)) {
      return res.status(400).json({
        success: false,
        error: "invalid_idempotency_key",
      });
    }

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "authentication_required",
      });
    }

    const endpoint = req.originalUrl;
    const method = req.method.toUpperCase();

    const requestHash = hashRequest({
      userId,
      method,
      endpoint,
      body: req.body,
    });

    const claimToken = crypto.randomUUID();

    let operation;

    try {
      operation = await SyncOperation.create({
        operationId,
        userId,
        endpoint,
        method,
        requestHash,
        claimToken,
        status: "in_progress",
      });
    } catch (error) {
      if (error.code !== 11000) {
        return next(error);
      }

      try {
        operation = await SyncOperation.findOne({
          userId,
          operationId,
        }).lean();

        if (!operation) {
          // The competing request may not yet be visible, or the
          // database may be experiencing a transient race.
          return res.status(503).json({
            success: false,
            error: "idempotency_claim_unavailable",
            retryable: true,
          });
        }

        if (operation.requestHash !== requestHash) {
          return res.status(409).json({
            success: false,
            error: "idempotency_key_payload_mismatch",
          });
        }

        if (operation.status === "completed") {
          return sendStoredResponse(res, operation);
        }

        if (operation.status === "failed") {
          return res.status(409).json({
            success: false,
            error: "operation_requires_reconciliation",
            operationId,
          });
        }

        // Never re-execute an in-progress operation just because
        // it has become old. Recovery needs a separate safe process.
        return res.status(409).json({
          success: false,
          error: "operation_in_progress",
          operationId,
          retryable: true,
        });
      } catch (lookupError) {
        return next(lookupError);
      }
    }

    let responseHandled = false;
    const originalJson = res.json.bind(res);

    res.json = function idempotentJson(body) {
      if (responseHandled) {
        return res;
      }

      responseHandled = true;

      // Persist the outcome before sending the response. Express does
      // not await this function, so handle persistence errors here.
      void (async () => {
        try {
          const isServerError = res.statusCode >= 500;

          const update = isServerError
            ? {
                $set: {
                  status: "failed",
                  statusCode: res.statusCode,
                  failureReason:
                    "Server error; business outcome requires reconciliation.",
                },
              }
            : {
                $set: {
                  status: "completed",
                  statusCode: res.statusCode,
                  result: body,
                  completedAt: new Date(),
                },
              };

          const saved = await SyncOperation.updateOne(
            {
              _id: operation._id,
              claimToken,
              status: "in_progress",
            },
            update
          );

          if (saved.matchedCount !== 1) {
            throw new Error(
              "Idempotency claim was lost before the result was saved."
            );
          }

          originalJson(body);
        } catch (error) {
          console.error(
            "[idempotency] Could not persist operation outcome:",
            error.message
          );

          // Do not report a successful response if we cannot safely
          // record its replayable outcome.
          if (!res.headersSent) {
            res.status(503);
            originalJson({
              success: false,
              error: "operation_result_persistence_failed",
              operationId,
              retryable: true,
            });
          }
        }
      })();

      return res;
    };

    next();
  };
};
