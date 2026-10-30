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

        const STALE_MS = 5 * 60 * 1000;
        const startedAtMs = new Date(
          operation.startedAt ||
          operation.createdAt ||
          operation.updatedAt ||
          0
        ).getTime();

        const isStale = Date.now() - startedAtMs > STALE_MS;

        if (!isStale) {
          return res.status(409).json({
            success: false,
            error: "operation_in_progress",
            message:
              "This operation is currently being processed. Retrying shortly is safe.",
            operationId,
            retryable: true,
          });
        }

        let takenOver;
        try {
          takenOver = await SyncOperation.findOneAndUpdate(
            {
              _id: operation._id,
              status: "in_progress",
              claimToken: operation.claimToken,  
            },
            {
              $set: {
                claimToken: crypto.randomUUID(),
                startedAt: new Date(),
                requestHash,                       
              },
            },
            { new: true }
          );
        } catch (takeoverError) {
          return next(takeoverError);
        }

        if (!takenOver) {
          return res.status(409).json({
            success: false,
            error: "operation_in_progress",
            message:
              "This operation is currently being processed. Retrying shortly is safe.",
            operationId,
            retryable: true,
          });
        }

        operation = takenOver;
        claimToken = takenOver.claimToken;
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
