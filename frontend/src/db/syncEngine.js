import api from "../api/axios";
import { db, openDb } from "./database";
import { flush } from "./outbox.js";

const MODULES = {
  contacts: "/sync/contacts",
  products: "/sync/products",
};

const PAGE_SIZE = 200;

let activeSync = null;

async function getCheckpoint(module) {
  const entry = await db.syncMetadata.get(`checkpoint:${module}`);
  return entry?.value ?? null;
}

async function saveCheckpoint(module, value) {
  await db.syncMetadata.put({
    key: `checkpoint:${module}`,
    value,
    updatedAt: new Date().toISOString(),
  });
}

async function saveRecords(module, records = []) {
  if (!records.length) return;

  await db.transaction("rw", db.cachedRecords, async () => {
    for (const record of records) {
      const recordId = String(record._id ?? record.id ?? "");
      if (!recordId) continue;

      const existing = await db.cachedRecords
        .where("[module+recordId]")
        .equals([module, recordId])
        .first();

      const cachedVersion = Number(existing?.data?.version);
      const serverVersion = Number(record.version);

      if (
        existing &&
        Number.isFinite(cachedVersion) &&
        Number.isFinite(serverVersion) &&
        cachedVersion > serverVersion
      ) {
        continue;
      }

      await db.cachedRecords.put({
        ...(existing?.localId !== undefined
          ? { localId: existing.localId }
          : {}),
        module,
        recordId,
        data: record,
        updatedAt: record.updatedAt ?? new Date().toISOString(),
      });
    }
  });
}

async function applyTombstones(module, tombstones = []) {
  if (!tombstones.length) return;

  await db.transaction("rw", db.cachedRecords, async () => {
    for (const item of tombstones) {
      const recordId = String(
        typeof item === "string" ? item : item._id ?? item.id ?? ""
      );
      if (!recordId) continue;

      const existing = await db.cachedRecords
        .where("[module+recordId]")
        .equals([module, recordId])
        .first();
      if (!existing) continue;

      if (typeof item === "string") continue;

      const cachedVersion = Number(existing.data?.version);
      const deletedVersion = Number(item.version);
      if (
        !Number.isFinite(cachedVersion) ||
        !Number.isFinite(deletedVersion) ||
        cachedVersion > deletedVersion
      ) {
        continue;
      }

      await db.cachedRecords.delete(existing.localId);
    }
  });
}

async function syncModule(module, endpoint) {
  let cursor = null;
  let since = await getCheckpoint(module);
  let pages = 0;
  let recordsSynced = 0;
  let tombstonesApplied = 0;

  do {
    const params = { limit: PAGE_SIZE };
    if (cursor) params.cursor = cursor;
    else if (since) params.since = since;

    // __fromOutbox: true → axios interceptor skips writeCachedResponse,
    // so pagination responses don't churn the http cache.
    const response = await api.request({
      method: "GET",
      url: endpoint,
      params,
      __fromOutbox: true,
    });

    const payload = response?.data?.data ?? response?.data;
    const records = payload?.records ?? [];
    const tombstones = payload?.tombstones ?? [];
    const nextCursor = payload?.nextCursor ?? null;
    const checkpoint = payload?.checkpoint ?? null;

    await saveRecords(module, records);
    await applyTombstones(module, tombstones);

    recordsSynced += records.length;
    tombstonesApplied += tombstones.length;
    pages += 1;

    if (nextCursor) {
      cursor = nextCursor;
    } else {
      cursor = null;
      if (checkpoint) await saveCheckpoint(module, checkpoint);
    }

    if (pages > 1000) {
      throw new Error(`Sync stopped: too many pages for ${module}`);
    }
  } while (cursor);

  return { module, pages, recordsSynced, tombstonesApplied };
}

export function syncAll() {
  if (activeSync) return activeSync;

  activeSync = (async () => {
    await openDb();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { skipped: true, reason: "offline" };
    }

    // Push outbox first so our own writes are reflected in the pull
    const push = await flush({
      send: async (op) =>
        api.request({
          method: op.method,
          url: op.url,
          data: op.data ?? undefined,
          headers: { "Idempotency-Key": op.operationId },
          __fromOutbox: true,
        }),
    }).catch(() => ({ succeeded: 0, failed: 0, deferred: 0 }));

    // Then pull server deltas per module
    const pull = [];
    for (const [module, endpoint] of Object.entries(MODULES)) {
      try {
        pull.push(await syncModule(module, endpoint));
      } catch (error) {
        pull.push({
          module,
          error: error?.message ?? String(error),
        });
      }
    }

    return { push, pull };
  })().finally(() => {
    activeSync = null;
  });

  return activeSync;
}

export function installAutoSync({ intervalMs = 30_000 } = {}) {
  if (typeof window === "undefined") return () => {};

  const run = () => {
    syncAll().catch((error) => {
      console.warn("[sync] failed:", error?.message ?? error);
    });
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") run();
  };

  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVisible);

  const timer = window.setInterval(() => {
    if (navigator.onLine) run();
  }, intervalMs);

  run();

  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}