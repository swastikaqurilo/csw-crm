import { db, openDb } from "../db/database.js";
import {
  upsertDedicatedRecord,
  httpRowsForBasePath,
  listDedicatedRecords,
  listOf,
} from "./cache.js";

const MODULE = "attendance";

function normalizeDate(value) {
  return String(value || "").slice(0, 10);
}

// Collect workers already available in the local cache.
async function getCachedWorkers() {
  await openDb();

  const byId = new Map();

  const httpRows = await httpRowsForBasePath("/workers");

  for (const row of httpRows) {
    for (const worker of listOf(row.data) || []) {
      if (worker?._id) {
        byId.set(String(worker._id), worker);
      }
    }
  }

  const dedicated = await listDedicatedRecords("workers");

  for (const row of dedicated) {
    if (row.data?._id) {
      byId.set(String(row.data._id), row.data);
    }
  }

  return byId;
}

async function makeLocalRecord(data, operationId, pending = true) {
  const date = normalizeDate(data?.date);

  const records = Array.isArray(data?.records)
    ? data.records.map((record) => ({
        worker: record.worker,
        status: record.status === "Absent" ? "Absent" : "Present",
        loginTime:
          record.status === "Absent" ? null : record.loginTime || null,
        logoutTime:
          record.status === "Absent" ? null : record.logoutTime || null,
      }))
    : [];

  const absentIds = records.length
    ? records
        .filter((record) => record.status === "Absent")
        .map((record) => record.worker)
    : data?.allPresent
      ? []
      : data?.absentWorkerIds || [];

  const workers = await getCachedWorkers();

  const absentWorkers = absentIds.map((id) => {
    const workerId = String(id?._id || id);
    return workers.get(workerId) || { _id: workerId };
  });

  return {
    _id: date,
    date,
    allPresent: absentWorkers.length === 0,
    absentWorkers,
    records,
    __opId: operationId || null,
    __pending: pending,
    __failed: false,
  };
}

export async function getAttendanceByDate(date) {
  await openDb();

  return (
    (await db.cachedRecords
      .where("[module+recordId]")
      .equals([MODULE, normalizeDate(date)])
      .first())?.data || null
  );
}

export async function getAttendanceHistoryFromCache() {
  await openDb();

  const byDate = new Map();

  // Read all cached server history responses.
  const historyRows = await httpRowsForBasePath(
    "/workers/attendance/history"
  );

  for (const row of historyRows) {
    const payload = row.data;
    const body = payload?.data ?? payload;

    // Support all response shapes used by the API.
    const records = Array.isArray(body)
      ? body
      : Array.isArray(body?.attendance)
        ? body.attendance
        : Array.isArray(body?.records)
          ? body.records
          : Array.isArray(body?.history)
            ? body.history
            : [];

    for (const record of records) {
      const date = normalizeDate(record?.date);
      if (!date) continue;

      byDate.set(date, record);
    }
  }

  // Local attendance takes priority over cached server history.
  const localRows = await db.cachedRecords
    .where("module")
    .equals(MODULE)
    .toArray();

  for (const row of localRows) {
    const record = row.data;
    const date = normalizeDate(record?.date || row.recordId);

    if (!date) continue;

    byDate.set(date, record);
  }

  return Array.from(byDate.values()).sort((a, b) =>
    normalizeDate(b.date).localeCompare(normalizeDate(a.date))
  );
}

export async function applySave({ data, operationId }) {
  const date = normalizeDate(data?.date);

  if (!date) {
    throw new Error("Attendance date is required");
  }

  const localRecord = await makeLocalRecord(
    data,
    operationId,
    true
  );

  await upsertDedicatedRecord(MODULE, localRecord);

  return null;
}

export async function reconcileSave({ data, response, operationId }) {
  const date = normalizeDate(data?.date);
  const serverRecord = response?.data?.data;

  if (!date || !serverRecord) return;

  const current = await getAttendanceByDate(date);

  // Do not overwrite a newer local save.
  if (
    current?.__opId &&
    operationId &&
    current.__opId !== operationId
  ) {
    return;
  }

  await upsertDedicatedRecord(MODULE, {
    ...serverRecord,
    _id: date,
    __opId: null,
    __pending: false,
    __failed: false,
  });
}

export async function onSaveFailure({ data, operationId }) {
  const date = normalizeDate(data?.date);

  if (!date) return;

  const current = await getAttendanceByDate(date);

  if (!current) return;

  if (
    operationId &&
    current.__opId &&
    current.__opId !== operationId
  ) {
    return;
  }

  await upsertDedicatedRecord(MODULE, {
    ...current,
    __failed: true,
  });
}
