import { db } from "./database";

export async function testDatabase() {
  const testRecord = {
    module: "__test__",
    recordId: "dexie-test-1",
    data: { message: "CSW offline database works" },
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.cachedRecords.put({
      ...testRecord,
      localId: undefined,
    });

    const saved = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["__test__", "dexie-test-1"])
      .first();

    console.log("[Dexie test] Saved and retrieved:", saved);

    return saved;
  } catch (error) {
    console.error("[Dexie test] Failed:", error);
    throw error;
  } finally {
    await db.cachedRecords
      .where("module")
      .equals("__test__")
      .delete();
  }
}
