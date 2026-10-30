import {
  nowIso,
  safeDecode,
  getCachedByModuleAndId,
  getHttpRowByBasePath,
  patchCachedCollections,
  upsertDedicatedRecord,
  removeDedicatedRecord,
} from "./cache.js";

const REEL_STEEL_KG = {
  "2kg": 1.8,
  "5kg": 4.4,
  "8kg": 7.3,
  "10kg": 9.3,
};

/* ─────────────── cache helpers ─────────────── */

export function getCachedProduction(id) {
  return getCachedByModuleAndId("productProductions", "/products", id);
}

export function getCachedRawMaterial(id) {
  return getCachedByModuleAndId("rawStock", "/raw-material", id);
}

export function getProductStockItem(id) {
  return getCachedByModuleAndId("productStock", "/products/stock", id);
}

/* ─────────────── raw-stock mutation ─────────────── */

function productionRawDelta(production, sign) {
  const steelInReels =
    sign * Number(production.qty2kg || 0) * REEL_STEEL_KG["2kg"] +
    sign * Number(production.qty5kg || 0) * REEL_STEEL_KG["5kg"] +
    sign * Number(production.qty8kg || 0) * REEL_STEEL_KG["8kg"] +
    sign * Number(production.qty10kg || 0) * REEL_STEEL_KG["10kg"];
  const scrap = sign * Number(production.scrapKg || 0);

  return {
    steelKg: steelInReels + scrap,
    tapeBox: sign * Number(production.tapeUsedBox || 0),
    reels: {
      "2kg": sign * Number(production.qty2kg || 0),
      "5kg": sign * Number(production.qty5kg || 0),
      "8kg": sign * Number(production.qty8kg || 0),
      "10kg": sign * Number(production.qty10kg || 0),
    },
  };
}

function applyStockMovement(stock, delta, operationId) {
  const beforeQty = Number(stock.quantity || 0);
  return {
    ...stock,
    quantity: beforeQty - delta,
    movementLog: [
      ...(Array.isArray(stock.movementLog) ? stock.movementLog : []),
      {
        type: "production-consumed",
        quantity: -delta,
        beforeQty,
        afterQty: beforeQty - delta,
        reason: "Production (offline)",
        localOperationId: operationId,
        pendingSync: true,
        at: nowIso(),
      },
    ],
  };
}

async function patchRawStockFromProduction(production, sign, operationId) {
  const delta = productionRawDelta(production, sign);
  const noChange =
    delta.steelKg === 0 &&
    delta.tapeBox === 0 &&
    Object.values(delta.reels).every((v) => v === 0);
  if (noChange) return;

  const { db, openDb } = await import("../db/database.js");
  await openDb();

  await db.transaction("rw", db.cachedRecords, async () => {
    const rawRow = await getHttpRowByBasePath("/raw-material");
    if (!rawRow || !Array.isArray(rawRow.data?.data)) return;

    const next = rawRow.data.data.map((stock) => {
      if (stock.category === "Steel" && delta.steelKg !== 0) {
        return applyStockMovement(stock, delta.steelKg, operationId);
      }
      if (stock.category === "Tape" && delta.tapeBox !== 0) {
        return applyStockMovement(stock, delta.tapeBox, operationId);
      }
      if (stock.category === "Reel") {
        const sizeKey = `${Number(stock.sizeKg)}kg`;
        const consumed = delta.reels[sizeKey] || 0;
        if (consumed !== 0) {
          return applyStockMovement(stock, consumed, operationId);
        }
      }
      return stock;
    });

    await db.cachedRecords.put({
      ...rawRow,
      data: { ...rawRow.data, data: next },
      updatedAt: nowIso(),
    });

    if (next.length === 0) return;

    const keys = next.map((s) => ["rawStock", String(s._id)]);
    const dedicatedRows = await db.cachedRecords
      .where("[module+recordId]")
      .anyOf(keys)
      .toArray();
    if (dedicatedRows.length > 0) {
      const byId = new Map(next.map((s) => [String(s._id), s]));
      await db.cachedRecords.bulkPut(
        dedicatedRows.map((row) => ({
          ...row,
          data: byId.get(String(row.recordId)) || row.data,
          updatedAt: nowIso(),
        }))
      );
    }
  });
}

function productionReelDelta(production, sign) {
  return {
    "2kg":  sign * Number(production.qty2kg  || 0),
    "5kg":  sign * Number(production.qty5kg  || 0),
    "8kg":  sign * Number(production.qty8kg  || 0),
    "10kg": sign * Number(production.qty10kg || 0),
  };
}

