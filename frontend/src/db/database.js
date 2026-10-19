
import Dexie from "dexie";

export const db = new Dexie("csw-crm-local");

db.version(1).stores({
  cachedRecords: "++localId, [module+recordId], module, recordId, updatedAt",
  syncQueue: "++id, operationId, module, status, createdAt, [status+createdAt]",
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
