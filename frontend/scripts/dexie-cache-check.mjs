import "fake-indexeddb/auto";
import Dexie from "dexie";

const DB_NAME = "csw-crm-local";
const V11_STORES = {
  cachedRecords: "++localId, [module+recordId], module, recordId, updatedAt",
  syncQueue: "++id, operationId, module, status, createdAt, [status+createdAt]",
  syncMetadata: "key, updatedAt",
};

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    const label = error?.inner?.name
      ? `${error.name} (${error.inner.name})`
      : error?.name ?? "Error";
    results.push({ name, ok: false, detail: `${label}: ${error?.message ?? error}` });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Reproduce a client that ran the "enquiry" commit: schema at v11, and the
// old cache writer appended a duplicate row every time the page reloaded.
async function seedLegacyV11WithDuplicates() {
  const legacy = new Dexie(DB_NAME);
  legacy.version(1).stores(V11_STORES);
  legacy.version(11).stores(V11_STORES);
  await legacy.open();

  const row = {
    module: "enquiries",
    recordId: "enquiries-list-v1:legacy-key",
    data: { data: [{ id: "old" }], total: 1, pages: 1 },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  await legacy.cachedRecords.bulkAdd([
    row,
    { ...row, updatedAt: "2026-01-02T00:00:00.000Z" },
  ]);
  legacy.close();
}

// Start each remaining check from a clean, current-version database so a
// failure in one check does not cascade into the next.
async function resetDb(db) {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  await Dexie.delete(DB_NAME);
  await db.open();
}

const params = { page: 1, limit: 10 };

function cacheKeyFor(p) {
  return `enquiries-list-v1:${JSON.stringify({
    page: p.page ?? 1,
    limit: p.limit ?? 10,
    search: "",
    status: "",
    source: "",
  })}`;
}

async function main() {
  console.log("\nCSW offline cache check (fake-indexeddb + Dexie)\n");

  await seedLegacyV11WithDuplicates();

  const { db, openDb } = await import("../src/db/database.js");
  const { cacheEnquiries, getCachedEnquiries } = await import(
    "../src/db/enquiriesCache.js"
  );
  const {
    cacheKeyFor: httpKey,
    readCachedResponse,
    writeCachedResponse,
    pruneCache,
  } = await import("../src/db/httpCache.js");
  const { enqueue, flush, pendingOperations } = await import(
    "../src/db/outbox.js"
  );

  await check("legacy v11 DB with duplicate rows opens (no wedge)", async () => {
    // The app opens the cache through openDb(), which must self-heal a
    // database that can no longer complete the v11 -> v12 upgrade.
    await openDb();
    const rows = await db.cachedRecords.count();
    return `opened, ${rows} cached rows`;
  });

  await check("cache write is an upsert (same key twice = 1 row)", async () => {
    await resetDb(db);

    await cacheEnquiries(params, { data: [{ id: "first" }], total: 1, pages: 1 });
    await cacheEnquiries(params, { data: [{ id: "second" }], total: 1, pages: 1 });

    const rows = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["enquiries", cacheKeyFor(params)])
      .toArray();

    assert(rows.length === 1, `expected 1 row for the key, found ${rows.length}`);
    return `1 row, id=${rows[0].localId}`;
  });

  await check("cache read returns the newest payload", async () => {
    const cached = await getCachedEnquiries(params);
    assert(cached, "no cached payload returned");
    assert(
      cached.data?.[0]?.id === "second",
      `expected the second write to win, got ${JSON.stringify(cached.data)}`
    );
    return "latest payload served";
  });

  await check("HTTP GET cache round-trips", async () => {
    await writeCachedResponse("/contacts", { page: 1 }, { data: [{ _id: "c1" }] });
    const cached = await readCachedResponse("/contacts", { page: 1 });
    assert(cached?.data?.[0]?._id === "c1", "cached payload did not round-trip");
    return "payload served back";
  });

  await check("HTTP GET cache upserts on repeat", async () => {
    await writeCachedResponse("/orders", { page: 1 }, { data: [{ _id: "o1" }] });
    await writeCachedResponse("/orders", { page: 1 }, { data: [{ _id: "o2" }] });

    const rows = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["http", httpKey("/orders", { page: 1 })])
      .toArray();

    assert(rows.length === 1, `expected 1 row, found ${rows.length}`);
    assert(rows[0].data.data[0]._id === "o2", "expected the newer payload");
    return "1 row, newest payload kept";
  });

  await check("HTTP cache key is stable across param order", async () => {
    assert(
      httpKey("/payments", { page: 1, status: "Paid" }) ===
        httpKey("/payments", { status: "Paid", page: 1 }),
      "param order changed the cache key"
    );
    return "same key";
  });

  await check("HTTP cache prunes to its row limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      await writeCachedResponse(`/prune-test-${i}`, {}, { data: { i } });
    }

    await pruneCache(3);

    const rows = await db.cachedRecords.where("module").equals("http").count();
    assert(rows === 3, `expected 3 rows after prune, found ${rows}`);
    return "trimmed to 3";
  });

  await check("outbox flushes queued writes in order", async () => {
    await db.syncQueue.clear();

    await enqueue({
      operationId: "op-check-0001",
      method: "POST",
      url: "/enquiries",
      data: { customerName: "A" },
    });
    await enqueue({
      operationId: "op-check-0002",
      method: "PUT",
      url: "/enquiries/abc",
      data: { status: "Quoted" },
    });

    const sent = [];
    const result = await flush({
      send: async (operation) => {
        sent.push(`${operation.method} ${operation.url}`);
        return { data: { success: true, data: { _id: "server-1" } } };
      },
    });

    assert(sent.length === 2, `expected 2 sends, got ${sent.length}`);
    assert(
      sent[0] === "POST /enquiries" && sent[1] === "PUT /enquiries/abc",
      `unexpected order: ${sent.join(" | ")}`
    );
    assert(result.succeeded === 2, `expected 2 successes, got ${result.succeeded}`);
    assert((await pendingOperations()).length === 0, "queue not emptied");
    return "2 sent in FIFO order";
  });

  await check("outbox dedupes the same operation id", async () => {
    await db.syncQueue.clear();

    await enqueue({
      operationId: "op-check-dupe",
      method: "POST",
      url: "/enquiries",
      data: { customerName: "B" },
    });
    await enqueue({
      operationId: "op-check-dupe",
      method: "POST",
      url: "/enquiries",
      data: { customerName: "B" },
    });

    const rows = await pendingOperations();
    assert(rows.length === 1, `expected 1 queued row, found ${rows.length}`);
    return "one row for a double tap";
  });

  await check("outbox parks an operation the server rejects", async () => {
    await db.syncQueue.clear();

    await enqueue({
      operationId: "op-check-reject",
      method: "POST",
      url: "/enquiries",
      data: { customerName: "C" },
    });

    await flush({
      send: async () => {
        const error = new Error("Validation failed");
        error.response = { status: 400, data: { message: "Validation failed" } };
        throw error;
      },
    });

    const rows = await db.syncQueue.toArray();
    assert(rows.length === 1 && rows[0].status === "failed", "row was not parked as failed");
    assert(rows[0].lastError === "Validation failed", "error message was not stored");
    return "marked failed, not retried";
  });

  await check("outbox backs off when the network is down", async () => {
    await db.syncQueue.clear();

    await enqueue({
      operationId: "op-check-offline",
      method: "POST",
      url: "/enquiries",
      data: { customerName: "D" },
    });

    await flush({
      send: async () => {
        throw new Error("Network Error");
      },
    });

    const rows = await db.syncQueue.toArray();
    assert(rows.length === 1 && rows[0].status === "pending", "row should stay pending");
    assert(rows[0].attempts === 1, `expected 1 attempt, got ${rows[0].attempts}`);
    assert(rows[0].nextAttemptAt > Date.now(), "no backoff scheduled");
    return "still pending, retry scheduled";
  });

  console.log("");
  for (const r of results) {
    console.log(
      `  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  -  ${r.detail}` : ""}`
    );
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log("");

  if (failed > 0) {
    console.log(`${failed} of ${results.length} checks failed.`);
    console.log(
      "These are offline-cache regressions: see src/db/enquiriesCache.js,"
    );
    console.log("src/db/httpCache.js and src/db/database.js.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`All ${results.length} checks passed.\n`);
}

main().catch((error) => {
  console.error("\nCheck harness crashed:", error);
  process.exitCode = 1;
});
