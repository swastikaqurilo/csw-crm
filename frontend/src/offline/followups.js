
import {
  nowIso,
  safeDecode,
  listOf,
  listDedicatedRecords,
  httpRowsForBasePath,
  patchCachedCollections,
  upsertDedicatedRecord,
  removeDedicatedRecord,
} from "./cache.js";

const MODULE = "follow-ups";
const BASE_PATH = "/follow-ups";

async function findFollowUp(id) {
  const targetId = String(id);

  const dedicated = await listDedicatedRecords(MODULE);

  for (const row of dedicated) {
    const record = row.data;

    if (String(record?._id) === targetId) return record;

    const match = listOf(record)?.find(
      (item) => String(item?._id) === targetId
    );

    if (match) return match;
  }

  const httpRows = await httpRowsForBasePath(BASE_PATH);

  for (const row of httpRows) {
    const match = listOf(row.data)?.find(
      (item) => String(item?._id) === targetId
    );

    if (match) return match;
  }

  return null;
}

function cleanRecord(current, returned) {
  return {
    ...(current || {}),
    ...(returned || {}),
    __pending: false,
    __opId: undefined,
  };
}

/* OPTIMISTIC CREATE */

export async function applyCreate({ data, operationId }) {
  const now = nowIso();

  const followUp = {
    ...(data || {}),
    _id: `pending:${operationId}`,
    status: data?.status || "Pending",
    priority: data?.priority || "Medium",
    completedAt:
      data?.status === "Completed"
        ? data?.completedAt || now
        : null,
    createdAt: now,
    updatedAt: now,
    __opId: operationId,
    __pending: true,
  };

  await patchCachedCollections(BASE_PATH, (list) => [
    followUp,
    ...list.filter((item) => item.__opId !== operationId),
  ]);

  await upsertDedicatedRecord(MODULE, followUp);

  return followUp;
}

/* OPTIMISTIC UPDATE: EDIT, COMPLETE, CANCEL, RESCHEDULE */

export async function applyUpdate({ id, data, operationId }) {
  const current = await findFollowUp(id);

  if (!current) {
    throw new Error(
      "Follow-up is not available in local storage. Open Follow-ups online once before editing it offline."
    );
  }

  const nextStatus = data?.status ?? current.status;

  const updated = {
    ...current,
    ...(data || {}),
    _id: current._id,
    completedAt:
      nextStatus === "Completed"
        ? data?.completedAt || current.completedAt || nowIso()
        : null,
    updatedAt: nowIso(),
    __opId: operationId,
    __pending: true,
  };

  await patchCachedCollections(BASE_PATH, (list) =>
    list.map((item) =>
      String(item?._id) === String(id) ? updated : item
    )
  );

  await upsertDedicatedRecord(MODULE, updated);

  return updated;
}

/* OPTIMISTIC DELETE */

export async function applyDelete({ id }) {
  await patchCachedCollections(BASE_PATH, (list) =>
    list.filter((item) => String(item?._id) !== String(id))
  );

  await removeDedicatedRecord(MODULE, id);

  return null;
}

/* SERVER RECONCILIATION */

export async function reconcileCreate({
  url,
  operationId,
  response,
}) {
  const path = String(url || "").split("?")[0];

  if (!/^\/(?:api\/)?follow-ups\/?$/.test(path)) return;

  const created = response?.data?.data;

  if (!created?._id) {
    console.warn("[follow-ups] Create reconciliation: server record missing", response);
    return;
  }

  const temporaryId = `pending:${operationId}`;
  const optimistic = await findFollowUp(temporaryId);
  const reconciled = cleanRecord(optimistic, created);

  await patchCachedCollections(BASE_PATH, (list) => [
    reconciled,
    ...list.filter(
      (item) =>
        String(item?._id) !== temporaryId &&
        item?.__opId !== operationId
    ),
  ]);

  await removeDedicatedRecord(MODULE, temporaryId);
  await upsertDedicatedRecord(MODULE, reconciled);
}

export async function reconcileUpdate({
  url,
  response,
}) {
  const path = String(url || "").split("?")[0];

  const match = path.match(
    /^\/(?:api\/)?follow-ups\/([^/]+)\/?$/
  );

  if (!match) return;

  const id = safeDecode(match[1]);
  const returned = response?.data?.data;

  if (!returned?._id) return;

  const reconciled = cleanRecord(
    await findFollowUp(id),
    returned
  );

  await patchCachedCollections(BASE_PATH, (list) =>
    list.map((item) =>
      String(item?._id) === id ? reconciled : item
    )
  );

  await upsertDedicatedRecord(MODULE, reconciled);
}

export async function reconcileDelete({ url }) {
  const path = String(url || "").split("?")[0];

  const match = path.match(
    /^\/(?:api\/)?follow-ups\/([^/]+)\/?$/
  );

  if (!match) return;

  const id = safeDecode(match[1]);

  await patchCachedCollections(BASE_PATH, (list) =>
    list.filter((item) => String(item?._id) !== id)
  );

  await removeDedicatedRecord(MODULE, id);
}
