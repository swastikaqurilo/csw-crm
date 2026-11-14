
import {
  nowIso,
  listOf,
  listDedicatedRecords,
  httpRowsForBasePath,
  patchCachedCollections,
  upsertDedicatedRecord,
  removeDedicatedRecord,
  rewriteQueuedReferences,
} from "./cache.js";

/* -------------------------------------------------------
   CONTACT LOOKUP
------------------------------------------------------- */

async function findContact(id) {
  const targetId = String(id);

  const dedicated = await listDedicatedRecords("contacts");

  for (const row of dedicated) {
    const record = row.data;

    if (String(record?._id) === targetId) {
      return record;
    }

    const match = listOf(record)?.find(
      (item) => String(item?._id) === targetId
    );

    if (match) return match;
  }

  const rows = await httpRowsForBasePath("/contacts");

  for (const row of rows) {
    const match = listOf(row.data)?.find(
      (item) => String(item?._id) === targetId
    );

    if (match) return match;
  }

  return null;
}

async function patchContact(id, updater) {
  const current = await findContact(id);

  if (!current) {
    throw new Error(
      "Contact is not available in local storage. Open it online once before editing."
    );
  }

  const updated = updater(current);

  await patchCachedCollections("/contacts", (list) =>
    list.map((item) =>
      String(item?._id) === String(id) ? updated : item
    )
  );

  await upsertDedicatedRecord("contacts", updated);

  return updated;
}

/* -------------------------------------------------------
   TEMPORARY IDS
------------------------------------------------------- */

function temporaryContactId(operationId) {
  return `pending:${operationId}`;
}

function localContactNumber(operationId) {
  const suffix = String(operationId)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `LOCAL-${suffix}`;
}

export async function applyCreate({ data, operationId }) {
  const now = nowIso();

  const contact = {
    ...(data || {}),
    _id: temporaryContactId(operationId),
    contactId: localContactNumber(operationId),
    enquiries: 0,
    lastContact: null,
    createdAt: now,
    updatedAt: now,
    __opId: operationId,
    __pending: true,
  };

  console.log("[CONTACTS] Creating locally:", contact);

  await patchCachedCollections("/contacts", (list) => [
    contact,
    ...list.filter((item) => item?.__opId !== operationId),
  ]);

  await upsertDedicatedRecord("contacts", contact);

  console.log("[CONTACTS] Created contact stored:", contact);

  return contact;
}

export async function applyUpdate({
  id,
  data,
  operationId,
}) {
  const current = await findContact(id);

  if (!current) {
    throw new Error(
      "Contact is not available in local storage."
    );
  }

  const updated = {
    ...current,
    ...(data || {}),
    _id: current._id,
    updatedAt: nowIso(),
    __opId: operationId,
    __pending: true,
  };

  await patchCachedCollections("/contacts", (list) =>
    list.map((item) =>
      String(item?._id) === String(id) ? updated : item
    )
  );

  await upsertDedicatedRecord("contacts", updated);

  return updated;
}

export async function applyDelete({ id }) {
  const current = await findContact(id);

  await patchCachedCollections("/contacts", (list) =>
    list.filter(
      (item) => String(item?._id) !== String(id)
    )
  );

  await removeDedicatedRecord("contacts", id);

  return current;
}

function cleanServerRecord(optimistic, serverRecord) {
  return {
    ...(optimistic || {}),
    ...(serverRecord || {}),
    __pending: false,
    __opId: undefined,
  };
}

export async function reconcileCreate({
  url,
  operationId,
  response,
}) {
  const path = String(url || "").split("?")[0];

  if (!/^\/(?:api\/)?contacts\/?$/.test(path)) {
    return;
  }

  const created = response?.data?.data;

  if (!created?._id) return;

  const tempId = temporaryContactId(operationId);
  const optimistic = await findContact(tempId);

  await rewriteQueuedReferences(
    tempId,
    String(created._id)
  );

  await removeDedicatedRecord("contacts", tempId);

  const reconciled = cleanServerRecord(
    optimistic,
    created
  );

  await patchCachedCollections("/contacts", (list) => [
    reconciled,
    ...list.filter(
      (item) =>
        String(item?._id) !== tempId &&
        item?.__opId !== operationId &&
        String(item?._id) !== String(created._id)
    ),
  ]);

  await upsertDedicatedRecord("contacts", reconciled);
}

export async function reconcileUpdate({ id, response }) {
  const serverRecord = response?.data?.data;
  const current = await findContact(id);

  if (!current) return;

  const reconciled = cleanServerRecord(
    current,
    serverRecord?._id
      ? serverRecord
      : {
          ...current,
          ...(serverRecord || {}),
          _id: current._id,
        }
  );

  await patchCachedCollections("/contacts", (list) =>
    list.map((item) =>
      String(item?._id) === String(id)
        ? reconciled
        : item
    )
  );

  await upsertDedicatedRecord("contacts", reconciled);
}

export async function reconcileDelete({ id }) {
  await patchCachedCollections("/contacts", (list) =>
    list.filter(
      (item) => String(item?._id) !== String(id)
    )
  );

  await removeDedicatedRecord("contacts", id);
}
