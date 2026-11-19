
import "fake-indexeddb/auto";
import Dexie from "dexie";

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, passed: true, detail: detail || "" });
  } catch (error) {
    results.push({
      name,
      passed: false,
      detail: `${error?.name || "Error"}: ${error?.message || error}`,
    });
  }
}

async function main() {
  console.log("\nCSW CRM — Offline Database Tests\n");

  // Import the current project implementation.
  const { db, openDb } = await import("../src/db/database.js");

  const {
    cacheKeyFor,
    writeCachedResponse,
    readCachedResponse,
    pruneCache,
  } = await import("../src/db/httpCache.js");

  const {
    enqueue,
    flush,
    pendingOperations,
    outboxCounts,
  } = await import("../src/offline/core.js");

  // 1. Database opens successfully.
  await check("Database opens successfully", async () => {
    await openDb();

    assert(db.isOpen(), "Database is not open");
    assert(db.verno === 13, `Expected DB version 13, got ${db.verno}`);

    return `Database version ${db.verno}`;
  });

  // 2. Unique indexes exist.
  await check("Database has required unique indexes", async () => {
    const cacheIndex = db.cachedRecords.schema.indexes.find(
      (index) => index.name === "[module+recordId]"
    );

    const queueIndex = db.syncQueue.schema.indexes.find(
      (index) => index.name === "operationId"
    );

    assert(cacheIndex?.unique, "Cache unique index is missing");
    assert(queueIndex?.unique, "Outbox operationId unique index is missing");

    return "Both unique indexes exist";
  });

  // 3. HTTP cache write and read.
  await check("HTTP cache writes and reads correctly", async () => {
    const payload = {
      data: [{ _id: "contact-test-1", name: "Test Contact" }],
    };

    await writeCachedResponse("/contacts", { page: 1 }, payload);

    const cached = await readCachedResponse("/contacts", { page: 1 });

    assert(
      cached?.data?.[0]?._id === "contact-test-1",
      "Cached contact was not returned"
    );

    return "Cached response returned correctly";
  });

  // 4. HTTP cache updates existing records instead of duplicating them.
  await check("HTTP cache updates existing records", async () => {
    await writeCachedResponse("/orders", { page: 1 }, {
      data: [{ _id: "order-old" }],
    });

    await writeCachedResponse("/orders", { page: 1 }, {
      data: [{ _id: "order-new" }],
    });

    const key = cacheKeyFor("/orders", { page: 1 });

    const rows = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["http", key])
      .toArray();

    assert(rows.length === 1, `Expected 1 cache row, found ${rows.length}`);
    assert(
      rows[0].data.data[0]._id === "order-new",
      "Latest cache data was not saved"
    );

    return "One row exists with the latest data";
  });

  // 5. Cache keys should not depend on parameter order.
  await check("HTTP cache keys are stable", async () => {
    const first = cacheKeyFor("/payments", {
      page: 1,
      status: "Paid",
    });

    const second = cacheKeyFor("/payments", {
      status: "Paid",
      page: 1,
    });

    assert(first === second, "Parameter order changed the cache key");

    return "Both parameter orders produce the same key";
  });

  // 6. Cache pruning.
  await check("HTTP cache pruning works", async () => {
    for (let i = 0; i < 5; i += 1) {
      await writeCachedResponse(
        `/prune-test-${i}`,
        {},
        { data: [{ id: i }] }
      );
    }

    await pruneCache(3);

    const remaining = await db.cachedRecords
      .where("module")
      .equals("http")
      .count();

    assert(remaining === 3, `Expected 3 rows, found ${remaining}`);

    return "Cache reduced to 3 rows";
  });

  // 7. Outbox preserves write order and removes successful operations.
  await check("Outbox sends operations in order", async () => {
    await db.syncQueue.clear();

    await enqueue({
      operationId: "test-order-001",
      method: "POST",
      url: "/__offline-test/first",
      data: { name: "First" },
    });

    await enqueue({
      operationId: "test-order-002",
      method: "POST",
      url: "/__offline-test/second",
      data: { name: "Second" },
    });

    const sent = [];

    const result = await flush({
      send: async (operation) => {
        sent.push(operation.operationId);
        return { data: { success: true } };
      },
    });

    assert(sent.length === 2, `Expected 2 sends, got ${sent.length}`);

    assert(
      sent[0] === "test-order-001" &&
      sent[1] === "test-order-002",
      "Outbox did not preserve FIFO order"
    );

    assert(result.succeeded === 2, "Both operations did not succeed");

    const remaining = await pendingOperations();

    assert(remaining.length === 0, "Successful operations remain queued");

    return "Both operations sent in FIFO order";
  });

  // 8. Duplicate operation IDs should not create duplicate queue entries.
  await check("Outbox prevents duplicate operation IDs", async () => {
    await db.syncQueue.clear();

    const operation = {
      operationId: "test-duplicate-001",
      method: "POST",
      url: "/__offline-test/duplicate",
      data: { name: "Duplicate Test" },
    };

    await enqueue(operation);
    await enqueue(operation);

    const rows = await pendingOperations();

    assert(rows.length === 1, `Expected 1 row, found ${rows.length}`);

    return "Duplicate operation was ignored";
  });

  // 9. Permanent client errors should be parked as failed.
  await check("Outbox handles permanent server errors", async () => {
    await db.syncQueue.clear();

    await enqueue({
      operationId: "test-failure-001",
      method: "POST",
      url: "/__offline-test/failure",
      data: { name: "Failure Test" },
    });

    await flush({
      send: async () => {
        const error = new Error("Validation failed");

        error.response = {
          status: 400,
          data: { message: "Validation failed" },
        };

        throw error;
      },
    });

    const counts = await outboxCounts();
    const rows = await db.syncQueue.toArray();

    assert(counts.failed === 1, "Failed operation was not recorded");
    assert(rows[0]?.status === "failed", "Operation is not marked failed");
    assert(
      rows[0]?.lastError === "Validation failed",
      "Error message was not saved"
    );

    return "Permanent error correctly marked as failed";
  });

  // 10. Network errors should keep the operation pending and schedule retry.
  await check("Outbox retries after network errors", async () => {
    await db.syncQueue.clear();

    await enqueue({
      operationId: "test-network-001",
      method: "POST",
      url: "/__offline-test/network",
      data: { name: "Network Test" },
    });

    await flush({
      send: async () => {
        throw new Error("Network Error");
      },
    });

    const rows = await db.syncQueue.toArray();

    assert(rows.length === 1, "Queued operation disappeared");
    assert(rows[0].status === "pending", "Operation should remain pending");
    assert(rows[0].attempts === 1, "Attempt count should be 1");
    assert(
      rows[0].nextAttemptAt > Date.now(),
      "Retry time was not scheduled"
    );

    return "Operation remains pending with retry scheduled";
  });

  // Print results.
  console.log("");

  for (const result of results) {
    console.log(
      `${result.passed ? "PASS" : "FAIL"}  ${result.name}`
    );

    if (result.detail) {
      console.log(`      ${result.detail}`);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  console.log("\n--------------------------------");
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  console.log("--------------------------------\n");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nTest harness crashed:", error);
  process.exitCode = 1;
});
