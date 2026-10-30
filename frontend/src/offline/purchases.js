import {
  nowIso,
  safeDecode,
  patchCachedCollections,
  patchDedicatedRecord,
  upsertDedicatedRecord,
  httpRowsForBasePath,
  getCachedByModuleAndId,
  rewriteQueuedReferences,
} from "./cache.js";

/* ─────────────── cache helpers ─────────────── */

async function getCachedPurchase(purchaseId) {
  const { db, openDb } = await import("../db/database.js");
  await openDb();
  const id = String(purchaseId);

  const dedicated = await db.cachedRecords
    .where("[module+recordId]")
    .equals(["rawPurchases", id])
    .first();

  if (
    dedicated?.data &&
    (dedicated.data.__pending || id.startsWith("pending:"))
  ) {
    return dedicated.data;
  }

  for (const row of await httpRowsForBasePath("/raw-material/purchases")) {
    const list = row.data?.data;
    if (!Array.isArray(list)) continue;
    const found = list.find((it) => String(it?._id) === id);
    if (found) return found;
  }
  return dedicated?.data ?? null;
}

async function patchRawPurchaseCaches(purchaseId, updater) {
  const { db, openDb } = await import("../db/database.js");
  const id = String(purchaseId || "");
  if (!id) return;
  await openDb();

  await db.transaction("rw", db.cachedRecords, async () => {
    const updates = [];

    const dedicated = await db.cachedRecords
      .where("[module+recordId]")
      .equals(["rawPurchases", id])
      .first();
    if (dedicated) {
      const next = updater(dedicated.data);
      if (next) updates.push({ ...dedicated, data: next, updatedAt: nowIso() });
    }

    for (const row of await httpRowsForBasePath("/raw-material/purchases")) {
      const payload = row.data;
      if (!payload || !Array.isArray(payload.data)) continue;
      const nextList = payload.data.map((purchase) =>
        String(purchase?._id) === id ? updater(purchase) : purchase
      );
      updates.push({
        ...row,
        data: { ...payload, data: nextList },
        updatedAt: nowIso(),
      });
    }

    if (updates.length > 0) await db.cachedRecords.bulkPut(updates);
  });
}

/* ─────────────── apply (optimistic) ─────────────── */

export async function applyCreate({ data, operationId }) {
  const materialId =
    typeof data?.material === "object" ? data.material?._id : data?.material;

  const stock = materialId
    ? await getCachedByModuleAndId("rawStock", "/raw-material", materialId)
    : null;

  const quantity = Number(data?.quantity) || 0;
  const unitPrice = Number(data?.unitPrice) || 0;
  const totalAmount = quantity * unitPrice;

  const optimistic = {
    ...(data || {}),
    _id: `pending:${operationId}`,
    __opId: operationId,
    __pending: true,
    material: stock
      ? {
          _id: stock._id,
          name: stock.name,
          category: stock.category,
          sizeKg: stock.sizeKg,
          unit: stock.unit,
        }
      : data?.material,
    unit: stock?.unit || data?.unit,
    quantity,
    unitPrice,
    totalAmount,
    amountPaid: 0,
    remainingAmount: totalAmount,
    paymentStatus: "Pending",
    payments: [],
    status: "Pending",
    orderedAt: data?.orderedAt || nowIso(),
    createdAt: nowIso(),
  };

  await patchCachedCollections("/raw-material/purchases", (list) => [
    optimistic,
    ...list.filter((it) => it.__opId !== operationId),
  ]);
  await upsertDedicatedRecord("rawPurchases", optimistic);
  return optimistic;
}

export async function applyEdit({ id, data }) {
  const purchase = await getCachedPurchase(id);
  if (!purchase)
    throw new Error(
      "Purchase is not cached. Open it while online before editing it offline."
    );
  if (purchase.status !== "Pending") {
    throw new Error("Only pending purchases can be edited.");
  }

  const quantity =
    data?.quantity !== undefined
      ? Number(data.quantity)
      : Number(purchase.quantity);
  const unitPrice =
    data?.unitPrice !== undefined
      ? Number(data.unitPrice)
      : Number(purchase.unitPrice);

  const totalAmount = quantity * unitPrice;
  const amountPaid = Number(purchase.amountPaid || 0);

  const sameSupplier =
    String(data?.supplier || "") ===
    String(purchase.supplier?._id || purchase.supplier || "");

  const updated = {
    ...purchase,
    ...(data || {}),
    supplier: sameSupplier ? purchase.supplier : data?.supplier ?? null,
    quantity,
    unitPrice,
    totalAmount,
    remainingAmount: Math.max(0, totalAmount - amountPaid),
    __pending: true,
  };

  await upsertDedicatedRecord("rawPurchases", updated);
  await patchRawPurchaseCaches(id, () => updated);
  return updated;
}

