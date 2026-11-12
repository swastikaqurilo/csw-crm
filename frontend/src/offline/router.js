import * as expenses from "./expenses.js";
import { safeDecode } from "./cache.js";
import * as orders from "./orders.js";
import * as purchases from "./purchases.js";
import * as stock from "./stock.js";
import * as workers from "./workers.js";
import * as salary from "./salary.js";
import * as attendance from "./attendance.js";

const NOOP = () => null;

console.log("CSW OFFLINE ROUTER UPDATED - TEST 123");

const APPLY = [
  /* Purchases */
  
  {
    v: ["POST", "DELETE"],
    p: /^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)(?:\/([^/]+))?\/?$/,
    h: purchases.applyAction,
    k: ["purchaseId", "action", "paymentId"],
  },

  {
    v: ["POST"],
    p: /^\/raw-material\/purchases\/?$/,
    h: purchases.applyCreate,
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/raw-material\/purchases\/([^/]+)\/?$/,
    h: purchases.applyEdit,
    k: ["id"],
  },
  {
    v: ["POST"],
    p: /^\/raw-material\/?$/,
    h: NOOP,
  },

{
  v: ["POST"],
  p: /^\/raw-material\/stock\/?$/,
  h: stock.applyRawMaterialCreate,
},
{
  v: ["PATCH"],
  p: /^\/raw-material\/stock\/([^/]+)\/?$/,
  h: stock.applyRawStockUpdate,
  k: ["id"],
},
{
  v: ["POST"],
  p: /^\/raw-material\/stock\/([^/]+)\/adjust\/?$/,
  h: stock.applyRawStockAdjust,
  k: ["id"],
},


  /* Orders */
  {
    v: ["PATCH", "PUT"],
    p: /^\/orders?\/([^/]+)\/status\/?$/,
    h: orders.applyStatus,
    k: ["id"],
  },
  {
    v: ["POST"],
    p: /^\/orders?\/[^/]+\/invoice\/?$/,
    h: NOOP,
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/orders?\/([^/]+)\/?$/,
    h: orders.applyUpdate,
    k: ["id"],
  },
  {
    v: ["DELETE"],
    p: /^\/orders?\/([^/]+)\/?$/,
    h: orders.applyDelete,
    k: ["id"],
  },
  {
    v: ["POST"],
    p: /^\/orders?\/?$/,
    h: orders.applyCreate,
  },

    /* Payments */
  {
    v: ["POST"],
    p: /^\/(?:api\/)?payments?\/?$/,
    h: orders.applyPaymentCreate,
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/(?:api\/)?payments?\/([^/]+)\/?$/,
    h: orders.applyPaymentUpdate,
    k: ["id"],
  },
  {
    v: ["DELETE"],
    p: /^\/(?:api\/)?payments?\/([^/]+)\/?$/,
    h: orders.applyPaymentDelete,
    k: ["id"],
  },

  /* Production + product stock */
  {
    v: ["POST"],
    p: /^\/products\/?$/,
    h: stock.applyProductionCreate,
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/products\/stock\/([^/]+)\/(reserved|adjust|scrap)\/?$/,
    h: stock.applyProductStockAction,
    k: ["id", "action"],
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/products\/([^/]+)\/?$/,
    h: stock.applyProductionEdit,
    k: ["id"],
  },
  {
    v: ["DELETE"],
    p: /^\/products\/([^/]+)\/?$/,
    h: stock.applyProductionDelete,
    k: ["id"],
  },

    /* Expenses */
  {
    v: ["PATCH"],
    p: /^\/expense\/([^/]+)\/pay\/?$/,
    h: expenses.applyMarkPaid,
    k: ["id"],
  },
  {
    v: ["POST"],
    p: /^\/expense\/?$/,
    h: expenses.applyCreate,
  },
  {
    v: ["PUT"],
    p: /^\/expense\/([^/]+)\/?$/,
    h: expenses.applyUpdate,
    k: ["id"],
  },
  {
    v: ["DELETE"],
    p: /^\/expense\/([^/]+)\/?$/,
    h: expenses.applyDelete,
    k: ["id"],
  },
  {
    v: ["POST"],
    p: /^\/workers\/attendance\/?$/,
    h: attendance.applySave,
  },

    /* Workers */
  {
    v: ["POST"],
    p: /^\/workers\/?$/,
    h: workers.applyCreate,
  },
  {
    v: ["PUT"],
    p: /^\/workers\/([^/]+)\/?$/,
    h: workers.applyUpdate,
    k: ["id"],
  },
  {
    v: ["DELETE"],
    p: /^\/workers\/([^/]+)\/?$/,
    h: workers.applyDelete,
    k: ["id"],
  },
    /* Salaries */
  { v: ["POST"], p: /^\/salaries\/([^/]+)\/payment\/?$/, h: salary.applyPaymentCreate, k: ["id"] },
  { v: ["POST"], p: /^\/salaries\/([^/]+)\/advance\/?$/, h: salary.applyAdvanceCreate, k: ["id"] },
  { v: ["DELETE"], p: /^\/salaries\/([^/]+)\/advance\/([^/]+)\/?$/, h: salary.applyAdvanceDelete, k: ["id", "advanceId"] },
  { v: ["PUT", "PATCH"], p: /^\/salaries\/([^/]+)\/?$/, h: salary.applyUpdate, k: ["id"] },
  { v: ["DELETE"], p: /^\/salaries\/([^/]+)\/?$/, h: salary.applyDelete, k: ["id"] },
  { v: ["POST"], p: /^\/salaries\/?$/, h: salary.applyCreate },

  {
    v: ["POST"],
    p: /^\/salaries\/generate\/?$/,
    h: salary.applyGenerate,
  },
];

