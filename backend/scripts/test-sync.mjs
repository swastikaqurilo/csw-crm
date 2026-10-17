import { randomUUID } from "node:crypto";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5000";
const TOKEN = process.env.TEST_TOKEN;
if (!TOKEN) {
  console.error("Set TEST_TOKEN env var (a valid JWT from your app)");
  process.exit(1);
}

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
});

async function call(method, path, { body, idemKey } = {}) {
  const h = headers();
  if (idemKey) h["Idempotency-Key"] = idemKey;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return {
    status: res.status,
    body: json,
    replayed: res.headers.get("idempotent-replayed") === "true",
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function main() {
  console.log(`\n▶ Step 2 harness against ${BASE}\n`);

  const delta = await call("GET", "/api/sync/contacts?since=1970-01-01T00:00:00Z");
  assert(delta.status === 200, "GET /sync/contacts returns 200");
  assert(delta.body.serverTime, "response has serverTime");
  assert(delta.body.checkpoint, "response has checkpoint");
  assert(Array.isArray(delta.body.records), "response has records array");
  assert(Array.isArray(delta.body.tombstones), "response has tombstones array");

  const key = randomUUID();
  const first = await call("POST", "/api/sync/_test/write", {
    body: { hello: "world" },
    idemKey: key,
  });
  assert(first.status === 200, "first POST returns 200");
  assert(typeof first.body.executedAt === "number", "first POST has executedAt");

  await new Promise((r) => setTimeout(r, 300));
  const retry = await call("POST", "/api/sync/_test/write", {
    body: { hello: "world" },
    idemKey: key,
  });
  assert(retry.status === 200, "retry returns 200");
  assert(retry.replayed === true, "retry has Idempotent-Replayed: true header");
  assert(
    retry.body.executedAt === first.body.executedAt,
    "retry returns same executedAt (proves replay, not re-execution)"
  );

  const second = await call("POST", "/api/sync/_test/write", {
    body: { hello: "again" },
    idemKey: randomUUID(),
  });
  assert(second.status === 200, "new key POST returns 200");
  assert(
    second.body.executedAt !== first.body.executedAt,
    "new key produces different executedAt (fresh execution)"
  );

  const noKey = await call("POST", "/api/sync/_test/write", { body: {} });
  assert(noKey.status === 400, "missing Idempotency-Key rejected with 400");

  console.log("\n🎉 Step 2 harness passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});