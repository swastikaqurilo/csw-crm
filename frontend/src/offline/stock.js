
import { db, openDb } from "../db/database.js";

import {
  nowIso,
  safeDecode,
  listKeyOf,
  listOf,
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

const PRODUCT_SIZES = ["2kg", "5kg", "8kg", "10kg"];

/* ─────────────── shared helpers ─────────────── */

async function withCacheTransaction(callback) {
  await openDb();

  return db.transaction("rw", db.cachedRecords, callback);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function hasProductionChanges(production) {
  return [
    production?.qty2kg,
    production?.qty5kg,
    production?.qty8kg,
    production?.qty10kg,
    production?.tapeUsedBox,
    production?.scrapKg,
  ].some((value) => numberOrZero(value) !== 0);
}

function productionDiff(updated, existing) {
  return {
    qty2kg:
      numberOrZero(updated.qty2kg) - numberOrZero(existing.qty2kg),
    qty5kg:
      numberOrZero(updated.qty5kg) - numberOrZero(existing.qty5kg),
    qty8kg:
      numberOrZero(updated.qty8kg) - numberOrZero(existing.qty8kg),
    qty10kg:
      numberOrZero(updated.qty10kg) - numberOrZero(existing.qty10kg),
    tapeUsedBox:
      numberOrZero(updated.tapeUsedBox) -
      numberOrZero(existing.tapeUsedBox),
    scrapKg:
      numberOrZero(updated.scrapKg) - numberOrZero(existing.scrapKg),
  };
}

function hasNonZeroDiff(diff) {
  return Object.values(diff).some((value) => numberOrZero(value) !== 0);
}

function getPayloadList(payload) {
  const key = listKeyOf(payload);
  return key ? payload[key] : null;
}

function replacePayloadList(payload, nextList) {
  const key = listKeyOf(payload);

  if (!key) {
    throw new Error("Cached collection has an unsupported response format.");
  }

  return {
    ...payload,
    [key]: nextList,
  };
}

/* ─────────────── cache helpers ─────────────── */

export function getCachedProduction(id) {
  return getCachedByModuleAndId("productProductions", "/products", id);
}

export function getCachedRawMaterial(id) {
  return getCachedByModuleAndId(
    "rawStock",
    "/raw-material/stock",
    id
  );
}

export function getProductStockItem(id) {
  return getCachedByModuleAndId(
    "productStock",
    "/products/stock",
    id
  );
}

/* ─────────────── raw-material mutations ─────────────── */

export async function applyRawMaterialCreate({ data, operationId }) {
  const optimistic = {
    ...(data || {}),
    _id: `pending:${operationId}`,
    __opId: operationId,
    __pending: true,
    quantity: Number(data?.quantity) || 0,
    reservedQty: 0,
    movementLog: [],
    isActive: data?.isActive ?? true,
    createdAt: nowIso(),
  };

  await patchCachedCollections("/raw-material/stock", (list) => [
    optimistic,
    ...list.filter((item) => item.__opId !== operationId),
  ]);

  await upsertDedicatedRecord("rawStock", optimistic);

  return optimistic;
}

export async function applyRawStockUpdate({ id, data, operationId }) {
  const existing = await getCachedByModuleAndId(
    "rawStock",
    "/raw-material/stock",
    id
  );

  if (!existing) {
    throw new Error(
      "Material is not cached. Refresh Raw Materials while online before editing it offline."
    );
  }

  const updated = {
    ...existing,
    ...(data || {}),
    __pending: true,
    __opId: operationId,
  };

  await patchCachedCollections("/raw-material/stock", (list) =>
    list.map((item) =>
      String(item._id) === String(id) ? updated : item
    )
  );

  await upsertDedicatedRecord("rawStock", updated);

  return updated;
}

export async function applyRawStockAdjust({ id, data, operationId }) {
  const existing = await getCachedByModuleAndId(
    "rawStock",
    "/raw-material/stock",
    id
  );

  if (!existing) {
    throw new Error(
      "Material is not cached. Refresh Raw Materials while online before adjusting stock offline."
    );
  }

  const quantity = Number(data?.quantity);
  const before = numberOrZero(existing.quantity);
  const reservedBefore = numberOrZero(existing.reservedQty);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Enter a valid positive stock quantity.");
  }

  let after = before;
  let reservedAfter = reservedBefore;

  if (data.type === "in") {
    after = before + quantity;
  } else if (data.type === "out") {
    const available = before - reservedBefore;

    if (!data.overrideReserved && quantity > available) {
      throw new Error(
        `Insufficient available stock. Available: ${available}, requested: ${quantity}`
      );
    }

    if (data.overrideReserved && quantity > before) {
      throw new Error(
        `Insufficient total stock. On hand: ${before}, requested: ${quantity}`
      );
    }

    after = before - quantity;

    if (data.overrideReserved) {
      reservedAfter = Math.max(
        0,
        reservedBefore - Math.min(reservedBefore, quantity)
      );
    }
  } else if (data.type === "adjustment") {
    after = quantity;
    reservedAfter = Math.min(reservedBefore, after);
  } else {
    throw new Error("Invalid stock adjustment type.");
  }

  const updated = {
    ...existing,
    quantity: after,
    reservedQty: reservedAfter,
    ...(data.type === "in" ? { lastReceivedAt: nowIso() } : {}),
    ...(data.type === "out" ? { lastIssuedAt: nowIso() } : {}),
    movementLog: [
      ...(Array.isArray(existing.movementLog)
        ? existing.movementLog
        : []),
      {
        type: data.type,
        quantity:
          data.type === "adjustment"
            ? Math.abs(after - before)
            : quantity,
        beforeQty: before,
        afterQty: after,
        reason: data.reason || "Manual adjustment",
        notes: data.notes || null,
        at: nowIso(),
        localOperationId: operationId,
        pendingSync: true,
      },
    ],
    __pending: true,
    __opId: operationId,
  };

  await patchCachedCollections("/raw-material/stock", (list) =>
    list.map((item) =>
      String(item._id) === String(id) ? updated : item
    )
  );

  await upsertDedicatedRecord("rawStock", updated);

  return updated;
}

/* ─────────────── production stock calculations ─────────────── */

function productionRawDelta(production, sign) {
  const qty2kg = numberOrZero(production.qty2kg);
  const qty5kg = numberOrZero(production.qty5kg);
  const qty8kg = numberOrZero(production.qty8kg);
  const qty10kg = numberOrZero(production.qty10kg);

  const steelInReels =
    qty2kg * REEL_STEEL_KG["2kg"] +
    qty5kg * REEL_STEEL_KG["5kg"] +
    qty8kg * REEL_STEEL_KG["8kg"] +
    qty10kg * REEL_STEEL_KG["10kg"];

  return {
    steelKg:
      sign * (steelInReels + numberOrZero(production.scrapKg)),
    tapeBox: sign * numberOrZero(production.tapeUsedBox),
    reels: {
      "2kg": sign * qty2kg,
      "5kg": sign * qty5kg,
      "8kg": sign * qty8kg,
      "10kg": sign * qty10kg,
    },
  };
}

function productionReelDelta(production, sign) {
  return {
    "2kg": sign * numberOrZero(production.qty2kg),
    "5kg": sign * numberOrZero(production.qty5kg),
    "8kg": sign * numberOrZero(production.qty8kg),
    "10kg": sign * numberOrZero(production.qty10kg),
  };
}

function applyStockMovement(stock, delta, operationId) {
  const beforeQty = numberOrZero(stock.quantity);
  const reservedQty = numberOrZero(stock.reservedQty);
  const afterQty = beforeQty - delta;

  if (delta > 0) {
    const available = beforeQty - reservedQty;

    if (delta > available) {
      throw new Error(
        `Insufficient available ${stock.name || stock.category} stock. Available: ${Math.max(
          0,
          available
        )}, required: ${delta}`
      );
    }
  }

  if (afterQty < 0) {
    throw new Error("Invalid stock reversal. Stock quantity cannot be negative.");
  }

  return {
    ...stock,
    quantity: afterQty,
    movementLog: [
      ...(Array.isArray(stock.movementLog) ? stock.movementLog : []),
      {
        type:
          delta >= 0
            ? "production-consumed"
            : "production-reversed",
        quantity: Math.abs(delta),
        beforeQty,
        afterQty,
        reason: "Production (offline)",
        localOperationId: operationId,
        pendingSync: true,
        at: nowIso(),
      },
    ],
    __pending: true,
    __opId: operationId,
  };
}

/* ─────────────── raw-material stock update ─────────────── */

async function patchRawStockFromProduction(
  production,
  sign,
  operationId
) {
  const delta = productionRawDelta(production, sign);

  const required = {
    Steel: delta.steelKg,
    Tape: delta.tapeBox,
    "2kg Reel": delta.reels["2kg"],
    "5kg Reel": delta.reels["5kg"],
    "8kg Reel": delta.reels["8kg"],
    "10kg Reel": delta.reels["10kg"],
  };

  if (Object.values(required).every((value) => value === 0)) {
    return;
  }

  const rawRow = await getHttpRowByBasePath("/raw-material/stock");

  const dedicatedRows = await db.cachedRecords
    .where("module")
    .equals("rawStock")
    .toArray();

  const materialsById = new Map();

  const httpList = getPayloadList(rawRow?.data);

  if (Array.isArray(httpList)) {
    for (const material of httpList) {
      if (material?._id) {
        materialsById.set(String(material._id), material);
      }
    }
  }

  for (const row of dedicatedRows) {
    const material = row.data;

    if (!material?._id) continue;

    const id = String(material._id);

    if (!materialsById.has(id)) {
      materialsById.set(id, material);
    }
  }

  if (materialsById.size === 0) {
    throw new Error(
      "Raw-material stock is not cached. Open Raw Materials while online before recording production offline."
    );
  }

  const materials = [...materialsById.values()].filter(
    (material) => material.isActive !== false
  );

  const categoryOf = (material) =>
    String(material.category || "").trim().toLowerCase();

  function findSingleMaterial(description, predicate, amount) {
    if (amount === 0) return null;

    const matches = materials.filter(predicate);

    if (matches.length === 0) {
      throw new Error(
        `${description} is missing from cached Raw Materials. Refresh Raw Materials while online before recording production.`
      );
    }

    if (matches.length > 1) {
      throw new Error(
        `More than one ${description} material is cached. Stock was not changed because the correct material cannot be identified safely.`
      );
    }

    return matches[0];
  }

  const targets = [];

  const steel = findSingleMaterial(
    "Steel",
    (material) => categoryOf(material) === "steel",
    delta.steelKg
  );

  if (steel) {
    targets.push({ material: steel, amount: delta.steelKg });
  }

  const tape = findSingleMaterial(
    "Tape",
    (material) => categoryOf(material) === "tape",
    delta.tapeBox
  );

  if (tape) {
    targets.push({ material: tape, amount: delta.tapeBox });
  }

  for (const size of PRODUCT_SIZES) {
    const amount = delta.reels[size];

    const reel = findSingleMaterial(
      `${size} Reel`,
      (material) =>
        categoryOf(material) === "reel" &&
        Number(material.sizeKg) === Number.parseFloat(size),
      amount
    );

    if (reel) {
      targets.push({ material: reel, amount });
    }
  }

  const updatedById = new Map();

  for (const target of targets) {
    const updated = applyStockMovement(
      target.material,
      target.amount,
      operationId
    );

    updatedById.set(String(updated._id), updated);
  }

  if (rawRow && Array.isArray(httpList)) {
    const nextList = httpList.map(
      (material) =>
        updatedById.get(String(material._id)) || material
    );

    await db.cachedRecords.put({
      ...rawRow,
      data: replacePayloadList(rawRow.data, nextList),
      updatedAt: nowIso(),
    });
  }

  for (const updated of updatedById.values()) {
    await upsertDedicatedRecord("rawStock", updated);
  }
}

/* ─────────────── finished-product stock update ─────────────── */

async function patchProductStockFromProduction(
  production,
  sign,
  operationId
) {
  const reels = productionReelDelta(production, sign);

  if (Object.values(reels).every((value) => value === 0)) {
    return;
  }

  const stockRow = await getHttpRowByBasePath("/products/stock");
  const existingList = getPayloadList(stockRow?.data);

  const dedicatedRows = await db.cachedRecords
    .where("module")
    .equals("productStock")
    .toArray();

  const stockBySize = new Map();

  if (Array.isArray(existingList)) {
    for (const item of existingList) {
      if (item?.size) {
        stockBySize.set(String(item.size), item);
      }
    }
  }

  for (const row of dedicatedRows) {
    const item = row.data;

    if (!item?.size) continue;

    const size = String(item.size);

    if (!stockBySize.has(size)) {
      stockBySize.set(size, item);
    }
  }

  const nextBySize = new Map(stockBySize);

  for (const size of PRODUCT_SIZES) {
    const delta = numberOrZero(reels[size]);

    if (delta === 0) continue;

    let item = nextBySize.get(size);

    if (!item) {
      if (delta < 0) {
        throw new Error(
          `Cannot reverse ${size} production because its finished-product stock is not cached.`
        );
      }

      item = {
        _id: `local-stock-${size}`,
        size,
        name: `${size} Reel`,
        unit: "Reel",
        quantity: 0,
        reservedQty: 0,
        scrapQty: 0,
        isActive: true,
        movementLog: [],
      };
    }

    const before = numberOrZero(item.quantity);
    const after = before + delta;

    if (after < 0) {
      throw new Error(
        `Cannot reduce ${size} finished-product stock below zero. Current stock: ${before}, change: ${delta}.`
      );
    }

    const updated = {
      ...item,
      quantity: after,
      ...(delta > 0 ? { lastReceivedAt: nowIso() } : {}),
      movementLog: [
        ...(Array.isArray(item.movementLog) ? item.movementLog : []),
        {
          type:
            delta > 0
              ? "production-added"
              : "production-reversed",
          quantity: Math.abs(delta),
          beforeQty: before,
          afterQty: after,
          reason: "Production (offline)",
          localOperationId: operationId,
          pendingSync: true,
          at: nowIso(),
        },
      ],
      __pending: true,
      __opId: operationId,
    };

    nextBySize.set(size, updated);
  }

  const nextList = [...nextBySize.values()];

  if (stockRow && Array.isArray(existingList)) {
    await db.cachedRecords.put({
      ...stockRow,
      data: replacePayloadList(stockRow.data, nextList),
      updatedAt: nowIso(),
    });
  } else {
    await db.cachedRecords.put({
      module: "http",
      recordId: "/products/stock",
      data: {
        success: true,
        data: nextList,
      },
      updatedAt: nowIso(),
    });
  }

  for (const item of nextList) {
    await upsertDedicatedRecord("productStock", item);
  }
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

  await withCacheTransaction(async () => {
    await patchRawStockFromProduction(
      optimistic,
      +1,
      operationId
    );

    await patchProductStockFromProduction(
      optimistic,
      +1,
      operationId
    );

    await patchCachedCollections("/products", (list) => [
      optimistic,
      ...list.filter((item) => item.__opId !== operationId),
    ]);

    await upsertDedicatedRecord(
      "productProductions",
      optimistic
    );
  });

  return optimistic;
}

export async function applyProductionEdit({
  id,
  data,
  operationId,
}) {
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

  const diff = productionDiff(updated, existing);

  await withCacheTransaction(async () => {
    if (hasNonZeroDiff(diff)) {
      await patchRawStockFromProduction(
        diff,
        +1,
        operationId
      );

      await patchProductStockFromProduction(
        diff,
        +1,
        operationId
      );
    }

    await patchCachedCollections("/products", (list) =>
      list.map((item) =>
        String(item._id) === String(id) ? updated : item
      )
    );

    await upsertDedicatedRecord(
      "productProductions",
      updated
    );
  });

  return updated;
}

export async function applyProductionDelete({
  id,
  operationId,
}) {
  await withCacheTransaction(async () => {
    const existing = await getCachedProduction(id);

    if (existing) {
      await patchRawStockFromProduction(
        existing,
        -1,
        operationId
      );

      await patchProductStockFromProduction(
        existing,
        -1,
        operationId
      );
    }

    await patchCachedCollections("/products", (list) =>
      list.filter((item) => String(item._id) !== String(id))
    );

    await removeDedicatedRecord("productProductions", id);
  });

  return null;
}

/* ─────────────── product-stock apply ─────────────── */

export async function applyProductStockAction({
  action,
  id,
  data,
  operationId,
}) {
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
      ...(data?.reservedQty !== undefined
        ? { reservedQty: data.reservedQty }
        : {}),
      ...(data?.reorderLevel !== undefined
        ? { reorderLevel: data.reorderLevel }
        : {}),
      ...(data?.criticalLevel !== undefined
        ? { criticalLevel: data.criticalLevel }
        : {}),
      __pending: true,
      __opId: operationId,
    };
  } else if (action === "adjust") {
    const current = numberOrZero(item.quantity);
    const quantity = Number(data?.quantity);

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error("Enter a valid stock quantity.");
    }

    let nextQuantity;

    if (data?.type === "in") {
      nextQuantity = current + quantity;
    } else if (data?.type === "out") {
      if (quantity > current) {
        throw new Error("Insufficient product stock.");
      }

      nextQuantity = current - quantity;
    } else {
      nextQuantity = quantity;
    }

    updated = {
      ...item,
      quantity: nextQuantity,
      __pending: true,
      __opId: operationId,
    };
  } else if (action === "scrap") {
    const weight = Number.parseFloat(item.size) || 1;
    const scrapWeight = Number(data?.quantity);

    if (!Number.isFinite(scrapWeight) || scrapWeight <= 0) {
      throw new Error("Enter a valid scrap quantity.");
    }

    const reelsScrapped = scrapWeight / weight;
    const current = numberOrZero(item.quantity);

    if (reelsScrapped > current) {
      throw new Error("Insufficient product stock for this scrap entry.");
    }

    updated = {
      ...item,
      quantity: current - reelsScrapped,
      scrapQty:
        numberOrZero(item.scrapQty) + scrapWeight,
      __pending: true,
      __opId: operationId,
    };
  } else {
    throw new Error(`Unsupported product stock action: ${action}`);
  }

  await patchCachedCollections("/products/stock", (list) =>
    list.map((entry) =>
      String(entry._id) === String(item._id) ? updated : entry
    )
  );

  await upsertDedicatedRecord("productStock", updated);

  return updated;
}

