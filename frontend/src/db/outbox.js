import { db, openDb } from "./database.js";

const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 5000;
const MAX_DELAY_MS = 5 * 60 * 1000;

export const OUTBOX_EVENT = "csw:outbox-changed";

let flushing = null;
let started = false;

function emit() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}

export function newOperationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

// Only the collections we have a sync story for get queued.
export function collectionFor(url) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/(enquiries|contacts|follow-ups)(\/|$)/);
  return match ? match[1] : null;
}

function messageOf(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Request failed"
  );
}

function backoffMs(attempts) {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(attempts - 1, 0), MAX_DELAY_MS);
}

async function patchCachedCollections(url, apply) {
  const collection = collectionFor(url);
  if (!collection) return;

  await openDb();
  await db.transaction("rw", db.cachedRecords, async () => {
    const httpRows = await db.cachedRecords.where("module").equals("http").toArray();
    const httpAffected = httpRows.filter((row) =>
      String(row.recordId || "").startsWith(`/${collection}`)
    );

    const enqRows =
      collection === "enquiries"
        ? await db.cachedRecords.where("module").equals("enquiries").toArray()
        : [];

    for (const row of [...httpAffected, ...enqRows]) {
      const payload = row.data;
      if (!payload || !Array.isArray(payload.data)) continue;
      const next = apply(payload.data);
      if (!next) continue;
      await db.cachedRecords.put({
        ...row,
        data: { ...payload, data: next },
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

export async function applyOptimistic({ method, url, data, operationId }) {
  const verb = String(method || "").toUpperCase();
  const segments = String(url || "").split("?")[0].split("/").filter(Boolean);
  const isCollection = segments.length === 1;

  if (verb === "POST" && isCollection) {
    const optimistic = {
      ...(data || {}),
      _id: `pending:${operationId}`,
      __opId: operationId,
      __pending: true,
      createdAt: new Date().toISOString(),
    };

    await patchCachedCollections(url, (list) => [optimistic, ...list]);
    return optimistic;
  }

  if (verb === "PUT" || verb === "PATCH") {
    const id = segments[1];
    await patchCachedCollections(url, (list) =>
      list.map((item) =>
        String(item._id) === String(id) ? { ...item, ...(data || {}) } : item
      )
    );
    return null;
  }

  if (verb === "DELETE") {
    const id = segments[1];
    await patchCachedCollections(url, (list) =>
      list.filter((item) => String(item._id) !== String(id))
    );
    return null;
  }

  return null;
}

// Once the queued create is accepted, swap the optimistic row for the real one.
async function reconcileCreated(row, response) {
  const created = response?.data?.data;
  if (!created || !created._id) return;

  await patchCachedCollections(row.url, (list) =>
    list.map((item) => (item.__opId === row.operationId ? created : item))
  );
}

/* ------------------------------------------------------------------ */
/*  QUEUE                                                              */
/* ------------------------------------------------------------------ */

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
    createdAt: new Date().toISOString(),
    nextAttemptAt: 0,
  };

  try {
    await db.syncQueue.add(row);
  } catch (error) {
    // Same operation id queued twice (double tap / two tabs): keep one.
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
  const all = await db.syncQueue.toArray();
  return {
    pending: all.filter((row) => row.status === "pending").length,
    failed: all.filter((row) => row.status === "failed").length,
  };
}

export async function failedOperations() {
  await openDb();
  return db.syncQueue.where("status").equals("failed").sortBy("id");
}

export async function discard(operationId) {
  await openDb();
  const row = await db.syncQueue.where("operationId").equals(operationId).first();
  if (row) await db.syncQueue.delete(row.id);
  emit();
}

/* ------------------------------------------------------------------ */
/*  FLUSH                                                              */
/* ------------------------------------------------------------------ */

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

export async function flush({ send } = {}) {
  if (flushing) return flushing;

  flushing = (async () => {
    const sender = send || defaultSender;
    const rows = await pendingOperations();
    const now = Date.now();

    let succeeded = 0;
    let failed = 0;
    let deferred = 0;

    for (const row of rows) {
      if (row.nextAttemptAt && row.nextAttemptAt > now) {
        deferred += 1;
        continue;
      }

      try {
        const response = await sender(row);

        await db.syncQueue.delete(row.id);
        await reconcileCreated(row, response).catch(() => {});
        succeeded += 1;
      } catch (error) {
        const status = error?.response?.status;

        // Auth problem: retrying cannot help until the user signs in again.
        if (status === 401) {
          deferred += 1;
          break;
        }

        // The server answered and rejected it. Retrying won't change that.
        if (status && status < 500 && status !== 429) {
          await db.syncQueue.update(row.id, {
            status: "failed",
            attempts: (row.attempts || 0) + 1,
            lastError: messageOf(error),
          });
          failed += 1;
          continue;
        }

        // Network / server problem: back off and try later.
        const attempts = (row.attempts || 0) + 1;

        if (attempts >= MAX_ATTEMPTS) {
          await db.syncQueue.update(row.id, {
            status: "failed",
            attempts,
            lastError: messageOf(error),
          });
          failed += 1;
        } else {
          await db.syncQueue.update(row.id, {
            attempts,
            lastError: messageOf(error),
            nextAttemptAt: Date.now() + backoffMs(attempts),
          });
          deferred += 1;
        }

        // No point hammering the rest of the queue while the link is down.
        break;
      }
    }

    emit();
    return { succeeded, failed, deferred, remaining: rows.length - succeeded };
  })().finally(() => {
    flushing = null;
  });

  return flushing;
}

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
  window.setInterval(kick, 30_000);

  kick();
}
