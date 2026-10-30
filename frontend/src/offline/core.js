import { db, openDb } from "../db/database.js";
import { collectionFor, safeDecode, nowIso } from "./cache.js";
import { applyOptimistic as routerApply, reconcile, onFailure } from "./router.js";

const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 5 * 60 * 1000;

export const OUTBOX_EVENT = "csw:outbox-changed";

let flushing = null;
let started = false;
let intervalId = null;

/* ─────────────── events ─────────────── */

function emit() {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  ) {
    return;
  }
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}

/* ─────────────── helpers ─────────────── */

function messageOf(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

function backoffMs(attempts) {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(attempts - 1, 0), MAX_DELAY_MS);
}

function findParentTempId(row) {
  const urlMatch = String(row.url || "")
    .split("?")[0]
    .match(/(?:^|\/)(?:pending:|pending%3A)([^/]+)/i);
  if (urlMatch) return safeDecode(urlMatch[1]);

  if (row.data && typeof row.data === "object") {
    try {
      const bodyStr = JSON.stringify(row.data);
      const bodyMatch = bodyStr.match(/pending:([a-zA-Z0-9_-]+)/);
      if (bodyMatch) return bodyMatch[1];
    } catch {
      /* ignore */
    }
  }
  return null;
}

/* ─────────────── queue API ─────────────── */

export async function enqueue({ operationId, method, url, data }) {
  await openDb();

  const row = {
    operationId,
    method: String(method).toUpperCase(),
    url,
    data: data ?? null,
    module: collectionFor(url) || "",
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: nowIso(),
    nextAttemptAt: 0,
  };

  try {
    await db.syncQueue.add(row);
  } catch (error) {
    if (error?.name !== "ConstraintError") throw error;
  }

  emit();
  return row;
}

export async function pendingOperations() {
  await openDb();
  return db.syncQueue.where("status").equals("pending").sortBy("id");
}

export async function outboxCounts() {
  await openDb();
  const [pending, failed] = await Promise.all([
    db.syncQueue.where("status").equals("pending").count(),
    db.syncQueue.where("status").equals("failed").count(),
  ]);
  return { pending, failed };
}

export async function failedOperations() {
  await openDb();
  return db.syncQueue.where("status").equals("failed").sortBy("id");
}

export async function discard(operationId) {
  await openDb();
  const row = await db.syncQueue
    .where("operationId")
    .equals(operationId)
    .first();
  if (row) await db.syncQueue.delete(row.id);
  emit();
}

/* ─────────────── re-export public entry ─────────────── */

export const applyOptimistic = routerApply;

/* ─────────────── sender ─────────────── */

async function defaultSender(operation) {
  const { default: api } = await import("../api/axios.js");
  return api.request({
    method: operation.method,
    url: operation.url,
    data: operation.data ?? undefined,
    headers: { "Idempotency-Key": operation.operationId },
    __fromOutbox: true,
  });
}

/* ─────────────── flush ─────────────── */

export async function flush({ send } = {}) {
  if (flushing) return flushing;

  flushing = (async () => {
    await openDb();

    const sender = send || defaultSender;
    const rows = await pendingOperations();

    let succeeded = 0;
    let failed = 0;
    let deferred = 0;
    let authError = false;

    for (const originalRow of rows) {
      const row = await db.syncQueue.get(originalRow.id);
      if (!row || row.status !== "pending") continue;

      if (row.nextAttemptAt && row.nextAttemptAt > Date.now()) {
        deferred += 1;
        continue;
      }

      const parentTempId = findParentTempId(row);
      if (parentTempId) {
        const parent = await db.syncQueue
          .where("operationId")
          .equals(parentTempId)
          .first();

        if (parent?.status === "failed") {
          await onFailure(row);
          await db.syncQueue.update(row.id, {
            status: "failed",
            lastError: "The record this action belongs to failed to sync.",
            nextAttemptAt: 0,
          });
          failed += 1;
        } else {
          deferred += 1;
        }
        continue;
      }

      try {
        const response = await sender(row);

        await reconcile({
          method: row.method,
          url: row.url,
          operationId: row.operationId,
          response,
        });

        await db.syncQueue.delete(row.id);
        succeeded += 1;
      } catch (error) {
        const status = error?.response?.status;
        const body = error?.response?.data;
        const attempts = (row.attempts || 0) + 1;
        const message = messageOf(error);

        // Honor explicit retryable flag from idempotency middleware
        const explicitlyRetryable = body?.retryable === true;

        if (status === 401) {
          await db.syncQueue.update(row.id, {
            status: "pending",
            attempts,
            lastError: message,
            nextAttemptAt: Date.now() + BASE_DELAY_MS,
          });
          deferred += 1;
          authError = true;
          break;
        }

        const permanent =
          typeof status === "number" &&
          status >= 400 &&
          status < 500 &&
          !explicitlyRetryable;

        const exhausted = attempts >= MAX_ATTEMPTS;

        if (permanent || exhausted) {
          await onFailure(row);
        }

        await db.syncQueue.update(row.id, {
          status: permanent || exhausted ? "failed" : "pending",
          attempts,
          lastError: message,
          nextAttemptAt:
            permanent || exhausted ? 0 : Date.now() + backoffMs(attempts),
        });

        if (permanent || exhausted) failed += 1;
        else deferred += 1;
      }
    }

    emit();

    return {
      succeeded,
      failed,
      deferred,
      remaining: rows.length - succeeded,
      authError,
    };
  })().finally(() => {
    flushing = null;
  });

  return flushing;
}

/* ─────────────── online write reconcile ─────────────── */

export async function reconcileOnlineWrite({ method, url, operationId, response }) {
  return reconcile({ method, url, operationId, response });
}

/* ─────────────── start ─────────────── */

export function startOutbox() {
  if (started || typeof window === "undefined") return;
  started = true;

  const kick = () => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flush().catch((error) => {
        console.warn("[outbox] flush failed:", error?.message);
      });
    }
  };

  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });

  if (intervalId === null) {
    intervalId = window.setInterval(kick, 30_000);
  }

  kick();
}