async function patchProductStockFromProduction(production, sign, operationId) {
  const reels = productionReelDelta(production, sign);
  if (Object.values(reels).every((v) => v === 0)) return;

  const { db, openDb } = await import("../db/database.js");
  await openDb();

  await db.transaction("rw", db.cachedRecords, async () => {
    const stockRow = await getHttpRowByBasePath("/products/stock");
    if (!stockRow || !Array.isArray(stockRow.data?.data)) return;

    const next = stockRow.data.data.map((item) => {
      const sizeKey = `${parseFloat(item.size)}kg`; 
      const delta = reels[sizeKey] || 0;
      
      if (delta === 0) return item;

      const before = Number(item.quantity || 0);
      const after  = Math.max(0, before + delta);

      return {
        ...item,
        quantity: after,
        lastReceivedAt: nowIso(),
        movementLog: [
          ...(Array.isArray(item.movementLog) ? item.movementLog : []),
          {
            type: sign >= 0 ? "production-added" : "production-reversed",
            quantity: delta,
            beforeQty: before,
            afterQty: after,
            reason: "Production (offline)",
            localOperationId: operationId,
            pendingSync: true,
            at: nowIso(),
          },
        ],
      };
    });

    await db.cachedRecords.put({
      ...stockRow,
      data: { ...stockRow.data, data: next },
      updatedAt: nowIso(),
    });

    const keys = next.map((s) => ["productStock", String(s._id)]);
    const dedicatedRows = await db.cachedRecords
      .where("[module+recordId]")
      .anyOf(keys)
      .toArray();
    if (dedicatedRows.length > 0) {
      const byId = new Map(next.map((s) => [String(s._id), s]));
      await db.cachedRecords.bulkPut(
        dedicatedRows.map((row) => ({
          ...row,
          data: byId.get(String(row.recordId)) || row.data,
          updatedAt: nowIso(),
        }))
      );
    }
  });
}

/* ─────────────── production apply ─────────────── */

export async function applyProductionCreate({ data, operationId }) {
    const optimistic = {
    ...(data || {}),
    _id: `pending:${operationId}`,
    __opId: operationId,
    __pending: true,
    date: data?.date || nowIso(),
    createdAt: nowIso(),
  };

  await patchCachedCollections("/products", (list) => [
    optimistic,
    ...list.filter((it) => it.__opId !== operationId),
  ]);
  await upsertDedicatedRecord("productProductions", optimistic);
  await patchRawStockFromProduction(optimistic, +1, operationId);
  await patchProductStockFromProduction(optimistic, +1, operationId);
  return optimistic;
}

export async function applyProductionEdit({ id, data, operationId }) {
  const existing = await getCachedProduction(id);
  if (!existing) {
    throw new Error(
      "Production entry is not cached. Refresh products while online before editing it offline."
    );
  }

  const updated = {
    ...existing,
    ...(data || {}),
    __pending: true,
    __opId: operationId,
  };

  const diff = {
    qty2kg: (Number(updated.qty2kg) || 0) - (Number(existing.qty2kg) || 0),
    qty5kg: (Number(updated.qty5kg) || 0) - (Number(existing.qty5kg) || 0),
    qty8kg: (Number(updated.qty8kg) || 0) - (Number(existing.qty8kg) || 0),
    qty10kg: (Number(updated.qty10kg) || 0) - (Number(existing.qty10kg) || 0),
    tapeUsedBox:
      (Number(updated.tapeUsedBox) || 0) - (Number(existing.tapeUsedBox) || 0),
    scrapKg: (Number(updated.scrapKg) || 0) - (Number(existing.scrapKg) || 0),
  };
  if (Object.values(diff).some((v) => v !== 0)) {
    await patchRawStockFromProduction(diff, +1, operationId);
    await patchProductStockFromProduction(diff, +1, operationId);
  }

  await patchCachedCollections("/products", (list) =>
    list.map((it) => (String(it._id) === String(id) ? updated : it))
  );
  await upsertDedicatedRecord("productProductions", updated);
  return updated;
}

export async function applyProductionDelete({ id, operationId }) {
  const existing = await getCachedProduction(id);
  if (existing) {
    await patchRawStockFromProduction(existing, -1, operationId);
    await patchProductStockFromProduction(existing, -1, operationId); 
  }
  await patchCachedCollections("/products", (list) =>
    list.filter((it) => String(it._id) !== String(id))
  );
  await removeDedicatedRecord("productProductions", id);
  return null;
}

/* ─────────────── product-stock apply ─────────────── */

export async function applyProductStockAction({ action, id, data, operationId }) {
  const item = await getProductStockItem(id);
  if (!item) {
    throw new Error(
      "Product stock is not cached. Refresh products while online before changing it offline."
    );
  }

  let updated;

  if (action === "reserved") {
    updated = {
      ...item,
      ...(data?.reservedQty !== undefined ? { reservedQty: data.reservedQty } : {}),
      ...(data?.reorderLevel !== undefined ? { reorderLevel: data.reorderLevel } : {}),
      ...(data?.criticalLevel !== undefined ? { criticalLevel: data.criticalLevel } : {}),
      __pending: true,
      __opId: operationId,
    };
  } else if (action === "adjust") {
    let q = Number(item.quantity || 0);
    const delta = Number(data?.quantity || 0);
    if (data?.type === "in") q += delta;
    else if (data?.type === "out") q = Math.max(0, q - delta);
    else q = delta;

    updated = { ...item, quantity: q, __pending: true, __opId: operationId };
  } else {
    const weight = parseFloat(item.size) || 1;
    const reelsScrapped = Number(data?.quantity || 0) / weight;
    updated = {
      ...item,
      quantity: Math.max(0, Number(item.quantity || 0) - reelsScrapped),
      scrapQty: Number(item.scrapQty || 0) + Number(data?.quantity || 0),
      __pending: true,
      __opId: operationId,
    };
  }

  await patchCachedCollections("/products/stock", (list) =>
    list.map((i) => (String(i._id) === String(item._id) ? updated : i))
  );
  await upsertDedicatedRecord("productStock", updated);
  return updated;
}

