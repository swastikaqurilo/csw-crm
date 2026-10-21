
import Dexie from "dexie";

export const db = new Dexie("csw-crm-local");

db.version(1).stores({
  cachedRecords: "++localId, [module+recordId], module, recordId, updatedAt",
  syncQueue:
    "++id, operationId, module, status, createdAt, [status+createdAt]",
  syncMetadata: "key, updatedAt",
});


db.version(11)
  .stores({
    cachedRecords:
      "++localId, [module+recordId], module, recordId, updatedAt",
    syncQueue:
      "++id, operationId, module, status, createdAt, [status+createdAt]",
    syncMetadata: "key, updatedAt",
  })
  .upgrade(async (tx) => {
    const table = tx.table("cachedRecords");
    const rows = await table.toArray();
    const keep = new Map();

    const timestamp = (row) =>
      Date.parse(row.updatedAt ?? "") || 0;

    for (const row of rows) {
      if (
        !row.module ||
        row.recordId == null ||
        row.recordId === ""
      ) {
        continue;
      }

      const identity = JSON.stringify([
        row.module,
        String(row.recordId),
      ]);

      const previous = keep.get(identity);

      if (!previous || timestamp(row) >= timestamp(previous)) {
        keep.set(identity, row);
      }
    }

    const keepIds = new Set(
      [...keep.values()].map((row) => row.localId)
    );

    for (const row of rows) {
      if (
        row.module &&
        row.recordId != null &&
        row.recordId !== "" &&
        !keepIds.has(row.localId)
      ) {
        await table.delete(row.localId);
      }
    }

    for (const row of keep.values()) {
      const normalizedId = String(row.recordId);

      if (row.recordId !== normalizedId) {
        await table.update(row.localId, {
          recordId: normalizedId,
        });
      }
    }
  });

db.version(12).stores({
  cachedRecords:
    "++localId, &[module+recordId], module, recordId, updatedAt",
  syncQueue:
    "++id, operationId, module, status, createdAt, [status+createdAt]",
  syncMetadata: "key, updatedAt",
});


export async function getCachedRecords(module) {
  return db.cachedRecords.where("module").equals(module).toArray();
}

export async function getPendingOperations() {
  return db.syncQueue
    .where("status")
    .equals("pending")
    .sortBy("createdAt");
}
