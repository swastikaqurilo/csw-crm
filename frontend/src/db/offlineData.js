import { getCachedRecords, openDb } from "./database";

export async function loadModuleFromCache(module) {
  await openDb();
  const rows = await getCachedRecords(module);
  return rows
    .map((row) => row.data)
    .filter(Boolean)
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
}

export async function loadWithOfflineFallback(
  networkFn,
  module,
  extract = (res) => res?.data?.data ?? []
) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = await loadModuleFromCache(module);
    return { data: cached, fromCache: true };
  }

  try {
    const response = await networkFn();
    const data = extract(response);
    return { data: Array.isArray(data) ? data : [], fromCache: false };
  } catch (error) {
    const cached = await loadModuleFromCache(module);
    if (cached.length > 0) {
      return { data: cached, fromCache: true };
    }
    throw error;
  }
}