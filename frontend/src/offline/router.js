import { safeDecode } from "./cache.js";
import * as orders from "./orders.js";
import * as purchases from "./purchases.js";
import * as stock from "./stock.js";

const NOOP = () => null;

const APPLY = [
  /* Purchases */
  { v: ["POST", "DELETE"], p: /^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)(?:\/([^/]+))?\/?$/, h: purchases.applyAction, k: ["purchaseId", "action", "paymentId"] },
  { v: ["POST"], p: /^\/raw-material\/purchases\/?$/, h: purchases.applyCreate },
  { v: ["PUT", "PATCH"], p: /^\/raw-material\/purchases\/([^/]+)\/?$/, h: purchases.applyEdit, k: ["id"] },
  { v: ["POST"], p: /^\/raw-material\/?$/, h: NOOP },

  /* Orders — orders? matches both /order and /orders */
  { v: ["PATCH", "PUT"], p: /^\/orders?\/([^/]+)\/status\/?$/, h: orders.applyStatus, k: ["id"] },
  { v: ["POST"], p: /^\/orders?\/[^/]+\/invoice\/?$/, h: NOOP },
  { v: ["PUT", "PATCH"], p: /^\/orders?\/([^/]+)\/?$/, h: orders.applyUpdate, k: ["id"] },
  { v: ["DELETE"], p: /^\/orders?\/([^/]+)\/?$/, h: orders.applyDelete, k: ["id"] },
  { v: ["POST"], p: /^\/orders?\/?$/, h: orders.applyCreate },
  { v: ["POST"], p: /^\/payments?\/?$/, h: orders.applyPaymentCreate },

  /* Production + product-stock */
  { v: ["POST"], p: /^\/products\/?$/, h: stock.applyProductionCreate },
  { v: ["PUT", "PATCH"], p: /^\/products\/stock\/([^/]+)\/(reserved|adjust|scrap)\/?$/, h: stock.applyProductStockAction, k: ["id", "action"] },
  { v: ["PUT", "PATCH"], p: /^\/products\/([^/]+)\/?$/, h: stock.applyProductionEdit, k: ["id"] },
  { v: ["DELETE"], p: /^\/products\/([^/]+)\/?$/, h: stock.applyProductionDelete, k: ["id"] },
];

const RECONCILE = [
  /* Purchases */
  { v: ["POST"], p: /^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)(?:\/([^/]+))?\/?$/, h: purchases.reconcileAction },
  { v: ["POST"], p: /^\/raw-material\/purchases\/?$/, h: purchases.reconcileCreate },
  { v: ["PUT", "PATCH"], p: /^\/raw-material\/purchases\/([^/]+)\/?$/, h: purchases.reconcileEdit },
  { v: ["POST"], p: /^\/raw-material\/?$/, h: stock.reconcileRawMaterialCreate },

  /* Orders — orders? matches both /order and /orders */
  { v: ["PATCH", "PUT"], p: /^\/orders?\/([^/]+)\/status\/?$/, h: orders.reconcileStatus },
  { v: ["POST"], p: /^\/orders?\/[^/]+\/invoice\/?$/, h: NOOP },
  { v: ["PUT", "PATCH"], p: /^\/orders?\/([^/]+)\/?$/, h: orders.reconcileUpdate },
  { v: ["DELETE"], p: /^\/orders?\/([^/]+)\/?$/, h: orders.reconcileDelete },
  { v: ["POST"], p: /^\/orders?\/?$/, h: orders.reconcileCreate },
  { v: ["POST"], p: /^\/payments?\/?$/, h: orders.reconcilePaymentCreate },

  /* Production + product-stock */
  { v: ["POST"], p: /^\/products\/?$/, h: stock.reconcileProductionCreate },
  { v: ["PUT", "PATCH"], p: /^\/products\/stock\/([^/]+)\/(reserved|adjust|scrap)\/?$/, h: stock.reconcileProductStockAction },
  { v: ["PUT", "PATCH"], p: /^\/products\/([^/]+)\/?$/, h: stock.reconcileProductionEdit },
  { v: ["DELETE"], p: /^\/products\/([^/]+)\/?$/, h: stock.reconcileProductionDelete },
];

const ON_FAILURE = [
  { v: ["POST", "DELETE"], p: /^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)/, h: purchases.clearFailedAction },
];

function runTable(table, payload) {
  const verb = String(payload.method || "").toUpperCase();
  const path = String(payload.url || "").split("?")[0];

  for (const route of table) {
    if (!route.v.includes(verb)) continue;
    const m = path.match(route.p);
    if (!m) continue;
    const args = { ...payload };
    if (route.k) {
      route.k.forEach((name, i) => {
        const val = m[i + 1];
        args[name] = val ? safeDecode(val) : undefined;
      });
    }
    return route.h(args);
  }
  return undefined;
}

/* Generic fallbacks that don't belong to any domain */

async function genericApply({ method, url, data, operationId }) {
  const { patchCachedCollections } = await import("./cache.js");
  const verb = String(method || "").toUpperCase();
  const path = String(url || "").split("?")[0];
  const segments = path.split("/").filter(Boolean);

  if (verb === "POST" && segments.length === 1) {
    const optimistic = {
      ...(data || {}),
      _id: `pending:${operationId}`,
      __opId: operationId,
      __pending: true,
      createdAt: new Date().toISOString(),
    };
    await patchCachedCollections(path, (list) => [
      optimistic,
      ...list.filter((it) => it.__opId !== operationId),
    ]);
    return optimistic;
  }

  if (verb === "PUT" || verb === "PATCH") {
    const id = segments[segments.length - 1];
    await patchCachedCollections(path, (list) =>
      list.map((it) =>
        String(it._id) === String(id) ? { ...it, ...(data || {}), __pending: true } : it
      )
    );
    return null;
  }

  if (verb === "DELETE") {
    const id = segments[segments.length - 1];
    await patchCachedCollections(path, (list) =>
      list.filter((it) => String(it._id) !== String(id))
    );
    return null;
  }

  return null;
}

/* ─────────────── public entry points ─────────────── */

export async function applyOptimistic(payload) {
  const result = await runTable(APPLY, payload);
  if (result !== undefined) return result;

  // Loud warning: this means a write fell through to the generic fallback,
  // which does NOT run domain logic (no totals, no stock deduction, no
  // reconciliation). Almost always caused by a URL pattern mismatch.
  console.warn(
    "[offline] No APPLY route matched — using generic fallback. Cache may be inconsistent:",
    { method: payload.method, url: payload.url }
  );
  return genericApply(payload);
}

export async function reconcile(payload) {
  return runTable(RECONCILE, payload);
}

export async function onFailure(row) {
  return runTable(ON_FAILURE, {
    method: row.method,
    url: row.url,
    operationId: row.operationId,
  });
}