export async function applyAction({
  purchaseId,
  action,
  operationId,
  data,
  paymentId,
}) {
  const purchase = await getCachedPurchase(purchaseId);
  if (!purchase) {
    throw new Error(
      "Purchase is not cached. Open the purchase while online before editing it offline."
    );
  }

  if (action === "receive" && purchase.status === "Received") return purchase;
  if (action === "receive" && purchase.status !== "Pending") {
    throw new Error(`Cannot receive purchase with status "${purchase.status}".`);
  }
  if (
    (action === "payment" || action === "deletePayment") &&
    purchase.status === "Cancelled"
  ) {
    throw new Error("Cannot modify payments on a cancelled purchase.");
  }

  let updatedPurchase;

  if (action === "receive") {
    const materialId =
      typeof purchase.material === "object"
        ? purchase.material?._id
        : purchase.material;
    if (!materialId)
      throw new Error("The cached purchase has no material ID.");

    const receivedQty = Number(purchase.quantity);
    if (!Number.isFinite(receivedQty) || receivedQty <= 0) {
      throw new Error("The purchase quantity is invalid.");
    }

    let stockUpdated = false;
    const receiveMovement = (beforeQty, unit) => ({
      type: "purchase-received",
      quantity: receivedQty,
      unitAtTime: purchase.unit || unit,
      beforeQty,
      afterQty: beforeQty + receivedQty,
      reason: "Purchase received (offline)",
      refType: "Purchase",
      refId: String(purchase._id),
      refLabel: purchase.purchaseNumber || String(purchase._id),
      at: nowIso(),
      localOperationId: operationId,
      pendingSync: true,
    });

    await patchCachedCollections("/raw-material", (list) =>
      list.map((stock) => {
        if (String(stock?._id) !== String(materialId)) return stock;
        const beforeQty = Number(stock.quantity);
        if (!Number.isFinite(beforeQty)) {
          throw new Error("Cached raw-stock quantity is invalid.");
        }
        stockUpdated = true;
        return {
          ...stock,
          quantity: beforeQty + receivedQty,
          lastReceivedAt: nowIso(),
          movementLog: [
            ...(Array.isArray(stock.movementLog) ? stock.movementLog : []),
            receiveMovement(beforeQty, stock.unit),
          ],
        };
      })
    );

    await patchDedicatedRecord("rawStock", materialId, (stock) => {
      const beforeQty = Number(stock?.quantity);
      if (!Number.isFinite(beforeQty)) {
        throw new Error("Cached raw-stock quantity is invalid.");
      }
      stockUpdated = true;
      return {
        ...stock,
        quantity: beforeQty + receivedQty,
        lastReceivedAt: nowIso(),
        movementLog: [
          ...(Array.isArray(stock.movementLog) ? stock.movementLog : []),
          receiveMovement(beforeQty, stock.unit),
        ],
      };
    });

    if (!stockUpdated) {
      throw new Error(
        "The raw-stock record is not cached. Refresh raw materials while online before receiving this purchase offline."
      );
    }

    updatedPurchase = {
      ...purchase,
      status: "Received",
      receivedAt: nowIso(),
      __pending: true,
      __pendingReceive: true,
      __pendingActionId: operationId,
    };
  } else if (action === "payment") {
    const amount = Number(data?.amount);
    const total = Number(purchase.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }
    if (!Number.isFinite(total) || total < 0) {
      throw new Error("Cached purchase total is invalid.");
    }

    const payments = Array.isArray(purchase.payments) ? purchase.payments : [];
    if (payments.some((p) => p?.localOperationId === operationId)) return purchase;

    const paidBefore = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    if (amount > total - paidBefore + 0.01) {
      throw new Error("Payment exceeds the remaining balance.");
    }

    const amountPaid = paidBefore + amount;
    const paymentStatus =
      amountPaid <= 0 ? "Pending" : amountPaid + 0.01 < total ? "Partial" : "Paid";

    updatedPurchase = {
      ...purchase,
      payments: [
        ...payments,
        {
          _id: `pending:${operationId}`,
          amount,
          paidAt: nowIso(),
          method: data?.method,
          transactionId: data?.transactionId,
          chequeNumber: data?.chequeNumber,
          bankName: data?.bankName,
          notes: data?.notes,
          localOperationId: operationId,
          pendingSync: true,
        },
      ],
      amountPaid,
      paymentStatus,
      remainingAmount: Math.max(0, total - amountPaid),
      __pending: true,
      __pendingPayment: true,
      __pendingActionId: operationId,
    };
  } else if (action === "cancel") {
    if (purchase.status === "Cancelled") return purchase;
    if (purchase.status !== "Pending") {
      throw new Error(`Cannot cancel purchase with status "${purchase.status}".`);
    }
    updatedPurchase = {
      ...purchase,
      status: "Cancelled",
      __pending: true,
      __pendingActionId: operationId,
    };
  } else if (action === "deletePayment") {
    if (!paymentId) throw new Error("Payment ID is missing.");
    const payments = Array.isArray(purchase.payments) ? purchase.payments : [];
    const paymentToDelete = payments.find(
      (p) => String(p?._id) === String(paymentId)
    );
    if (!paymentToDelete) {
      throw new Error(
        "Payment is not in the cached purchase. Refresh purchases while online before deleting it offline."
      );
    }
    if (
      paymentToDelete.pendingSync ||
      paymentToDelete.localOperationId ||
      String(paymentToDelete._id).startsWith("pending:")
    ) {
      throw new Error(
        "This payment has not synced yet. Wait for it to sync before deleting it."
      );
    }

    const total = Number(purchase.totalAmount);
    if (!Number.isFinite(total) || total < 0) {
      throw new Error("Cached purchase total is invalid.");
    }

    const remainingPayments = payments.filter(
      (p) => String(p?._id) !== String(paymentId)
    );
    const amountPaid = remainingPayments.reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const paymentStatus =
      amountPaid <= 0 ? "Pending" : amountPaid + 0.01 < total ? "Partial" : "Paid";

    updatedPurchase = {
      ...purchase,
      payments: remainingPayments,
      amountPaid,
      paymentStatus,
      remainingAmount: Math.max(0, total - amountPaid),
      __pending: true,
      __pendingPayment: true,
      __pendingActionId: operationId,
    };
  } else {
    return null;
  }

  await upsertDedicatedRecord("rawPurchases", updatedPurchase);
  await patchRawPurchaseCaches(purchaseId, () => updatedPurchase);
  return updatedPurchase;
}