/* ─────────────── reconcile ─────────────── */

export async function reconcileProductionCreate({ url, operationId, response }) {
  const path = String(url || "").split("?")[0];
  if (!/^\/products\/?$/.test(path)) return;
  const created = response?.data?.data;
  if (!created?._id) return;

  const { db, openDb } = await import("../db/database.js");
  await openDb();
  const wasOptimistic = Boolean(
    await db.cachedRecords
      .where("[module+recordId]")
      .equals(["productProductions", `pending:${operationId}`])
      .first()
  );

  await patchCachedCollections("/products", (list) =>
    list.map((it) =>
      it.__opId === operationId
        ? { ...created, __pending: false, __opId: undefined }
        : it
    )
  );
  await removeDedicatedRecord("productProductions", `pending:${operationId}`);
  await upsertDedicatedRecord("productProductions", {
    ...created,
    __pending: false,
    __opId: undefined,
  });

  if (!wasOptimistic) {
    await patchRawStockFromProduction(created, +1, operationId);
  }
}

export async function reconcileProductionEdit({ url, method, response }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(/^\/products\/([^/]+)\/?$/);
  if (!m || !["PUT", "PATCH"].includes(String(method || "").toUpperCase())) return;

  const id = safeDecode(m[1]);
  const created = response?.data?.data;
  if (!created?._id) return;

  // Capture the OLD cached entry BEFORE we overwrite it
  const oldEntry = await getCachedProduction(id);

  // Detect offline path
  const wasOptimistic =
    oldEntry?.__opId !== undefined || Boolean(oldEntry?.__pending);

  await patchCachedCollections("/products", (list) =>
    list.map((it) =>
      String(it._id) === id
        ? { ...created, __pending: false, __opId: undefined }
        : it
    )
  );
  await upsertDedicatedRecord("productProductions", {
    ...created,
    __pending: false,
  });

  if (!wasOptimistic && oldEntry) {
    const diff = {
      qty2kg: (Number(created.qty2kg) || 0) - (Number(oldEntry.qty2kg) || 0),
      qty5kg: (Number(created.qty5kg) || 0) - (Number(oldEntry.qty5kg) || 0),
      qty8kg: (Number(created.qty8kg) || 0) - (Number(oldEntry.qty8kg) || 0),
      qty10kg: (Number(created.qty10kg) || 0) - (Number(oldEntry.qty10kg) || 0),
      tapeUsedBox: (Number(created.tapeUsedBox) || 0) - (Number(oldEntry.tapeUsedBox) || 0),
      scrapKg: (Number(created.scrapKg) || 0) - (Number(oldEntry.scrapKg) || 0),
    };
    if (Object.values(diff).some((v) => v !== 0)) {
      await patchRawStockFromProduction(diff, +1, operationId);
    }
  }
}

export async function reconcileProductionDelete({ url, method, operationId }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(/^\/products\/([^/]+)\/?$/);
  if (!m || String(method || "").toUpperCase() !== "DELETE") return;

  const id = safeDecode(m[1]);
  const existing = await getCachedProduction(id);
  const wasOptimistic = Boolean(existing?.__pending || existing?.__opId);

  await patchCachedCollections("/products", (list) =>
    list.filter((it) => String(it._id) !== id)
  );
  await removeDedicatedRecord("productProductions", id);

  if (!wasOptimistic && existing) {
    await patchRawStockFromProduction(existing, -1, operationId);
  }
}

export async function reconcileProductStockAction({ url, method, response }) {
  const path = String(url || "").split("?")[0];
  const m = path.match(/^\/products\/stock\/([^/]+)\/(reserved|adjust|scrap)\/?$/);
  if (!m || !["PUT", "PATCH"].includes(String(method || "").toUpperCase())) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  await patchCachedCollections("/products/stock", (list) =>
    list.map((it) =>
      String(it._id) === String(created._id)
        ? { ...created, __pending: false, __opId: undefined }
        : it
    )
  );
  await upsertDedicatedRecord("productStock", {
    ...created,
    __pending: false,
  });
}

export async function reconcileRawMaterialCreate({ url, operationId, response }) {
  const path = String(url || "").split("?")[0];
  if (!/^\/raw-material\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  await patchCachedCollections("/raw-material", (list) =>
    list.map((it) =>
      it.__opId === operationId
        ? { ...created, __pending: false, __opId: undefined }
        : it
    )
  );
  await removeDedicatedRecord("rawStock", `pending:${operationId}`);
  await upsertDedicatedRecord("rawStock", {
    ...created,
    __pending: false,
    __opId: undefined,
  });
}