const RECONCILE = [
  {
    v: ["POST", "DELETE"],
    p: /^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)(?:\/([^/]+))?\/?$/,
    h: purchases.reconcileAction,
  }, 
  {
    v: ["POST"],
    p: /^\/raw-material\/purchases\/?$/,
    h: purchases.reconcileCreate,
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/raw-material\/purchases\/([^/]+)\/?$/,
    h: purchases.reconcileEdit,
  },
  {
    v: ["POST"],
    p: /^\/raw-material\/stock\/?$/,
    h: stock.reconcileRawMaterialCreate,
  },
  {
  v: ["PATCH"],
  p: /^\/raw-material\/stock\/([^/]+)\/?$/,
  h: stock.reconcileRawStockUpdate,
},
{
  v: ["POST"],
  p: /^\/raw-material\/stock\/([^/]+)\/adjust\/?$/,
  h: stock.reconcileRawStockAdjust,
},
    /* Production + product stock */
  {
    v: ["POST"],
    p: /^\/products\/?$/,
    h: stock.reconcileProductionCreate,
  },

  /* Orders */
  {
    v: ["PATCH", "PUT"],
    p: /^\/orders?\/([^/]+)\/status\/?$/,
    h: orders.reconcileStatus,
  },
  {
    v: ["POST"],
    p: /^\/orders?\/[^/]+\/invoice\/?$/,
    h: NOOP,
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/orders?\/([^/]+)\/?$/,
    h: orders.reconcileUpdate,
  },
  {
    v: ["DELETE"],
    p: /^\/orders?\/([^/]+)\/?$/,
    h: orders.reconcileDelete,
  },
  {
    v: ["POST"],
    p: /^\/orders?\/?$/,
    h: orders.reconcileCreate,
  },

    /* Payments */
  {
    v: ["POST"],
    p: /^\/(?:api\/)?payments?\/?$/,
    h: orders.reconcilePaymentCreate,
  },
  {
    v: ["PUT", "PATCH"],
    p: /^\/(?:api\/)?payments?\/([^/]+)\/?$/,
    h: orders.reconcilePaymentUpdate,
    k: ["id"],
  },
  {
    v: ["DELETE"],
    p: /^\/(?:api\/)?payments?\/([^/]+)\/?$/,
    h: orders.reconcilePaymentDelete,
    k: ["id"],
  },

    /* Expenses */
  {
    v: ["PATCH"],
    p: /^\/expense\/([^/]+)\/pay\/?$/,
    h: expenses.reconcileMarkPaid,
  },
  {
    v: ["POST"],
    p: /^\/expense\/?$/,
    h: expenses.reconcileCreate,
  },
  {
    v: ["PUT"],
    p: /^\/expense\/([^/]+)\/?$/,
    h: expenses.reconcileUpdate,
  },
  {
    v: ["DELETE"],
    p: /^\/expense\/([^/]+)\/?$/,
    h: expenses.reconcileDelete,
  },
  
    /* Workers */
  {
    v: ["POST"],
    p: /^\/workers\/?$/,
    h: workers.reconcileCreate,
  },
  {
    v: ["PUT"],
    p: /^\/workers\/([^/]+)\/?$/,
    h: workers.reconcileUpdate,
  },
  {
    v: ["DELETE"],
    p: /^\/workers\/([^/]+)\/?$/,
    h: workers.reconcileDelete,
  },
    /* Salaries */
  { v: ["POST"], p: /^\/salaries\/([^/]+)\/payment\/?$/, h: salary.reconcilePaymentCreate, k: ["id"] },
  { v: ["POST"], p: /^\/salaries\/([^/]+)\/advance\/?$/, h: salary.reconcileAdvanceCreate, k: ["id"] },
  { v: ["DELETE"], p: /^\/salaries\/([^/]+)\/advance\/([^/]+)\/?$/, h: salary.reconcileAdvanceDelete, k: ["id", "advanceId"] },
  { v: ["PUT", "PATCH"], p: /^\/salaries\/([^/]+)\/?$/, h: salary.reconcileUpdate, k: ["id"] },
  { v: ["DELETE"], p: /^\/salaries\/([^/]+)\/?$/, h: salary.reconcileDelete, k: ["id"] },
  { v: ["POST"], p: /^\/salaries\/?$/, h: salary.reconcileCreate },

  {
    v: ["POST"],
    p: /^\/salaries\/generate\/?$/,
    h: salary.reconcileGenerate,
  },

  {
    v: ["POST"],
    p: /^\/workers\/attendance\/?$/,
    h: attendance.reconcileSave,
  },
];

