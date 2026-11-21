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
  listDedicatedRecords,
} from "./cache.js";

import { getPaymentsFromCache } from "./reads.js";

const STOCK_DEDUCTED = new Set([
  "Confirmed",
  "In Production",
  "Ready for Dispatch",
  "Dispatched",
  "Delivered",
]);

/* ─────────────── cache helpers ─────────────── */

export function getCachedOrder(id) {
  return getCachedByModuleAndId("orders", "/order", id);
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
  const orderId = data?.order?._id || data?.order;

  if (!orderId) {
    throw new Error("Valid order ID is required.");
  }

  const order = await getCachedOrder(orderId);

  if (!order) {
    throw new Error("Order not cached — open it once online first.");
  }

  // Validate amount.
  const amount = Number(data.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 10000000000
  ) {
    throw new Error("Payment amount must be greater than zero.");
  }

  // Validate payment status.
  const status = data.status || "Completed";

  if (!["Pending", "Completed", "Cancelled"].includes(status)) {
    throw new Error("Invalid payment status.");
  }

  // Validate order.
  if (["Draft", "Cancelled"].includes(order.status)) {
    throw new Error(
      `Cannot record a payment for a ${order.status} order.`
    );
  }

  if (!order.contact) {
    throw new Error("Order has no linked contact.");
  }

  // Normalize payment fields the same way as the backend.
  const safeString = (value, maxLength = 500) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : "";
  };

  const validModes = [
    "Bank Transfer",
    "UPI",
    "Cheque",
    "Cash",
    "NEFT",
    "RTGS",
    "Other",
  ];

  const paymentMode = data.paymentMode;

  if (!paymentMode || !validModes.includes(paymentMode)) {
    throw new Error("Invalid payment mode.");
  }

  const transactionId = safeString(data.transactionId, 100);
  const chequeNumber = safeString(data.chequeNumber, 50);
  const bankName = safeString(data.bankName, 150);

  // Cheque validation.
  if (paymentMode === "Cheque") {
    if (!chequeNumber) {
      throw new Error("Cheque number is required.");
    }

    if (!bankName) {
      throw new Error("Bank name is required.");
    }
  }

  // Transaction ID validation.
  const modesRequiringTransactionId = [
    "UPI",
    "NEFT",
    "RTGS",
    "Bank Transfer",
  ];

  if (
    modesRequiringTransactionId.includes(paymentMode) &&
    !transactionId
  ) {
    throw new Error(
      `Transaction ID is required for ${paymentMode}.`
    );
  }

  // Prevent duplicate transaction IDs in cached payments.
  if (transactionId) {
    const cachedPayments = await getPaymentsFromCache();

    const duplicateTransaction = cachedPayments.some((payment) => {
      return (
        String(payment.transactionId || "").trim() === transactionId &&
        payment.__opId !== operationId
      );
    });

    if (duplicateTransaction) {
      throw new Error("Transaction ID already exists.");
    }
  }

  // Validate payment date.
  let paymentDate = nowIso();

  if (
    data.paymentDate !== undefined &&
    data.paymentDate !== null &&
    data.paymentDate !== ""
  ) {
    const parsedDate = new Date(data.paymentDate);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error("Invalid payment date.");
    }

    paymentDate = parsedDate.toISOString();
  }

  // Normalize currency.
  const currency = (
    safeString(data.currency, 3) || "INR"
  ).toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a valid 3-letter code.");
  }

  // Normalize optional fields.
  const paidFrom = safeString(data.paidFrom, 150);
  const notes = safeString(data.notes, 2000);
  const attachmentUrl = safeString(data.attachmentUrl, 500);

  if (
    attachmentUrl &&
    !/^https?:\/\/\S+$/.test(attachmentUrl)
  ) {
    throw new Error("Attachment URL must be a valid http(s) URL.");
  }

  // Calculate existing order balance.
  const total = Number(order.grandTotal) || 0;
  const currentPaid = Number(order.amountPaid) || 0;

  // Match backend validation for existing Pending payments.
  if (status === "Pending") {
    const cachedPayments = await getPaymentsFromCache();

    const existingPending = cachedPayments
      .filter((payment) => {
        const paymentOrderId =
          payment.order?._id || payment.order;

        return (
          payment.status === "Pending" &&
          payment.isActive !== false &&
          String(paymentOrderId) === String(orderId) &&
          payment.__opId !== operationId
        );
      })
      .reduce(
        (sum, payment) => sum + (Number(payment.amount) || 0),
        0
      );

    const remaining =
      total - currentPaid - existingPending;

    if (amount > remaining + 0.01) {
      throw new Error(
        `Pending payments would exceed remaining balance of ₹${remaining.toFixed(2)}`
      );
    }
  }

  // Only Completed payments affect the order balance.
  let amountPaid = currentPaid;

  if (status === "Completed") {
    amountPaid += amount;

    if (amountPaid > total + 0.01) {
      throw new Error(
        "Payment exceeds the remaining order balance."
      );
    }
  }

  const paymentStatus =
    status === "Completed"
      ? amountPaid >= total
        ? "Paid"
        : amountPaid > 0
          ? "Partial"
          : "Pending"
      : order.paymentStatus;

  // Optimistically update the order.
  const updatedOrder = {
    ...order,
    amountPaid,
    paymentStatus,
    __pending: true,
    __opId: operationId,
  };

  // Create optimistic payment.
  const optimisticPayment = {
    ...data,

    _id: `pending:${operationId}`,

    order: {
      ...order,
      _id: orderId,
    },

    contact: order.contact,

    amount,
    currency,
    paymentDate,
    paymentMode,
    paidFrom,
    transactionId,
    chequeNumber,
    bankName,
    notes,
    attachmentUrl,

    status,
    appliedToOrder: status === "Completed",

    isReconciled: false,
    reconciledDate: null,

    __opId: operationId,
    __pending: true,
    createdAt: nowIso(),
  };

  // Update order caches.
  await patchOrderCaches(orderId, () => updatedOrder);
  await upsertDedicatedRecord("orders", updatedOrder);

  // Update payment caches.
  await patchCachedCollections("/payments", (list) => [
    optimisticPayment,
    ...list.filter((payment) => payment.__opId !== operationId),
  ]);

  await upsertDedicatedRecord("payments", optimisticPayment);

  return optimisticPayment;
}


