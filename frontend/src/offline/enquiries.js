
import {
  nowIso,
  safeDecode,
  listOf,
  listDedicatedRecords,
  httpRowsForBasePath,
  patchCachedCollections,
  upsertDedicatedRecord,
  removeDedicatedRecord,
  rewriteQueuedReferences,
} from "./cache.js";

async function findEnquiry(id) {
  const targetId = String(id);

  const dedicated = await listDedicatedRecords("enquiries");

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

  const httpRows = await httpRowsForBasePath("/enquiries");

  for (const row of httpRows) {
    const match = listOf(row.data)?.find(
      (item) => String(item?._id) === targetId
    );

    if (match) return match;
  }

  return null;
}

async function patchEnquiry(id, updater) {
  const current = await findEnquiry(id);
  if (!current) {
    throw new Error("Enquiry is not available in local storage. Open it online once before editing.");
  }

  const updated = updater(current);

  await patchCachedCollections("/enquiries", (list) =>
    list.map((item) =>
      String(item?._id) === String(id) ? updated : item
    )
  );

  await upsertDedicatedRecord("enquiries", updated);

  return updated;
}

function temporaryEnquiryId(operationId) {
  return `pending:${operationId}`;
}

function localEnquiryNumber(operationId) {
  const suffix = String(operationId)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `LOCAL-${suffix}`;
}

/* ---------------- OPTIMISTIC WRITES ---------------- */

export async function applyCreate({ data, operationId }) {
  const now = nowIso();

  const enquiry = {
    ...(data || {}),
    _id: temporaryEnquiryId(operationId),
    enquiryNumber: localEnquiryNumber(operationId),
    timeline: [
      {
        date: now,
        text: `Enquiry created from ${data?.source || "Website"}`,
        createdBy: data?.assignedTo || "System",
      },
    ],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    __opId: operationId,
    __pending: true,
  };

  await patchCachedCollections("/enquiries", (list) => [
    enquiry,
    ...list.filter((item) => item.__opId !== operationId),
  ]);

  await upsertDedicatedRecord("enquiries", enquiry);

  return enquiry;
}

export async function applyUpdate({ id, data, operationId }) {
  return patchEnquiry(id, (current) => {
    const next = {
      ...current,
      ...(data || {}),
      updatedAt: nowIso(),
      __opId: operationId,
      __pending: true,
    };

    if (data?.status && data.status !== current.status) {
      next.timeline = [
        {
          date: nowIso(),
          text: `Status changed from ${current.status} to ${data.status}`,
          createdBy: "System",
        },
        ...(current.timeline || []),
      ].slice(0, 200);
    }

    return next;
  });
}

export async function applyDelete({ id }) {
  await patchCachedCollections("/enquiries", (list) =>
    list.filter((item) => String(item?._id) !== String(id))
  );

  await removeDedicatedRecord("enquiries", id);

  return null;
}

export async function applyNote({ id, data, operationId }) {
  const note = String(data?.text || "").trim();

  if (!note) {
    throw new Error("Note text is required.");
  }

  return patchEnquiry(id, (current) => ({
    ...current,
    timeline: [
      {
        date: nowIso(),
        text: note,
        createdBy: data?.createdBy || "System",
      },
      ...(current.timeline || []),
    ].slice(0, 200),
    updatedAt: nowIso(),
    __opId: operationId,
    __pending: true,
  }));
}

/* ---------------- SERVER RECONCILIATION ---------------- */

function cleanServerRecord(current, returned) {
  return {
    ...(current || {}),
    ...(returned || {}),
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

  if (!/^\/(?:api\/)?enquiries\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) {
    console.warn("[enquiries] Create reconciliation: server record missing", response);
    return;
  }

  const tempId = temporaryEnquiryId(operationId);
  const optimistic = await findEnquiry(tempId);

  await rewriteQueuedReferences(tempId, String(created._id));
  await removeDedicatedRecord("enquiries", tempId);

  const reconciled = cleanServerRecord(optimistic, created);

  await patchCachedCollections("/enquiries", (list) => [
    reconciled,
    ...list.filter(
      (item) =>
        String(item?._id) !== tempId &&
        item?.__opId !== operationId
    ),
  ]);

  await upsertDedicatedRecord("enquiries", reconciled);
}

export async function reconcileUpdate({
  url,
  method,
  operationId,
  response,
}) {
  const verb = String(method || "").toUpperCase();

  if (!["PUT", "PATCH"].includes(verb)) return;

  const path = String(url || "").split("?")[0];
  const match = path.match(
    /^\/(?:api\/)?enquiries\/([^/]+)\/?$/
  );

  if (!match) return;

  const id = safeDecode(match[1]);
  const returned = response?.data?.data;

  if (!returned?._id) return;

  const reconciled = cleanServerRecord(
    await findEnquiry(id),
    returned
  );

  if (id.startsWith("pending:")) {
    await rewriteQueuedReferences(id, String(returned._id));
    await removeDedicatedRecord("enquiries", id);
  }

  await patchCachedCollections("/enquiries", (list) =>
    list.map((item) =>
        String(item?._id) === id ||
        (operationId && item.__opId === operationId)
        ? reconciled
        : item
    )
    );

  await upsertDedicatedRecord("enquiries", reconciled);
}

export async function reconcileNote({ url, response }) {
  const path = String(url || "").split("?")[0];
  const match = path.match(
    /^\/(?:api\/)?enquiries\/([^/]+)\/notes\/?$/
  );

  if (!match) return;

  const id = safeDecode(match[1]);
  const returned = response?.data?.data;

  if (!returned?._id) return;

  const reconciled = cleanServerRecord(
    await findEnquiry(id),
    returned
  );

  await patchCachedCollections("/enquiries", (list) =>
    list.map((item) =>
      String(item?._id) === id ? reconciled : item
    )
  );

  await upsertDedicatedRecord("enquiries", reconciled);
}

export async function reconcileDelete({ url }) {
  const path = String(url || "").split("?")[0];
  const match = path.match(
    /^\/(?:api\/)?enquiries\/([^/]+)\/?$/
  );

  if (!match) return;

  const id = safeDecode(match[1]);

  await patchCachedCollections("/enquiries", (list) =>
    list.filter((item) => String(item?._id) !== id)
  );

  await removeDedicatedRecord("enquiries", id);
}

/* ---------------- LIST CACHE ---------------- */

export async function cacheEnquiries(params = {}, payload = {}) {
  const records = listOf(payload);

  for (const record of records) {
    if (record?._id) {
      await upsertDedicatedRecord("enquiries", record);
    }
  }

  return records;
}

export async function getCachedEnquiries(params = {}) {
  const dedicated = await listDedicatedRecords("enquiries");
  const httpRows = await httpRowsForBasePath("/enquiries");

  const records = new Map();

  for (const row of httpRows) {
    for (const item of listOf(row.data)) {
      if (item?._id) {
        records.set(String(item._id), item);
      }
    }
  }

  for (const row of dedicated) {
    const record = row.data;

    if (record?._id) {
      records.set(String(record._id), record);
    } else {
      for (const item of listOf(record)) {
        if (item?._id) {
          records.set(String(item._id), item);
        }
      }
    }
  }

  const data = [...records.values()].sort(
    (a, b) =>
      new Date(b.createdAt || 0) -
      new Date(a.createdAt || 0)
  );

  return {
    data,
    total: data.length,
    pages: 1,
  };
}
