import { db, openDb } from "./database.js";

const CACHE_MODULE = "enquiries";
const CACHE_KEY = "enquiries-list-v1";

const cacheKeyFor = (params) =>
  JSON.stringify({
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    search: params?.search?.trim() ?? "",
    status: params?.status ?? "",
    source: params?.source ?? "",
  });

export async function cacheEnquiries(params, payload) {
  const recordId = `${CACHE_KEY}:${cacheKeyFor(params)}`;

  await openDb();

  await db.transaction("rw", db.cachedRecords, async () => {
    const existing = await db.cachedRecords
      .where("[module+recordId]")
      .equals([CACHE_MODULE, recordId])
      .first();

    await db.cachedRecords.put({
      ...(existing ? { localId: existing.localId } : {}),
      module: CACHE_MODULE,
      recordId,
      data: payload,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function getCachedEnquiries(params) {
  const recordId = `${CACHE_KEY}:${cacheKeyFor(params)}`;

  await openDb();

  const record = await db.cachedRecords
    .where("[module+recordId]")
    .equals([CACHE_MODULE, recordId])
    .first();

  return record?.data ?? null;
}