export async function applyPaymentUpdate({ id, data, operationId }) {
  const payment = await getCachedByModuleAndId(
    "payments",
    "/payments",
    id
  );

  if (!payment) {
    throw new Error("Payment not cached — open it once online first.");
  }

  if (payment.isActive === false) {
    throw new Error("Cannot update a deleted payment.");
  }

  const orderId = payment.order?._id || payment.order;

  if (!orderId) {
    throw new Error("Payment has no linked order.");
  }

  const order = await getCachedOrder(orderId);

  if (!order) {
    throw new Error("Order not cached — open it once online first.");
  }

  const safeString = (value, maxLength = 500) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
  };

  // Match backend status validation.
  const previousStatus = payment.status || "Completed";
  const nextStatus = data?.status ?? previousStatus;

  if (!["Pending", "Completed", "Cancelled"].includes(nextStatus)) {
    throw new Error("Invalid payment status.");
  }

  // Match backend payment-mode validation.
  const validModes = [
    "Bank Transfer",
    "UPI",
    "Cheque",
    "Cash",
    "NEFT",
    "RTGS",
    "Other",
  ];

  const finalMode =
    data?.paymentMode !== undefined
      ? data.paymentMode
      : payment.paymentMode;

  if (!validModes.includes(finalMode)) {
    throw new Error("Invalid payment mode.");
  }

  const finalTxnId =
    data?.transactionId !== undefined
      ? safeString(data.transactionId, 100)
      : payment.transactionId;

  const finalCheque =
    data?.chequeNumber !== undefined
      ? safeString(data.chequeNumber, 50)
      : payment.chequeNumber;

  const finalBank =
    data?.bankName !== undefined
      ? safeString(data.bankName, 150)
      : payment.bankName;

  if (finalMode === "Cheque") {
    if (!finalCheque) {
      throw new Error("Cheque number is required for cheque payments.");
    }

    if (!finalBank) {
      throw new Error("Bank name is required for cheque payments.");
    }
  }

  if (
    ["UPI", "NEFT", "RTGS", "Bank Transfer"].includes(finalMode) &&
    !finalTxnId
  ) {
    throw new Error(`Transaction ID is required for ${finalMode}.`);
  }

  // Check duplicate transaction IDs.
  if (finalTxnId) {
    const cachedPayments = await getPaymentsFromCache();

    const duplicate = cachedPayments.some((item) => {
      return (
        String(item._id) !== String(id) &&
        String(item.transactionId || "").trim() === finalTxnId
      );
    });

    if (duplicate) {
      throw new Error("Transaction ID already exists.");
    }
  }

  // Match backend payment-date behavior.
  let nextPaymentDate = payment.paymentDate;

  if (
    data?.paymentDate !== undefined &&
    data.paymentDate !== null &&
    data.paymentDate !== ""
  ) {
    const parsed = new Date(data.paymentDate);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Invalid payment date.");
    }

    nextPaymentDate = parsed.toISOString();
  }

  const paidFrom =
    data?.paidFrom !== undefined
      ? safeString(data.paidFrom, 150)
      : payment.paidFrom;

  const notes =
    data?.notes !== undefined
      ? safeString(data.notes, 2000)
      : payment.notes;

  const attachmentUrl =
    data?.attachmentUrl !== undefined
      ? safeString(data.attachmentUrl, 500)
      : payment.attachmentUrl;

  if (
    attachmentUrl &&
    !/^https?:\/\/\S+$/.test(attachmentUrl)
  ) {
    throw new Error("Attachment URL must be a valid http(s) URL.");
  }

  // The backend uses appliedToOrder, not just the status,
  // to decide whether the order balance must change.
  const previousApplied = payment.appliedToOrder === true;
  const willApply = nextStatus === "Completed";

  let updatedOrder = order;
  let orderChanged = false;

  const amount = Number(payment.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid payment amount.");
  }

  if (!previousApplied && willApply) {
    if (["Draft", "Cancelled"].includes(order.status)) {
      throw new Error(
        `Cannot complete a payment for a ${order.status} order.`
      );
    }

    const amountPaid = Number(order.amountPaid) || 0;
    const grandTotal = Number(order.grandTotal) || 0;

    if (amountPaid + amount > grandTotal + 0.01) {
      throw new Error(
        "Marking this payment Completed would exceed the order's remaining balance."
      );
    }

    const nextAmountPaid = amountPaid + amount;

    updatedOrder = {
      ...order,
      amountPaid: nextAmountPaid,
      paymentStatus:
        nextAmountPaid >= grandTotal
          ? "Paid"
          : nextAmountPaid > 0
            ? "Partial"
            : "Pending",
      __pending: true,
      __opId: operationId,
    };

    orderChanged = true;
  } else if (previousApplied && !willApply) {
    const amountPaid = Number(order.amountPaid) || 0;

    if (amountPaid + 0.01 < amount) {
      throw new Error(
        "Cannot reverse this payment from the order balance."
      );
    }

    const nextAmountPaid = Math.max(0, amountPaid - amount);
    const grandTotal = Number(order.grandTotal) || 0;

    updatedOrder = {
      ...order,
      amountPaid: nextAmountPaid,
      paymentStatus:
        nextAmountPaid >= grandTotal
          ? "Paid"
          : nextAmountPaid > 0
            ? "Partial"
            : "Pending",
      __pending: true,
      __opId: operationId,
    };

    orderChanged = true;
  }

  // Match backend reconciliation validation and model behavior.
  let nextIsReconciled = payment.isReconciled === true;

  if (data?.isReconciled !== undefined) {
    if (typeof data.isReconciled === "boolean") {
      nextIsReconciled = data.isReconciled;
    } else if (
      data.isReconciled === "true" ||
      data.isReconciled === "false"
    ) {
      nextIsReconciled = data.isReconciled === "true";
    } else {
      throw new Error("isReconciled must be a boolean.");
    }
  }

  let reconciledDate = null;

  if (nextIsReconciled) {
    const suppliedDate = data?.reconciledDate;

    if (
      suppliedDate !== undefined &&
      suppliedDate !== null &&
      suppliedDate !== ""
    ) {
      const parsed = new Date(suppliedDate);

      if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid reconciled date.");
      }

      reconciledDate = parsed.toISOString();
    } else if (payment.reconciledDate) {
      const parsed = new Date(payment.reconciledDate);

      if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid reconciled date.");
      }

      reconciledDate = parsed.toISOString();
    } else {
      reconciledDate = nowIso();
    }
  }

  // Whitelist only the fields accepted by backend updatePayment.
  // Amount, currency, order and contact remain unchanged.
  const updatedPayment = {
    ...payment,
    _id: String(id),
    order: payment.order,
    contact: payment.contact,
    amount: payment.amount,
    currency: payment.currency || "INR",

    paymentMode: finalMode,
    paidFrom,
    transactionId: finalTxnId,
    chequeNumber: finalCheque,
    bankName: finalBank,
    notes,
    paymentDate: nextPaymentDate,
    attachmentUrl,

    status: nextStatus,
    appliedToOrder: willApply,

    isReconciled: nextIsReconciled,
    reconciledDate,

    __pending: true,
    __opId: operationId,
  };

  // Only patch the order when the backend would change it.
  if (orderChanged) {
    await patchOrderCaches(orderId, () => updatedOrder);
    await upsertDedicatedRecord("orders", updatedOrder);
  }

  await patchCachedCollections("/payments", (list) =>
    list.map((item) =>
      String(item._id) === String(id) ? updatedPayment : item
    )
  );

  await upsertDedicatedRecord("payments", updatedPayment);

  return updatedPayment;
}

