import { db, openDb } from "./database.js";

const MODULE = "http";
const MAX_ROWS = 400;

export const CACHE_HIT_EVENT = "csw:cache-hit";

function stable(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stable).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
    .join(",")}}`;
}

// Same URL + same query params (in any order) must map to the same row.
export function cacheKeyFor(url, params) {
  return `${url}?${stable(params ?? {})}`;
}

export async function writeCachedResponse(url, params, data) {
  const recordId = cacheKeyFor(url, params);

  await openDb();

  await db.transaction("rw", db.cachedRecords, async () => {
    const existing = await db.cachedRecords
      .where("[module+recordId]")
      .equals([MODULE, recordId])
      .first();

    await db.cachedRecords.put({
      ...(existing ? { localId: existing.localId } : {}),
      module: MODULE,
      recordId,
      data,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function readCachedResponse(url, params) {
  const recordId = cacheKeyFor(url, params);

  await openDb();

  const row = await db.cachedRecords
    .where("[module+recordId]")
    .equals([MODULE, recordId])
    .first();

  return row?.data ?? null;
}

export async function pruneCache(limit = MAX_ROWS) {
  await openDb();

  const rows = await db.cachedRecords.where("module").equals(MODULE).toArray();
  if (rows.length <= limit) return 0;

  rows.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));

  const doomed = rows.slice(0, rows.length - limit);
  await db.cachedRecords.bulkDelete(doomed.map((row) => row.localId));

  return doomed.length;
}

export function notifyCacheHit(url) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(new CustomEvent(CACHE_HIT_EVENT, { detail: { url } }));
}
