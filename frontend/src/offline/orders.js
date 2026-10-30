import {
  nowIso,
  safeDecode,
  listKeyOf, 
  getCachedByModuleAndId,
  patchCachedCollections,
  upsertDedicatedRecord,
  removeDedicatedRecord,
  getHttpRowByBasePath,
  rewriteQueuedReferences,
  patchDedicatedRecordsByModule,
} from "./cache.js";

const STOCK_DEDUCTED = new Set([
  "Confirmed",
  "In Production",
  "Ready for Dispatch",
  "Dispatched",
  "Delivered",
]);

/* ─────────────── cache helpers ─────────────── */

export function getCachedOrder(id) {
  return getCachedByModuleAndId("orders", "/orders", id);
}

async function patchOrderCaches(id, updater) {
  const strId = String(id);
  const { db, openDb } = await import("../db/database.js");
  await openDb();

  await db.transaction("rw", db.cachedRecords, async () => {
    const updates = [];

    const dedicated = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["orders", strId])
      .first();
    if (dedicated) {
      const next = updater(dedicated.data);
      if (next) updates.push({ ...dedicated, data: next, updatedAt: nowIso() });
    }

    const httpRows = await db.cachedRecords
      .where("module")
      .equals("http")
      .toArray()
      .catch(() => []);
    for (const row of httpRows) {
      const base = String(row.recordId || "").split("?")[0];
      if (!/\/orders\/?$/.test(base)) continue;
      const key = listKeyOf(row.data);
      if (!key) continue;
      updates.push({
        ...row,
        data: {
          ...row.data,
          [key]: row.data[key].map((o) =>
            String(o?._id) === strId ? updater(o) || o : o
          ),
        },
        updatedAt: nowIso(),
      });
    }

    if (updates.length > 0) await db.cachedRecords.bulkPut(updates);
  });
}

function recalcOrder(order, overrides = {}) {
  const items = (overrides.items ?? order.items ?? []).map((it) => {
    const q = Number(it.quantity) || 0;
    const r = Number(it.rate) || 0;
    const d = Number(it.discount) || 0;
    return { ...it, amount: Math.max(0, q * r - d) };
  });
  const discount = Number(overrides.discount ?? order.discount ?? 0);
  const taxPercent = Number(overrides.taxPercent ?? order.taxPercent ?? 0);
  const subTotal = items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const taxable = Math.max(0, subTotal - discount);
  const taxAmount = taxable * (taxPercent / 100);
  return {
    ...order,
    ...overrides,
    items,
    subTotal,
    discount,
    taxPercent,
    taxAmount,
    grandTotal: taxable + taxAmount,
  };
}

/* ─────────────── apply (optimistic) ─────────────── */

export async function applyCreate({ data, operationId }) {
  const shortId = String(operationId)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  const now = nowIso();

  let contact = data?.contact;
  if (contact && typeof contact !== "object") {
    const { getCachedByModuleAndId: getById } = await import("./cache.js");
    const found = await getById("contacts", "/contacts", contact);
    if (found) contact = found;
  }

  if (!contact && (data?.customerName || data?.customerPhone)) {
    contact = {
      _id: `pending-contact:${operationId}`,
      name: data.customerName,
      company: data.customerName,
      phone: data.customerPhone,
      role: "customer",
    };
  }

  const base = {
    ...(data || {}),
    _id: `pending:${operationId}`,
    __opId: operationId,
    __pending: true,
    orderNumber: `PO-NEW-${shortId}`,
    orderDate: now,
    status: "Draft",
    contact,
    amountPaid: 0,
    paymentStatus: "Pending",
    createdAt: now,
  };

  const optimistic = recalcOrder(base);

  await patchCachedCollections("/orders", (list) => [
    optimistic,
    ...list.filter((o) => o.__opId !== operationId),
  ]);
  await upsertDedicatedRecord("orders", optimistic);
  return optimistic;
}

export async function applyUpdate({ id, data, operationId }) {
  const existing = await getCachedOrder(id);
  if (!existing)
    throw new Error("Order not cached — open it once online first.");

  const updated = {
    ...recalcOrder(existing, data),
    __pending: true,
    __opId: operationId,
  };

  await patchOrderCaches(id, () => updated);
  await upsertDedicatedRecord("orders", updated);
  return updated;
}

