import api from "../api/axios";
import { db, openDb } from "./database";
import { flush } from "../offline/index.js";
import { readCachedResponse } from "./httpCache.js";

const MODULES = {
  contacts:  "/sync/contacts",
  products:  "/sync/products",
  enquiries: "/sync/enquiries",
  orders:    "/sync/orders",
  payments:  "/sync/payments",
  expenses:  "/sync/expenses",
  rawStock:  "/sync/raw-stock", 
  rawPurchases: "/sync/raw-purchases",

};

const PAGE_SIZE = 200;


const DASHBOARD_DATASETS = [
  {
    key: "accounting",
    url: "/accounting/dashboard",
    params: {},
  },
  {
    key: "rawStock",
    url: "/raw-material/stock",
  },
  {
    key: "productStock",
    url: "/products/stock",
  },
  {
    key: "orders",
    url: "/order",
    params: { limit: 500, sort: "-createdAt" },
  },
  {
    key: "enquiries",
    url: "/enquiries",
    params: { limit: 200, sort: "-createdAt" },
  },
  {
    key: "payments",
    url: "/payment",
    params: { limit: 100, sort: "-createdAt" },
  },
  {
    key: "followups",
    url: "/follow-ups",
    params: { limit: 100 },
  },
];

async function refreshDashboardCache({ refreshAll = false } = {}) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { skipped: true, reason: "offline" };
  }

  let token = null;

  try {
    token = localStorage.getItem("token");
  } catch {
    return { skipped: true, reason: "storage-unavailable" };
  }

  if (!token) {
    return { skipped: true, reason: "no-session" };
  }

  const results = await Promise.all(
    DASHBOARD_DATASETS.map(async (item) => {
      const cached = await readCachedResponse(
        item.url,
        item.params
      ).catch(() => null);

      const mustRefresh =
        refreshAll ||
        item.key === "accounting" ||
        item.key === "followups" ||
        cached === null;

      if (!mustRefresh) {
        return {
          key: item.key,
          status: "cached",
        };
      }

      try {
        const config =
          item.params === undefined
            ? undefined
            : { params: item.params };

        await api.get(item.url, config);

        return {
          key: item.key,
          status: "refreshed",
        };
      } catch (error) {
        return {
          key: item.key,
          status: "error",
          error:
            error?.response?.data?.message ||
            error?.message ||
            "Request failed",
        };
      }
    })
  );

  return {
    complete: results.every(
      (item) => item.status !== "error"
    ),
    datasets: results,
  };
}


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

      if (typeof item === "string") {
        await db.cachedRecords.delete(existing.localId);
        continue;
      }

      const cachedVersion = Number(existing.data?.version);
      const deletedVersion = Number(item.version);

      if (
        Number.isFinite(cachedVersion) &&
        Number.isFinite(deletedVersion) &&
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

    const push = await flush({
      send: async (op) =>
        api.request({
          method: op.method,
          url: op.url,
          data: op.data ?? undefined,
          headers: { "Idempotency-Key": op.operationId },
          __fromOutbox: true,
        }),
    });

    if (push.authError) {
      console.warn("Sync paused: Auth expired. Waiting for manual login.");
      return { push, pull: [], error: "AUTH_EXPIRED" };
    }

    const pull = [];
    for (const [module, endpoint] of Object.entries(MODULES)) {
      try {
        pull.push(await syncModule(module, endpoint));
      } catch (error) {
        pull.push({ module, error: error?.message ?? String(error) });
      }
    }

    const dataChanged =
      push.succeeded > 0 ||
      pull.some(
        (item) =>
          !item.error &&
          (
            item.recordsSynced > 0 ||
            item.tombstonesApplied > 0
          )
      );

    const dashboardCache = await refreshDashboardCache({
      refreshAll: dataChanged,
    });

    return {
      push,
      pull,
      dashboardCache,
    };
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