/* ─────────────── production reconciliation ─────────────── */

export async function reconcileProductionCreate({
  url,
  operationId,
  response,
}) {
  const path = String(url || "").split("?")[0];

  if (!/^\/products\/?$/.test(path)) return;

  const created = response?.data?.data;

  if (!created?._id) return;

  await withCacheTransaction(async () => {
    const optimistic = await db.cachedRecords
      .where("[module+recordId]")
      .equals([
        "productProductions",
        `pending:${operationId}`,
      ])
      .first();

    const wasOptimistic = Boolean(optimistic);

    await patchCachedCollections("/products", (list) =>
      list.map((item) =>
        item.__opId === operationId
          ? {
              ...created,
              __pending: false,
              __opId: undefined,
            }
          : item
      )
    );

    await removeDedicatedRecord(
      "productProductions",
      `pending:${operationId}`
    );

    await upsertDedicatedRecord("productProductions", {
      ...created,
      __pending: false,
      __opId: undefined,
    });

    if (!wasOptimistic) {
      await patchRawStockFromProduction(
        created,
        +1,
        operationId
      );

      await patchProductStockFromProduction(
        created,
        +1,
        operationId
      );
    }
  });
}

export async function reconcileProductionEdit({
  url,
  method,
  operationId,
  response,
}) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/products\/([^/]+)\/?$/);

  if (
    !match ||
    !["PUT", "PATCH"].includes(
      String(method || "").toUpperCase()
    )
  ) {
    return;
  }

  const id = safeDecode(match[1]);
  const created = response?.data?.data;

  if (!created?._id) return;

  await withCacheTransaction(async () => {
    const oldEntry = await getCachedProduction(id);

    const wasOptimistic = Boolean(
      oldEntry?.__opId || oldEntry?.__pending
    );

    if (!wasOptimistic && oldEntry) {
      const diff = productionDiff(created, oldEntry);

      if (hasNonZeroDiff(diff)) {
        await patchRawStockFromProduction(
          diff,
          +1,
          operationId
        );

        await patchProductStockFromProduction(
          diff,
          +1,
          operationId
        );
      }
    }

    const reconciled = {
      ...created,
      __pending: false,
      __opId: undefined,
    };

    await patchCachedCollections("/products", (list) =>
      list.map((item) =>
        String(item._id) === id ? reconciled : item
      )
    );

    await upsertDedicatedRecord(
      "productProductions",
      reconciled
    );
  });
}

