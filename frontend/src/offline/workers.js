
import {
  nowIso,
  safeDecode,
  listKeyOf,
  getCachedByModuleAndId,
  patchCachedCollections,
  upsertDedicatedRecord,
  removeDedicatedRecord,
  httpRowsForBasePath,
} from "./cache.js";

/* ─────────────── cache helpers ─────────────── */

export function getCachedWorker(id) {
  return getCachedByModuleAndId("workers", "/workers", id);
}

async function patchWorkerCaches(id, updater) {
  const { db, openDb } = await import("../db/database.js");
  await openDb();

  const strId = String(id);

  // Read HTTP cache before opening the write transaction.
  const httpRows = await httpRowsForBasePath("/workers");

  await db.transaction("rw", db.cachedRecords, async () => {
    const updates = [];

    const dedicated = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["workers", strId])
      .first();

    if (dedicated) {
      const next = updater(dedicated.data);

      if (next) {
        updates.push({
          ...dedicated,
          data: next,
          updatedAt: nowIso(),
        });
      }
    }

    for (const row of httpRows) {
      const key = listKeyOf(row.data);

      if (!key || !Array.isArray(row.data[key])) continue;

      updates.push({
        ...row,
        data: {
          ...row.data,
          [key]: row.data[key].map((worker) =>
            String(worker?._id) === strId
              ? updater(worker) || worker
              : worker
          ),
        },
        updatedAt: nowIso(),
      });
    }

    if (updates.length) {
      await db.cachedRecords.bulkPut(updates);
    }
  });
}

/* ─────────────── apply (optimistic) ─────────────── */

export async function applyCreate({ data, operationId }) {
  const optimistic = {
    ...(data || {}),
    _id: `pending:${operationId}`,
    __opId: operationId,
    __pending: true,
    createdAt: nowIso(),
  };

  await patchCachedCollections("/workers", (list) => [
    optimistic,
    ...list.filter((worker) => worker.__opId !== operationId),
  ]);

  await upsertDedicatedRecord("workers", optimistic);

  return optimistic;
}

export async function applyUpdate({ id, data, operationId }) {
  const worker = await getCachedWorker(id);

  if (!worker) {
    throw new Error(
      "Worker is not cached. Open Workers while online before editing it offline."
    );
  }

  const updated = {
    ...worker,
    ...(data || {}),
    __pending: true,
    __opId: operationId,
  };

  await patchWorkerCaches(id, () => updated);
  await upsertDedicatedRecord("workers", updated);

  return updated;
}

export async function applyDelete({ id, operationId }) {
  const worker = await getCachedWorker(id);

  if (!worker) {
    throw new Error(
      "Worker is not cached. Open Workers while online before deactivating it offline."
    );
  }

  const updated = {
    ...worker,
    status: "Inactive",
    __pending: true,
    __opId: operationId,
  };

  await patchWorkerCaches(id, () => updated);
  await upsertDedicatedRecord("workers", updated);

  return updated;
}

/* ─────────────── reconcile ─────────────── */

export async function reconcileCreate({ operationId, response }) {
  const created = response?.data?.data;

  if (!created?._id) return;

  const temporaryId = `pending:${operationId}`;

  const reconciled = {
    ...created,
    __pending: false,
    __opId: undefined,
  };

  await patchCachedCollections("/workers", (list) => {
    let replaced = false;
    const next = [];

    for (const worker of list) {
      const isTemporary =
        worker.__opId === operationId ||
        String(worker._id) === temporaryId;

      const isExistingServerCopy =
        String(worker._id) === String(created._id);

      if (isTemporary) {
        if (!replaced) {
          next.push(reconciled);
          replaced = true;
        }
        continue;
      }

      if (isExistingServerCopy) continue;

      next.push(worker);
    }

    if (!replaced) {
      next.unshift(reconciled);
    }

    return next;
  });

  await removeDedicatedRecord("workers", temporaryId);
  await upsertDedicatedRecord("workers", reconciled);
}

async function reconcileWorker({ id, response }) {
  const returned = response?.data?.data;

  if (!returned || typeof returned !== "object") return;

  let reconciled = null;

  await patchWorkerCaches(id, (current) => {
    if (!current) return current;

    reconciled = {
      ...current,
      ...returned,
      _id: returned._id || current._id,
      __pending: false,
      __opId: undefined,
    };

    return reconciled;
  });

  if (reconciled) {
    await upsertDedicatedRecord("workers", reconciled);
  }
}

export async function reconcileUpdate({ url, response }) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/workers\/([^/]+)$/);

  if (!match) return;

  await reconcileWorker({
    id: safeDecode(match[1]),
    response,
  });
}

export async function reconcileDelete({ url, response }) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/workers\/([^/]+)$/);

  if (!match) return;

  const id = safeDecode(match[1]);
  const returned = response?.data?.data;

  await patchWorkerCaches(id, (current) => {
    if (!current) return current;

    return {
      ...current,
      ...(returned || {}),
      status: "Inactive",
      __pending: false,
      __opId: undefined,
    };
  });

  const worker = await getCachedWorker(id);

  if (worker) {
    await upsertDedicatedRecord("workers", {
      ...worker,
      status: "Inactive",
      __pending: false,
      __opId: undefined,
    });
  }
}
