import { openDb } from "../db/database.js";
import {
  httpRowsForBasePath,
  listDedicatedRecords,
  getCachedByModuleAndId,
  listOf, 
} from "./cache.js";

import {
  getAttendanceByDate,
  getAttendanceHistoryFromCache as readAttendanceHistory,
} from "./attendance.js";

/* ─────────────── shared merge helper ─────────────── */

const isHollowContact = (c) => !c || typeof c !== "object" || !(c.company || c.name || c.email);

async function collectModule(module, basePath) {
  const byId = new Map();

  for (const row of await httpRowsForBasePath(basePath)) {
    const list = listOf(row.data) ?? [];
    for (const item of list) {
      if (item?._id) byId.set(String(item._id), item);
    }
  }

  for (const row of await listDedicatedRecords(module)) {
    const next = row.data;
    if (!next?._id) continue;
    const id = String(next._id);
    const prev = byId.get(id);

    if (prev && next.contact !== undefined && isHollowContact(next.contact) && !isHollowContact(prev.contact)) {
      byId.set(id, { ...next, contact: prev.contact });
    } else {
      byId.set(id, next);
    }
  }

  return Array.from(byId.values());
}

function byDateDesc(field) {
  return (a, b) => {
    const av = new Date(a?.[field] || 0).getTime() || 0;
    const bv = new Date(b?.[field] || 0).getTime() || 0;
    return bv - av;
  };
}

export async function getOrdersFromCache({
  page = 1,
  limit = 8,
  search,
  status,
  paymentStatus,
} = {}) {
  await openDb();

  let list = await collectModule("orders", "/order");

  const allContacts = await collectModule("contacts", "/contacts");
    const contactById = new Map(allContacts.map((c) => [String(c._id), c]));
    list = list.map((o) => {
      if (!isHollowContact(o.contact)) return o;
      const id = o.contact && typeof o.contact === "object" ? o.contact._id : o.contact;
      const found = id ? contactById.get(String(id)) : null;
      return found ? { ...o, contact: found } : o;
    });

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (o) =>
        String(o.orderNumber || "").toLowerCase().includes(q) ||
        String(o.contact?.company || o.contact?.name || "").toLowerCase().includes(q) ||
        String(o.contact?.phone || "").includes(q)
    );
  }
  if (status && status !== "All") list = list.filter((o) => o.status === status);
  if (paymentStatus && paymentStatus !== "All") {
    list = list.filter((o) => o.paymentStatus === paymentStatus);
  }

  list.sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = list.slice((safePage - 1) * limit, safePage * limit);

  return {
    data: slice,
    pagination: { page: safePage, pages, total },
  };
}

export async function getExpensesFromCache() {
  await openDb();

  const expenses = await collectModule("expenses", "/expense");

  return expenses.sort(byDateDesc("date"));
}

export function getOrderByIdFromCache(id) {
  return getCachedByModuleAndId("orders", "/order", id);
}

/* ─────────────── payments (all) ─────────────── */

function paymentDateKey(value) {
  if (!value) return "";

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
}

export async function getPaymentsFromCache({
  search = "",
  paymentMode,
  status,
  from,
  to,
} = {}) {
  let list = await collectModule("payments", "/payment");

  // Attach cached order details when payment.order contains only an ID.
  const orders = await collectModule("orders", "/order");

  list = list.map((payment) => {
    const orderId =
      payment.order?._id || payment.order;

    const cachedOrder = orders.find(
      (order) => String(order._id) === String(orderId)
    );

    return {
      ...payment,
      order: {
        ...(cachedOrder || {}),
        ...(typeof payment.order === "object" && payment.order !== null
          ? payment.order
          : {}),
      },
    };
  });

  if (search.trim()) {
    const q = search.trim().toLowerCase();

    list = list.filter((payment) => {
      const order = payment.order || {};
      const contact = order.contact || payment.contact || {};

      const searchable = [
        payment.paymentNumber,
        payment.transactionId,
        payment.chequeNumber,
        payment.bankName,
        payment.notes,
        order.orderNumber,
        order.customerName,
        contact.company,
        contact.name,
        contact.phone,
        order.customerPhone,
      ];

      return searchable.some((value) =>
        String(value || "").toLowerCase().includes(q)
      );
    });
  }

  if (paymentMode) {
    list = list.filter(
      (payment) => payment.paymentMode === paymentMode
    );
  }

  if (status) {
    list = list.filter(
      (payment) => payment.status === status
    );
  }

  if (from) {
    list = list.filter(
      (payment) => paymentDateKey(payment.paymentDate) >= from
    );
  }

  if (to) {
    list = list.filter(
      (payment) => paymentDateKey(payment.paymentDate) <= to
    );
  }

  return list.sort(byDateDesc("createdAt"));
}

export async function getPaymentByIdFromCache(id) {
  return getCachedByModuleAndId("payments", "/payment", id);
}

export async function getPaymentSummaryFromCache() {
  const payments = await getPaymentsFromCache();

  const now = new Date();
  const today =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const completed = payments.filter(
    (payment) => payment.status === "Completed"
  );

  const todayPayments = completed.filter(
    (payment) => paymentDateKey(payment.paymentDate) === today
  );

  return {
    totalCollected: completed.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0
    ),

    totalCollectedCount: completed.length,

    totalToday: todayPayments.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0
    ),

    totalTodayCount: todayPayments.length,

    byStatus: ["Completed", "Pending", "Cancelled"].map((name) => {
      const rows = payments.filter(
        (payment) => payment.status === name
      );

      return {
        _id: name,
        count: rows.length,
        amount: rows.reduce(
          (sum, payment) => sum + (Number(payment.amount) || 0),
          0
        ),
      };
    }),
  };
}