export async function reconcileProductionDelete({
  url,
  method,
  operationId,
}) {
  const path = String(url || "").split("?")[0];
  const match = path.match(/^\/products\/([^/]+)\/?$/);

  if (
    !match ||
    String(method || "").toUpperCase() !== "DELETE"
  ) {
    return;
  }

  const id = safeDecode(match[1]);

  await withCacheTransaction(async () => {
    const existing = await getCachedProduction(id);

    const wasOptimistic = Boolean(
      existing?.__pending || existing?.__opId
    );

    if (existing && !wasOptimistic) {
      await patchRawStockFromProduction(
        existing,
        -1,
        operationId
      );

      await patchProductStockFromProduction(
        existing,
        -1,
        operationId
      );
    }

    await patchCachedCollections("/products", (list) =>
      list.filter((item) => String(item._id) !== id)
    );

    await removeDedicatedRecord(
      "productProductions",
      id
    );
  });
}

/* ─────────────── product-stock reconciliation ─────────────── */

export async function reconcileProductStockAction({
  url,
  method,
  response,
}) {
  const path = String(url || "").split("?")[0];

  const match = path.match(
    /^\/products\/stock\/([^/]+)\/(reserved|adjust|scrap)\/?$/
  );

  if (
    !match ||
    !["PUT", "PATCH"].includes(
      String(method || "").toUpperCase()
    )
  ) {
    return;
  }

  const created = response?.data?.data;

  if (!created?._id) return;

  const updated = {
    ...created,
    __pending: false,
    __opId: undefined,
  };

  await patchCachedCollections("/products/stock", (list) =>
    list.map((item) =>
      String(item._id) === String(created._id)
        ? updated
        : item
    )
  );

  await upsertDedicatedRecord("productStock", updated);
}