export async function applyStatus({ id, data, operationId }) {
  const newStatus = data?.status;
  const order = await getCachedOrder(id);
  if (!order)
    throw new Error("Order not cached — open it once online first.");

  const wasDeducted = STOCK_DEDUCTED.has(order.status);
  const willDeduct = STOCK_DEDUCTED.has(newStatus);
  let stockDeductedAt = order.stockDeductedAt;
  let deltaSign = 0;

  if (!wasDeducted && willDeduct) {
    deltaSign = -1;
    stockDeductedAt = nowIso();
  } else if (wasDeducted && newStatus === "Cancelled") {
    deltaSign = +1;
    stockDeductedAt = null;
  }

  if (deltaSign !== 0) {
    const sizeNum = (v) => {
      const n = parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? n : NaN;
    };
    const kgOf = (s) => (Number.isFinite(Number(s.sizeKg)) ? Number(s.sizeKg) : sizeNum(s.size));

    // total qty needed per reel size
    const need = new Map();
    for (const item of order.items || []) {
      const kg = sizeNum(item.size);
      const qty = Number(item.quantity) || 0;
      if (Number.isFinite(kg) && qty) need.set(kg, (need.get(kg) || 0) + qty);
    }

    const adjust = (s) => {
      const qty = need.get(kgOf(s));
      if (!qty) return s;
      const delta = deltaSign * qty;
      const adj = (f) => (s[f] !== undefined ? { [f]: Math.max(0, Number(s[f] || 0) + delta) } : {});
      return { ...s, ...adj("quantity"), ...adj("freeQty"), __pending: true };
    };

    let touched = 0;
    await patchCachedCollections("/products/stock", (list) =>
      list.map((s) => { const n = adjust(s); if (n !== s) touched++; return n; })
    );
    await patchDedicatedRecordsByModule(
      "productStock",
      (s) => need.has(kgOf(s)),
      (s) => adjust(s)
    );
    console.log("[offline] stock rows patched:", touched, "needed:", [...need]);
  }

  const updated = {
    ...order,
    status: newStatus,
    stockDeductedAt,
    ...(newStatus === "Dispatched" && !order.dispatchedDate
      ? { dispatchedDate: nowIso() }
      : {}),
    ...(newStatus === "Delivered" && !order.deliveredDate
      ? { deliveredDate: nowIso() }
      : {}),
    __pending: true,
    __opId: operationId,
  };

  await patchOrderCaches(id, () => updated);
  await upsertDedicatedRecord("orders", updated);
  return updated;
}

export async function applyDelete({ id }) {
    await patchCachedCollections("/orders", (list) =>
    list.filter((o) => String(o._id) !== String(id))
  );
  await removeDedicatedRecord("orders", id);
  return null;
}

export async function applyPaymentCreate({ data, operationId }) {
  const orderId = data?.order;
  if (!orderId) return null;

  const order = await getCachedOrder(orderId);
  if (!order)
    throw new Error("Order not cached — open it once online first.");

  const amount = Number(data.amount) || 0;
  const total = Number(order.grandTotal) || 0;
  const amountPaid = Number(order.amountPaid || 0) + amount;
  const paymentStatus =
    amountPaid >= total ? "Paid" : amountPaid > 0 ? "Partial" : "Pending";

  const updatedOrder = {
    ...order,
    amountPaid,
    paymentStatus,
    __pending: true,
    __opId: operationId,
  };

  const optimisticPayment = {
    ...data,
    _id: `pending:${operationId}`,
    order: orderId,
    __opId: operationId,
    __pending: true,
    createdAt: nowIso(),
  };

  await patchOrderCaches(orderId, () => updatedOrder);
  await upsertDedicatedRecord("orders", updatedOrder);

  await patchCachedCollections("/payments", (list) => [
    optimisticPayment,
    ...list.filter((p) => p.__opId !== operationId),
  ]);
  await upsertDedicatedRecord("payments", optimisticPayment);

  return optimisticPayment;
}

function withContact(created, optimisticContact) {
  if (created.contact && typeof created.contact === "object") return created;
  if (!optimisticContact || typeof optimisticContact !== "object") return created;
  return {
    ...created,
    contact: { ...optimisticContact, _id: created.contact || optimisticContact._id },
  };
}

/* ─────────────── reconcile ─────────────── */