export async function getPaymentsByOrderFromCache(orderId) {
  const strId = String(orderId);
  const order = await getCachedByModuleAndId("orders", "/order", strId);

  const payments = await collectModule("payments", "/payment");
  const list = payments
    .filter((p) => String(p.order?._id || p.order) === strId)
    .sort(byDateDesc("createdAt"));

  return { order, data: list };
}

/* ─────────────── contacts ─────────────── */

export async function getContactsFromCache({ role } = {}) {
  const list = await collectModule("contacts", "/contacts");
  if (role) return list.filter((c) => c.role === role);
  return list;
}

export function getContactByIdFromCache(id) {
  return getCachedByModuleAndId("contacts", "/contacts", id);
}

/* ─────────────── products / production ─────────────── */

export async function getProductionsFromCache() {
  const list = await collectModule("productProductions", "/products");
  return list.sort(byDateDesc("date"));
}

export async function getProductStockFromCache() {
  return collectModule("productStock", "/products/stock");
}

/* ─────────────── raw materials ─────────────── */

export async function getRawMaterialFromCache() {
  return collectModule("rawStock", "/raw-material/stock");
}

export function getRawMaterialByIdFromCache(id) {
  return getCachedByModuleAndId("rawStock", "/raw-material/stock", id);
}

export async function getPurchasesFromCache() {
  const list = await collectModule("rawPurchases", "/raw-material/purchases");
  return list.sort((a, b) => {
    const av = new Date(a.orderedAt || a.createdAt || 0).getTime() || 0;
    const bv = new Date(b.orderedAt || b.createdAt || 0).getTime() || 0;
    return bv - av;
  });
}

export function getPurchaseByIdFromCache(id) {
  return getCachedByModuleAndId(
    "rawPurchases",
    "/raw-material/purchases",
    id
  );
}

/* ─────────────── enquiries ─────────────── */

export async function getEnquiriesFromCache() {
  const list = await collectModule("enquiries", "/enquiries");
  return list.sort(byDateDesc("createdAt"));
}

export function getEnquiryByIdFromCache(id) {
  return getCachedByModuleAndId("enquiries", "/enquiries", id);
}

/* ─────────────── follow-ups ─────────────── */

export async function getFollowUpsFromCache() {
  const list = await collectModule("follow-ups", "/follow-ups");

  return list.sort(
    (a, b) =>
      new Date(a.scheduledAt || 0) -
      new Date(b.scheduledAt || 0)
  );
}

/* ─────────────── expenses ─────────────── */


export function getExpenseByIdFromCache(id) {
  return getCachedByModuleAndId("expenses", "/expense", id);
}

/* ─────────────── workers ─────────────── */

export async function getWorkersFromCache({
  page = 1,
  limit = 100,
} = {}) {
  const list = await collectModule("workers", "/workers");

  list.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return {
    data: list.slice((safePage - 1) * limit, safePage * limit),
    pagination: {
      page: safePage,
      totalPages,
      total,
    },
  };
}

export function getWorkerByIdFromCache(id) {
  return getCachedByModuleAndId("workers", "/workers", id);
}

/* ─────────────── salaries ─────────────── */

export async function getSalariesFromCache({
  worker,
  page = 1,
  limit = 5,
} = {}) {
  let list = await collectModule("salaries", "/salaries");

  if (worker) {
    list = list.filter(
      (salary) =>
        String(salary.worker?._id || salary.worker) === String(worker)
    );
  }

  list.sort(byDateDesc("createdAt"));

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return {
    salaries: list.slice((safePage - 1) * limit, safePage * limit),
    pagination: {
      page: safePage,
      totalPages,
      total,
    },
  };
}

export function getSalaryByIdFromCache(id) {
  return getCachedByModuleAndId("salaries", "/salaries", id);
}



export async function getAttendanceFromCache(date) {
  return getAttendanceByDate(date);
}

export async function getAttendanceHistoryPageFromCache({
  page = 1,
  limit = 8,
} = {}) {
  const records = await readAttendanceHistory();

  console.log("[ATTENDANCE TRACE] Records returned:", records.map(r => r.date));

  const workersResult = await getWorkersFromCache({
    page: 1,
    limit: 1000,
  });

  const workers = workersResult?.data || [];

  const enriched = records.map((record) => {
    const eligibleWorkers = workers.filter((worker) => {
      if (!worker.joiningDate) return true;

      return (
        String(worker.joiningDate).slice(0, 10) <= record.date
      );
    });

    const absentCount = Array.isArray(record.absentWorkers)
      ? record.absentWorkers.length
      : 0;

    const totalWorkers = eligibleWorkers.length;

      console.log("[ATTENDANCE TRACE] Final page:", {
        total: enriched.length,
        dates: enriched.slice(start, start + limit).map(r => r.date),
      });

    return {
      ...record,
      totalWorkers,
      presentCount: record.allPresent
        ? totalWorkers
        : Math.max(0, totalWorkers - absentCount),
    };
  });

  const total = enriched.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;

  return {
    success: true,
    data: enriched.slice(start, start + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  };
}