/* ─────────────── raw-material reconciliation ─────────────── */

export async function reconcileRawMaterialCreate({
  url,
  operationId,
  response,
}) {
  const path = String(url || "").split("?")[0];

  if (!/^\/raw-material\/stock\/?$/.test(path)) return;

  const created = response?.data?.data;
  if (!created?._id) return;

  await patchCachedCollections("/raw-material/stock", (list) =>
    list.map((item) =>
      item.__opId === operationId
        ? {
            ...created,
            __pending: false,
            __opId: undefined,
          }
        : item
    )
  );

  await removeDedicatedRecord("rawStock", `pending:${operationId}`);

  await upsertDedicatedRecord("rawStock", {
    ...created,
    __pending: false,
    __opId: undefined,
  });
}

export async function reconcileRawStockUpdate({
  url,
  response,
}) {
  const path = String(url || "").split("?")[0];
  const match = path.match(
    /^\/raw-material\/stock\/([^/]+)\/?$/
  );

  if (!match) return;

  const id = safeDecode(match[1]);
  const returned = response?.data?.data;

  if (!returned?._id) return;

  const updated = {
    ...returned,
    __pending: false,
    __opId: undefined,
  };

  await patchCachedCollections("/raw-material/stock", (list) =>
    list.map((item) =>
      String(item._id) === id ? updated : item
    )
  );

  await upsertDedicatedRecord("rawStock", updated);
}

export async function reconcileRawStockAdjust({
  url,
  response,
}) {
  const path = String(url || "").split("?")[0];

  const match = path.match(
    /^\/raw-material\/stock\/([^/]+)\/adjust\/?$/
  );

  if (!match) return;

  const returned = response?.data?.data;

  if (!returned?._id) return;

  const updated = {
    ...returned,
    __pending: false,
    __opId: undefined,
  };

  await patchCachedCollections("/raw-material/stock", (list) =>
    list.map((item) =>
      String(item._id) === String(updated._id)
        ? updated
        : item
    )
  );

  await upsertDedicatedRecord("rawStock", updated);
}
