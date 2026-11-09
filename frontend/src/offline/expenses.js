
import {
  nowIso,
  safeDecode,
  listKeyOf,
  getCachedByModuleAndId,
  patchCachedCollections,
  upsertDedicatedRecord,
  removeDedicatedRecord,
  httpRowsForBasePath,
} from "./cache.js";

/* ─────────────── cache helpers ─────────────── */

export function getCachedExpense(id) {
  return getCachedByModuleAndId("expenses", "/expense", id);
}

async function patchExpenseCaches(id, updater) {
  const { db, openDb } = await import("../db/database.js");
  await openDb();

  const strId = String(id);

  await db.transaction("rw", db.cachedRecords, async () => {
    const updates = [];

    const dedicated = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["expenses", strId])
      .first();

    if (dedicated) {
      const next = updater(dedicated.data);
      if (next) {
        updates.push({
          ...dedicated,
          data: next,
          updatedAt: nowIso(),
        });
      }
    }

    for (const row of await httpRowsForBasePath("/expense")) {
      const key = listKeyOf(row.data);
      if (!key || !Array.isArray(row.data[key])) continue;

      updates.push({
        ...row,
        data: {
          ...row.data,
          [key]: row.data[key].map((expense) =>
            String(expense?._id) === strId
              ? updater(expense) || expense
              : expense
          ),
        },
        updatedAt: nowIso(),
      });
    }

    if (updates.length) {
      await db.cachedRecords.bulkPut(updates);
    }
  });
}

/* ─────────────── apply (optimistic) ─────────────── */

export async function applyCreate({ data, operationId }) {
  const now = nowIso();

  const optimistic = {
    ...(data || {}),
    _id: `pending:${operationId}`,
    __opId: operationId,
    __pending: true,
    amount: Number(data?.amount) || 0,
    paymentStatus: data?.paymentStatus || "Pending",
    paymentMethod:
      data?.paymentStatus === "Paid" ? data?.paymentMethod || null : null,
    transactionId:
      data?.paymentStatus === "Paid" ? data?.transactionId || null : null,
    createdAt: now,
  };

  await patchCachedCollections("/expense", (list) => [
    optimistic,
    ...list.filter((expense) => expense.__opId !== operationId),
  ]);

  await upsertDedicatedRecord("expenses", optimistic);

  return optimistic;
}

export async function applyUpdate({ id, data, operationId }) {
  const expense = await getCachedExpense(id);

  if (!expense) {
    throw new Error(
      "Expense is not cached. Open Expenses while online before editing it offline."
    );
  }

  const updated = {
    ...expense,
    ...(data || {}),
    amount:
      data?.amount !== undefined
        ? Number(data.amount) || 0
        : Number(expense.amount) || 0,
    paymentMethod:
      data?.paymentStatus === "Pending"
        ? null
        : data?.paymentMethod ?? expense.paymentMethod ?? null,
    transactionId:
      data?.paymentStatus === "Pending"
        ? null
        : data?.transactionId ?? expense.transactionId ?? null,
    __pending: true,
    __opId: operationId,
  };

  await patchExpenseCaches(id, () => updated);
  await upsertDedicatedRecord("expenses", updated);

  return updated;
}

export async function applyMarkPaid({ id, data, operationId }) {
  const expense = await getCachedExpense(id);

  if (!expense) {
    throw new Error(
      "Expense is not cached. Open Expenses while online before recording its payment offline."
    );
  }

  if (expense.paymentStatus === "Paid") {
    return expense;
  }

  const updated = {
    ...expense,
    paymentStatus: "Paid",
    paymentMethod: data?.paymentMethod,
    transactionId:
      data?.paymentMethod === "UPI"
        ? String(data?.transactionId || "").trim()
        : null,
    paidAt: nowIso(),
    __pending: true,
    __opId: operationId,
  };

  await patchExpenseCaches(id, () => updated);
  await upsertDedicatedRecord("expenses", updated);

  return updated;
}

export async function applyDelete({ id }) {
  const expense = await getCachedExpense(id);

  if (expense?.paymentStatus === "Paid") {
    throw new Error("Paid expenses cannot be deleted.");
  }

  await patchCachedCollections("/expense", (list) =>
    list.filter((item) => String(item._id) !== String(id))
  );

  await removeDedicatedRecord("expenses", id);

  return null;
}

/* ─────────────── reconcile ─────────────── */

export async function reconcileCreate({ url, operationId, response }) {
  const path = String(url || "").split("?")[0];

  if (!/^\/expense\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  const temporaryId = `pending:${operationId}`;

  await patchCachedCollections("/expense", (list) =>
    list.map((expense) =>
      expense.__opId === operationId ||
      String(expense._id) === temporaryId
        ? {
            ...created,
            __pending: false,
            __opId: undefined,
          }
        : expense
    )
  );

  await removeDedicatedRecord("expenses", temporaryId);

  await upsertDedicatedRecord("expenses", {
    ...created,
    __pending: false,
    __opId: undefined,
  });
}

async function reconcileExpense({ id, response }) {
  const returned = response?.data?.data;

  if (!returned || typeof returned !== "object") return;

  let reconciled = null;

  await patchExpenseCaches(id, (current) => {
    if (!current) return current;

    reconciled = {
      ...current,
      ...returned,
      _id: returned._id || current._id,
      __pending: false,
      __opId: undefined,
    };

    return reconciled;
  });

  if (reconciled) {
    await upsertDedicatedRecord("expenses", reconciled);
  }
}

export async function reconcileUpdate({ url, response }) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/expense\/([^/]+)\/?$/);

  if (!match) return;

  const id = safeDecode(match[1]);

  await reconcileExpense({ id, response });
}

export async function reconcileMarkPaid({ url, response }) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/expense\/([^/]+)\/pay\/?$/);

  if (!match) return;

  const id = safeDecode(match[1]);

  await reconcileExpense({ id, response });
}

export async function reconcileDelete({ url }) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/expense\/([^/]+)\/?$/);

  if (!match) return;

  const id = safeDecode(match[1]);

  await patchCachedCollections("/expense", (list) =>
    list.filter((expense) => String(expense._id) !== id)
  );

  await removeDedicatedRecord("expenses", id);
}
