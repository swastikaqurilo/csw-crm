import { db, openDb } from "../db/database.js";

/* ───────────────────────── utils ───────────────────────── */

export function nowIso() {
  return new Date().toISOString();
}

export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function listKeyOf(payload) {
  if (Array.isArray(payload?.records)) return "records";
  if (Array.isArray(payload?.data)) return "data";
  return null;
}
export function listOf(payload) {
  const k = listKeyOf(payload);
  return k ? payload[k] : null;
}

export function newOperationId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function collectionFor(url) {
  const path = String(url || "").split("?")[0];
  if (/^\/raw-material\/stock(?:\/|$)/.test(path)) return "rawStock";
  if (/^\/raw-material\/purchases(?:\/|$)/.test(path)) return "rawPurchases";
  if (/^\/products\/stock(?:\/|$)/.test(path)) return "productStock";
  if (/^\/products(?:\/|$)/.test(path)) return "productProductions";
  const match = path.match(
    /^\/(enquiries|contacts|follow-ups|orders|payments|expenses)(?:\/|$)/
  );
  return match ? match[1] : null;
}

export function cachePathForCollection(collection) {
  if (collection === "rawStock") return "/raw-material/stock";
  if (collection === "rawPurchases") return "/raw-material/purchases";
  if (collection === "productStock") return "/products/stock";
  if (collection === "productProductions") return "/products";
  return `/${collection}`;
}

const SUB_PATH_EXCLUDES = {
  rawStock: "/raw-material/purchases",
  productProductions: "/products/stock",
};

/* ─────────────────── http-row helpers ──────────────────── */

export async function httpRowsByPrefix(prefix) {
  const safePrefix = String(prefix ?? "");
  const rows = await db.cachedRecords
    .where("module")
    .equals("http")
    .toArray()
    .catch(() => []);
  return rows.filter((row) =>
    String(row.recordId || "").startsWith(safePrefix)
  );
}

export async function httpRowsForBasePath(basePath) {
  const safeBase = String(basePath || "");
  const rows = await httpRowsByPrefix(safeBase);
  return rows.filter(
    (r) => String(r.recordId || "").split("?")[0] === safeBase
  );
}

export async function getHttpRowByBasePath(basePath) {
  const safeBase = String(basePath || "");
  const rows = await httpRowsForBasePath(safeBase);
  return rows[0] ?? null;
}

/* ─────────────── dedicated-record helpers ──────────────── */

export async function getCachedByModuleAndId(module, basePath, id) {
  await openDb();
  const strId = String(id);

  const dedicated = await db.cachedRecords
    .where("[module+recordId]")
    .equals([module, strId])
    .first();
  if (dedicated?.data) return dedicated.data;

  for (const row of await httpRowsForBasePath(basePath)) {
    const found = listOf(row.data)?.find?.((it) => String(it?._id) === strId);
    if (found) return found;
  }
  return null;
}

export async function listDedicatedRecords(module) {
  await openDb();
  return db.cachedRecords.where("module").equals(module).toArray();
}

export async function patchDedicatedRecord(module, recordId, updater) {
  await openDb();
  const id = String(recordId);
  const existing = await db.cachedRecords
    .where("[module+recordId]")
    .equals([module, id])
    .first();
  if (!existing) return null;

  const nextData = updater(existing.data);
  if (!nextData) return null;

  await db.cachedRecords.update(existing.localId, {
    data: nextData,
    updatedAt: Date.now(),
  });
  return nextData;
}

export async function upsertDedicatedRecord(module, record) {
  if (!record?._id) return;
  await openDb();

  const recordId = String(record._id);
  const existing = await db.cachedRecords
    .where("[module+recordId]")
    .equals([module, recordId])
    .first();

  await db.cachedRecords.put({
    ...(existing || {}),
    module,
    recordId,
    data: record,
    updatedAt: Date.now(),
  });
}

export async function removeDedicatedRecord(module, recordId) {
  await openDb();
  const row = await db.cachedRecords
    .where("[module+recordId]")
    .equals([module, String(recordId)])
    .first();
  if (row) await db.cachedRecords.delete(row.localId);
}

export async function patchDedicatedRecordsByModule(module, filter, updater) {
  await openDb();
  const rows = await db.cachedRecords.where("module").equals(module).toArray();
  const updates = [];
  for (const row of rows) {
    if (!filter(row.data)) continue;
    const next = updater(row.data);
    if (next) updates.push({ ...row, data: next, updatedAt: nowIso() });
  }
  if (updates.length > 0) await db.cachedRecords.bulkPut(updates);
}

/* ────────────── bulk patch http collections ────────────── */

export async function patchCachedCollections(url, apply) {
  const collection = collectionFor(url);
  if (!collection) return;

  await openDb();

  const prefix = String(cachePathForCollection(collection) || "");
  const excludePrefix = SUB_PATH_EXCLUDES[collection]
    ? String(SUB_PATH_EXCLUDES[collection])
    : null;

  await db.transaction("rw", db.cachedRecords, async () => {
    const httpAffected = excludePrefix
      ? (await httpRowsByPrefix(prefix)).filter(
          (row) => !String(row.recordId || "").startsWith(excludePrefix)
        )
      : await httpRowsByPrefix(prefix);

    const dedicatedRows =
      collection === "enquiries"
        ? await db.cachedRecords.where("module").equals("enquiries").toArray()
        : [];

    const updates = [];
    for (const row of [...httpAffected, ...dedicatedRows]) {
      const payload = row.data;
      const key = listKeyOf(payload);
      if (!key) continue;
      const next = apply(payload[key]);
      if (!next) continue;
      updates.push({
        ...row,
        data: { ...payload, [key]: next },
        updatedAt: nowIso(),
      });
    }
    if (updates.length > 0) await db.cachedRecords.bulkPut(updates);
  });
}

/* ───────────── rewrite queued references ───────────────── */

export async function rewriteQueuedReferences(tempId, realId) {
  if (!tempId || !realId || tempId === realId) return;

  await openDb();

  await db.transaction("rw", db.syncQueue, async () => {
    const queued = await db.syncQueue.toArray();
    const encodedTemp = encodeURIComponent(tempId);

    for (const op of queued) {
      const url = String(op.url || "");
      const nextUrl = url
        .split(tempId)
        .join(realId)
        .split(encodedTemp)
        .join(realId);

      const updates = {};
      if (nextUrl !== url) updates.url = nextUrl;
      if (
        op.data &&
        typeof op.data === "object" &&
        String(op.data.order) === tempId
      ) {
        updates.data = { ...op.data, order: realId };
      }

      if (Object.keys(updates).length > 0) {
        await db.syncQueue.update(op.id, updates);
      }
    }
  });
}