const ON_FAILURE = [
  {
    v: ["POST", "DELETE"],
    p: /^\/raw-material\/purchases\/([^/]+)\/(receive|cancel|payments)(?:\/([^/]+))?\/?$/,
    h: purchases.clearFailedAction,
  },
  {
    v: ["POST"],
    p: /^\/workers\/attendance\/?$/,
    h: attendance.onSaveFailure,
  },
];

function runTable(table, payload) {
  const verb = String(payload.method || "").toUpperCase();
  const path = String(payload.url || "").split("?")[0];

  for (const route of table) {
    if (!route.v.includes(verb)) continue;

    const match = path.match(route.p);
    if (!match) continue;

    const args = { ...payload };

    if (route.k) {
      route.k.forEach((name, i) => {
        const value = match[i + 1];
        args[name] = value ? safeDecode(value) : undefined;
      });
    }

    return route.h(args);
  }

  return undefined;
}

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
      ...list.filter((item) => item.__opId !== operationId),
    ]);

    return optimistic;
  }

  if (verb === "PUT" || verb === "PATCH") {
    const id = segments[segments.length - 1];

    await patchCachedCollections(path, (list) =>
      list.map((item) =>
        String(item._id) === String(id)
          ? { ...item, ...(data || {}), __pending: true }
          : item
      )
    );

    return null;
  }

  if (verb === "DELETE") {
    const id = segments[segments.length - 1];

    await patchCachedCollections(path, (list) =>
      list.filter((item) => String(item._id) !== String(id))
    );

    return null;
  }

  return null;
}

export async function applyOptimistic(payload) {
  const verb = String(payload.method || "").toUpperCase();
  const path = String(payload.url || "").split("?")[0];

  const result = await runTable(APPLY, payload);

  if (result !== undefined) return result;

  console.warn(
    "[offline] No APPLY route matched:",
    {
      method: payload.method,
      url: payload.url,
    }
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
    data: row.data,
    operationId: row.operationId,
  });
}
