
import {
  nowIso,
  listDedicatedRecords,
  upsertDedicatedRecord,
} from "./cache.js";

import { readCachedResponse } from "../db/httpCache.js";

const MODULE = "settings";
const LOCAL_ID = "global";

function normalizeSettings(data) {
  return {
    ...(data || {}),
    _id: LOCAL_ID,
    updatedAt: nowIso(),
    __pending: true,
  };
}

export async function getSettingsFromCache() {
  const records = await listDedicatedRecords(MODULE);
  const local = records.find(
    (row) => String(row.recordId) === LOCAL_ID
  );

  if (local?.data) {
    return {
      success: true,
      data: local.data,
    };
  }

  const cached = await readCachedResponse("/settings");

  if (cached?.data) return cached;

  return null;
}

export async function applyUpdate({ data }) {
  const current = await getSettingsFromCache();

  const updated = normalizeSettings({
    ...(current?.data || {}),
    ...(data || {}),
  });

  await upsertDedicatedRecord(MODULE, updated);

  return updated;
}

export async function reconcileUpdate({ response }) {
  const returned = response?.data?.data;

  if (!returned || typeof returned !== "object") return;

  await upsertDedicatedRecord(MODULE, {
    ...returned,
    _id: LOCAL_ID,
    __pending: false,
    updatedAt: returned.updatedAt || nowIso(),
  });
}