export async function applyPaymentDelete({ id, operationId }) {
  const payment = await getCachedByModuleAndId(
    "payments",
    "/payments",
    id
  );

  if (!payment) {
    throw new Error("Payment not cached — open it once online first.");
  }

  if (payment.isActive === false) {
    throw new Error("This payment has already been deleted.");
  }

  const orderId = payment.order?._id || payment.order;

  if (!orderId) {
    throw new Error("Payment has no linked order.");
  }

  const order = await getCachedOrder(orderId);

  if (!order) {
    throw new Error("Order not cached — open it once online first.");
  }

  const wasApplied = payment.appliedToOrder === true;
  let updatedOrder = order;

  if (wasApplied) {
    const amount = Number(payment.amount) || 0;
    const amountPaid = Number(order.amountPaid) || 0;

    if (amountPaid + 0.01 < amount) {
      throw new Error(
        "Cannot reverse this payment from the order balance."
      );
    }

    const remainingPaid = Math.max(0, amountPaid - amount);
    const grandTotal = Number(order.grandTotal) || 0;

    updatedOrder = {
      ...order,
      amountPaid: remainingPaid,
      paymentStatus:
        remainingPaid >= grandTotal
          ? "Paid"
          : remainingPaid > 0
            ? "Partial"
            : "Pending",
      __pending: true,
      __opId: operationId,
    };

    await patchOrderCaches(orderId, () => updatedOrder);
    await upsertDedicatedRecord("orders", updatedOrder);
  }

  // Keep a tombstone locally until server reconciliation.
  const deletedPayment = {
    ...payment,
    isActive: false,
    status: "Cancelled",
    appliedToOrder: false,
    deletedAt: nowIso(),
    updatedAt: nowIso(),

    // Preserve information needed during reconciliation.
    __affectedOrderId: String(orderId),
    __wasAppliedToOrder: wasApplied,
    __orderBalanceReversed: wasApplied,

    __pending: true,
    __opId: operationId,
  };

  await patchCachedCollections("/payments", (list) =>
    list.filter((item) => String(item._id) !== String(id))
  );

  await upsertDedicatedRecord("payments", deletedPayment);

  return null;
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
  if (!/\/orders?\/?$/.test(path)) return;

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

export async function reconcileUpdate({ url, method, operationId, response }) {
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

export async function reconcilePaymentCreate({
  url,
  method,
  operationId,
  response,
}) {
  const path = String(url || "").split("?")[0];

  if (String(method || "").toUpperCase() !== "POST") return;

  if (!/^\/(?:api\/)?payments?\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  await patchCachedCollections("/payments", (list) =>
    list.map((p) =>
      p.__opId === operationId
        ? {
            ...created,
            __pending: false,
            __opId: undefined,
          }
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
  const returnedOrder =
  created.order && typeof created.order === "object"
    ? created.order
    : null;

if (orderId) {
  await patchOrderCaches(orderId, (current) => {
    if (!returnedOrder) {
      return current
        ? {
            ...current,
            __pending: false,
            __opId: undefined,
          }
        : current;
    }

    return {
      ...current,
      ...returnedOrder,
      _id: orderId,
      __pending: false,
      __opId: undefined,
    };
  });

  const updatedOrder = await getCachedOrder(orderId);

  if (updatedOrder) {
    await upsertDedicatedRecord("orders", updatedOrder);
  }
}
  }
}


export async function reconcilePaymentDelete({
  url,
  operationId,
}) {
  const path = String(url || "").split("?")[0];

  const match = path.match(
    /^\/(?:api\/)?payments?\/([^/]+)\/?$/
  );

  if (!match) return;

  const id = safeDecode(match[1]);

  const paymentRecords = await listDedicatedRecords("payments");

  const paymentRecord = paymentRecords.find(
    (row) => String(row.recordId) === id
  );

  const payment = paymentRecord?.data;

  const orderId =
    payment?.__affectedOrderId ||
    payment?.order?._id ||
    payment?.order;

  const wasApplied =
    payment?.__wasAppliedToOrder === true ||
    (
      payment?.__wasAppliedToOrder === undefined &&
      payment?.appliedToOrder === true
    );

  const alreadyReversed =
    payment?.__orderBalanceReversed === true;

  // For an online delete, no optimistic reversal happened.
  // Apply the server-confirmed reversal to the local order cache.
  if (orderId && wasApplied && !alreadyReversed) {
    const order = await getCachedOrder(orderId);

    if (order) {
      const amount = Number(payment.amount) || 0;
      const amountPaid = Number(order.amountPaid) || 0;
      const remainingPaid = Math.max(0, amountPaid - amount);
      const grandTotal = Number(order.grandTotal) || 0;

      const updatedOrder = {
        ...order,
        amountPaid: remainingPaid,
        paymentStatus:
          remainingPaid >= grandTotal
            ? "Paid"
            : remainingPaid > 0
              ? "Partial"
              : "Pending",
        __pending: false,
        __opId: undefined,
      };

      await patchOrderCaches(orderId, () => updatedOrder);
      await upsertDedicatedRecord("orders", updatedOrder);
    }
  } else if (orderId) {
    // For an offline delete, only clear the marker if this operation
    // still owns the order's pending state.
    await patchOrderCaches(orderId, (current) => {
      if (current?.__opId !== operationId) {
        return current;
      }

      return {
        ...current,
        __pending: false,
        __opId: undefined,
      };
    });

    const updatedOrder = await getCachedOrder(orderId);

    if (updatedOrder) {
      await upsertDedicatedRecord("orders", updatedOrder);
    }
  }

  // Retain the inactive payment record, but clear its pending state.
  if (payment) {
    const deletedPayment = {
      ...payment,
      isActive: false,
      status: "Cancelled",
      appliedToOrder: false,
      __pending: false,
      __opId: undefined,
      updatedAt: nowIso(),
    };

    await upsertDedicatedRecord("payments", deletedPayment);
  }

  // Never show deleted payments in the HTTP collection.
  await patchCachedCollections("/payments", (list) =>
    list.filter((item) => String(item._id) !== id)
  );
}