async function fixOrderReferences(tempId, realId) {
  await patchCachedCollections("/payments", (list) =>
    list.map((p) =>
      String(p.order) === tempId || String(p.order?._id) === tempId
        ? { ...p, order: realId }
        : p
    )
  );
  await patchDedicatedRecordsByModule(
    "payments",
    (p) => String(p?.order?._id || p?.order || "") === tempId,
    (p) => ({ ...p, order: realId })
  );
}

function mergeReturned(current, returned) {
  const next = {
    ...(current || {}),
    ...returned,
    __pending: false,
    __opId: undefined,
  };
  if (returned.contact && typeof returned.contact !== "object") {
    next.contact = current?.contact;
  }
  if (returned.enquiry && typeof returned.enquiry !== "object") {
    next.enquiry = current?.enquiry;
  }
  return next;
}

export async function reconcileCreate({ url, operationId, response }) {
  const path = String(url || "").split("?")[0];
  if (!/^\/orders?\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  const temporaryId = `pending:${operationId}`;
  const realId = String(created._id);

  // read the optimistic order BEFORE it gets removed
  const optimistic = await getCachedOrder(temporaryId).catch(() => null);

  await rewriteQueuedReferences(temporaryId, realId);
  await fixOrderReferences(temporaryId, realId);
  await removeDedicatedRecord("orders", temporaryId);

  await patchCachedCollections("/orders", (list) =>
    list.map((o) =>
      o.__opId === operationId
        ? {
            ...withContact(created, o.contact || optimistic?.contact),
            __pending: false,
            __opId: undefined,
          }
        : o
    )
  );
  await upsertDedicatedRecord("orders", {
    ...withContact(created, optimistic?.contact),
    __pending: false,
    __opId: undefined,
  });
}

export async function reconcileUpdate({ url, method, response }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(/^\/orders?\/([^/]+)\/?$/);
  if (!m || !["PUT", "PATCH"].includes(String(method || "").toUpperCase()))
    return;

  const id = safeDecode(m[1]);
  const returned = response?.data?.data;
  if (!returned?._id) return;

  const realId = String(returned._id);

  if (id.startsWith("pending:")) {
    await rewriteQueuedReferences(id, realId);
    await fixOrderReferences(id, realId);
    await removeDedicatedRecord("orders", id);
  }

  let reconciled = null;
  await patchOrderCaches(realId, (current) => {
    reconciled = mergeReturned(current, returned);
    return reconciled;
  });
  if (reconciled) await upsertDedicatedRecord("orders", reconciled);
}

export async function reconcileStatus({ url, response }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(/^\/orders?\/([^/]+)\/status\/?$/);
  if (!m) return;

  const id = safeDecode(m[1]);
  const returned = response?.data?.data;
  if (!returned?._id) return;

  const realId = String(returned._id);

  if (id.startsWith("pending:")) {
    await rewriteQueuedReferences(id, realId);
    await fixOrderReferences(id, realId);
    await removeDedicatedRecord("orders", id);
  }

  let reconciled = null;
  await patchOrderCaches(realId, (current) => {
    reconciled = mergeReturned(current, returned);
    return reconciled;
  });
  if (reconciled) await upsertDedicatedRecord("orders", reconciled);
}

export async function reconcileDelete({ url }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(/^\/orders?\/([^/]+)\/?$/);
  if (!m) return;

  const id = safeDecode(m[1]);
  await patchCachedCollections("/orders", (list) =>
    list.filter((o) => String(o._id) !== id)
  );
  await removeDedicatedRecord("orders", id);
}

export async function reconcilePaymentCreate({ url, method, operationId, response }) {
  const path = String(url || "").split("?")[0];
  if (String(method || "").toUpperCase() !== "POST") return;
  if (!/^\/payments?\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  await patchCachedCollections("/payments", (list) =>
    list.map((p) =>
      p.__opId === operationId
        ? { ...created, __pending: false, __opId: undefined }
        : p
    )
  );

  await removeDedicatedRecord("payments", `pending:${operationId}`);
  await upsertDedicatedRecord("payments", {
    ...created,
    __pending: false,
    __opId: undefined,
  });

  const orderId = created.order?._id || created.order;
  if (orderId) {
    await patchOrderCaches(orderId, (current) =>
      current ? { ...current, __pending: false } : current
    );
    const updated = await getCachedOrder(orderId);
    if (updated) await upsertDedicatedRecord("orders", updated);
  }
}