/* ─────────────── reconcile ─────────────── */

export async function reconcileCreate({ url, operationId, response }) {
  const path = String(url || "").split("?")[0];
  if (!/^\/raw-material\/purchases\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  await patchCachedCollections(url, (list) =>
    list.map((it) =>
      it.__opId === operationId
        ? { ...created, __pending: false, __opId: undefined }
        : it
    )
  );

  const temporaryId = `pending:${operationId}`;
  const realId = String(created._id);
  await rewriteQueuedReferences(temporaryId, realId);
  await removeDedicatedRecordSafe("rawPurchases", temporaryId);
  await upsertDedicatedRecord("rawPurchases", {
    ...created,
    __pending: false,
    __opId: undefined,
  });
}

async function removeDedicatedRecordSafe(module, id) {
  const { removeDedicatedRecord } = await import("./cache.js");
  await removeDedicatedRecord(module, id);
}

export async function reconcileEdit({ url, method, response }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(/^\/raw-material\/purchases\/([^/]+)\/?$/);
  if (!m || !["PUT", "PATCH"].includes(String(method || "").toUpperCase())) return;

  const id = safeDecode(m[1]);
  const returned = response?.data?.data;
  let result = null;

  await patchRawPurchaseCaches(id, (current) => {
    if (!current) return current;
    const next = { ...current };
    if (returned?._id && String(returned._id) === id) {
      Object.assign(next, returned);
      if (typeof returned.material !== "object") next.material = current.material;
      if (typeof returned.supplier !== "object") next.supplier = current.supplier;
    }
    next.__pending = Boolean(current.__pendingActionId);
    result = next;
    return next;
  });

  if (result) await upsertDedicatedRecord("rawPurchases", result);
}

export async function reconcileAction({ url, operationId, response }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(
    /^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)(?:\/([^/]+))?\/?$/
  );
  if (!m) return;

  const purchaseId = safeDecode(m[1]);
  const action = m[2] === "receive" ? "receive" : m[2] === "cancel" ? "cancel" : m[3] ? "deletePayment" : "payment";
  const paymentId = action === "deletePayment" ? safeDecode(m[3]) : null;

  const result = response?.data?.data;
  const returnedPurchase =
    result?.purchase ||
    (String(result?._id || "") === String(purchaseId) ? result : null);

  if (!returnedPurchase && action !== "deletePayment") {
    throw new Error(
      "Server response did not contain the updated purchase; keeping the operation for reconciliation."
    );
  }

  let reconciledPurchase = null;

  await patchRawPurchaseCaches(purchaseId, (current) => {
    if (!current) return current;
    if (
      current.__pendingActionId &&
      current.__pendingActionId !== operationId
    ) {
      reconciledPurchase = current;
      return current;
    }

    let next;
    if (returnedPurchase) {
      next = { ...returnedPurchase };
    } else {
      if (!paymentId) throw new Error("Payment ID missing during reconciliation.");
      const payments = Array.isArray(current.payments) ? current.payments : [];
      if (!payments.some((p) => String(p?._id) === String(paymentId))) {
        throw new Error("Payment not found in cached purchase.");
      }
      const remaining = payments.filter(
        (p) => String(p?._id) !== String(paymentId)
      );
      const total = Number(current.totalAmount);
      if (!Number.isFinite(total) || total < 0) {
        throw new Error("Cached purchase total is invalid during reconciliation.");
      }
      const amountPaid = remaining.reduce((s, p) => s + Number(p.amount || 0), 0);
      const paymentStatus =
        amountPaid <= 0
          ? "Pending"
          : amountPaid + 0.01 < total
          ? "Partial"
          : "Paid";
      next = {
        ...current,
        payments: remaining,
        amountPaid,
        paymentStatus,
        remainingAmount: Math.max(0, total - amountPaid),
      };
    }

    next.__pending = false;
    next.__pendingReceive = false;
    next.__pendingPayment = false;
    delete next.__pendingActionId;
    reconciledPurchase = next;
    return next;
  });

  if (reconciledPurchase) {
    await upsertDedicatedRecord("rawPurchases", reconciledPurchase);
  }

  if (action === "receive" && returnedPurchase) {
    const material = returnedPurchase.material;
    const materialId = typeof material === "object" ? material?._id : material;
    const authoritativeQty =
      typeof material === "object" ? Number(material?.quantity) : NaN;

    if (materialId && Number.isFinite(authoritativeQty)) {
      const stripMovement = (stock) => ({
        ...stock,
        quantity: authoritativeQty,
        lastReceivedAt: material.lastReceivedAt || stock.lastReceivedAt,
        movementLog: (stock.movementLog || []).map((mv) =>
          mv.localOperationId === operationId ? { ...mv, pendingSync: false } : mv
        ),
      });

      await patchDedicatedRecord("rawStock", materialId, (stock) =>
        stock ? stripMovement(stock) : stock
      );
      await patchCachedCollections("/raw-material", (list) =>
        list.map((stock) =>
          String(stock?._id) === String(materialId) ? stripMovement(stock) : stock
        )
      );
    }
  }
}

export async function clearFailedAction(row) {
  const m = String(row.url || "")
    .split("?")[0]
    .match(/^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)/);
  if (!m) return;

  const purchaseId = safeDecode(m[1]);

  await patchRawPurchaseCaches(purchaseId, (purchase) => {
    if (!purchase) return purchase;
    if (purchase.__pendingActionId !== row.operationId) return purchase;
    const next = { ...purchase };
    delete next.__pendingActionId;
    delete next.__pendingReceive;
    delete next.__pendingPayment;
    next.__pending = false;
    return next;
  });
}