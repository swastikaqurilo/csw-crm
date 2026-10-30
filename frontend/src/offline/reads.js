import { openDb } from "../db/database.js";
import {
  httpRowsForBasePath,
  listDedicatedRecords,
  getCachedByModuleAndId,
  listOf, 
} from "./cache.js";

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

  let list = await collectModule("orders", "/orders");

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

export function getOrderByIdFromCache(id) {
  return getCachedByModuleAndId("orders", "/orders", id);
}

export async function getPaymentsByOrderFromCache(orderId) {
  const strId = String(orderId);
  const order = await getCachedByModuleAndId("orders", "/orders", strId);

  const payments = await collectModule("payments", "/payments");
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
  return collectModule("rawStock", "/raw-material");
}

export function getRawMaterialByIdFromCache(id) {
  return getCachedByModuleAndId("rawStock", "/raw-material", id);
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
  return list.sort(byDateDesc("dueDate"));
}

/* ─────────────── payments (all) ─────────────── */

export async function getPaymentsFromCache() {
  const list = await collectModule("payments", "/payments");
  return list.sort(byDateDesc("createdAt"));
}

/* ─────────────── expenses ─────────────── */

export async function getExpensesFromCache() {
  const list = await collectModule("expenses", "/expenses");
  return list.sort(byDateDesc("date"));
}

export function getExpenseByIdFromCache(id) {
  return getCachedByModuleAndId("expenses", "/expenses", id);
}