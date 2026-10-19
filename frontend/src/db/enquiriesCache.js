
import { db } from "./database";

const CACHE_MODULE = "enquiries";
const CACHE_KEY = "enquiries-list-v1";

export async function cacheEnquiries(params, payload) {
  const cacheKey = JSON.stringify({
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    search: params?.search?.trim() ?? "",
    status: params?.status ?? "",
    source: params?.source ?? "",
  });

  await db.transaction("rw", db.cachedRecords, async () => {
    await db.cachedRecords.put({
      module: CACHE_MODULE,
      recordId: `${CACHE_KEY}:${cacheKey}`,
      data: payload,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function getCachedEnquiries(params) {
  const cacheKey = JSON.stringify({
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    search: params?.search?.trim() ?? "",
    status: params?.status ?? "",
    source: params?.source ?? "",
  });

  const record = await db.cachedRecords
    .where("[module+recordId]")
    .equals([CACHE_MODULE, `${CACHE_KEY}:${cacheKey}`])
    .first();

  return record?.data ?? null;
}
