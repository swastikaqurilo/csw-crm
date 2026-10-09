import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, X, Truck, MapPin, FileText, ReceiptText, RefreshCw, Package,
  UserRound, CalendarDays, CreditCard, IndianRupee, Pencil, Trash2, Wallet,
  Receipt, ChevronLeft, ChevronRight, CheckCircle2, Clock3, Factory,
  AlertCircle, Layers, AlertTriangle,
} from "lucide-react";
import logo from "../assets/cswlogo.png";
import { toast } from "react-toastify";
import {
  getOrders, getOrderById, createOrder, updateOrder, updateOrderStatus,
  deleteOrder, getContacts, generateInvoice, getOrderInvoice,
  getPaymentsByOrder, createPayment,
} from "../api/api";

/* ================================================================
 *  CONSTANTS
 * ================================================================ */
const ORDER_STATUSES = ["Draft", "Confirmed", "In Production", "Ready for Dispatch", "Dispatched", "Delivered", "Cancelled"];
const PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Overdue"];
const ORDERS_PER_PAGE = 8;
const IN_PROCESS = ["Confirmed", "In Production", "Ready for Dispatch"];

const EMPTY_ITEM = () => ({ size: "", quantity: "", rate: "", discount: "0" });
const emptyOrderForm = () => ({
  contact: "", enquiry: "", items: [EMPTY_ITEM()], discount: "0",
  taxPercent: "18", expectedDeliveryDate: "", shippingAddress: "",
  billingAddress: "", notes: "",
});
const emptyPaymentForm = () => ({
  amount: "", paymentMode: "UPI", paymentDate: new Date().toISOString().split("T")[0],
  paidFrom: "", transactionId: "", chequeNumber: "", bankName: "", notes: "",
});

/* ================================================================
 *  HELPERS
 * ================================================================ */
const currency = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const toInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

function getReelSpecs(sizeInput) {
  const kg = parseFloat(String(sizeInput ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(kg) || kg <= 0) return { kg: 0, spoolKg: 0, steelKg: 0 };
  const spoolKg = kg <= 2 ? 0.2 : kg <= 5 ? 0.6 : 0.7;
  return { kg, spoolKg, steelKg: Math.max(0, kg - spoolKg) };
}
const sizeToNumberString = (v) => {
  const kg = parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(kg) && kg > 0 ? String(kg) : "";
};

const contactName = (c) => (c ? c.company || c.name || c.email || "Unknown Contact" : "Unknown Contact");
const contactPerson = (c) => (c ? c.name || c.email || "—" : "—");
const itemName = (i) => (i ? i.productName || (i.size ? `Reel ${i.size}` : "Unknown Item") : "Unknown Item");
const itemsLabel = (o) => {
  if (!o?.items?.length) return "—";
  if (o.items.length === 1) return itemName(o.items[0]);
  return `${itemName(o.items[0])} + ${o.items.length - 1} more`;
};
const itemsQuantity = (o) => {
  if (!o?.items?.length) return "—";
  return o.items.map((i) => `${Number(i.quantity || 0).toLocaleString("en-IN")} ${i.unit || "Reel"}`).join(", ");
};

const STATUS_STYLE = {
  Delivered: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  Dispatched: { badge: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck },
  "Ready for Dispatch": { badge: "border-violet-200 bg-violet-50 text-violet-700", icon: Package },
  "In Production": { badge: "border-amber-200 bg-amber-50 text-amber-700", icon: Factory },
  Confirmed: { badge: "border-blue-200 bg-blue-50 text-blue-700", icon: CheckCircle2 },
  Cancelled: { badge: "border-rose-200 bg-rose-50 text-rose-700", icon: AlertCircle },
  Draft: { badge: "border-slate-200 bg-slate-50 text-slate-600", icon: FileText },
};
const PAYMENT_STYLE = {
  Paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Partial: "border-amber-200 bg-amber-50 text-amber-700",
  Overdue: "border-rose-200 bg-rose-50 text-rose-700",
  Pending: "border-slate-200 bg-slate-50 text-slate-600",
};

/* ================================================================
 *  THEME
 * ================================================================ */
const BTN = "inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = `${BTN} bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] px-4 text-white shadow-[0_1px_2px_rgba(10,30,63,0.2)] hover:from-[#0a1e3f] hover:to-[#06142b] hover:shadow-[0_4px_12px_rgba(10,30,63,0.22)]`;
const BTN_SECONDARY = `${BTN} border border-slate-200 bg-white px-4 font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`;
const BTN_DANGER = `${BTN} border border-rose-200 bg-white px-4 text-rose-600 hover:bg-rose-50 hover:shadow-[0_2px_8px_rgba(225,29,72,0.08)]`;
const BTN_CHIP = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:h-8";
const FILTER_SELECT = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition hover:border-slate-300 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10 sm:w-auto";
const OVERLAY = "fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4";
const SHEET = "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.35)] sm:rounded-2xl";
const TH = "px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500";

/* ================================================================
 *  PRIMITIVES
 * ================================================================ */
const StatusPill = ({ status }) => {
  const { badge, icon: Icon } = STATUS_STYLE[status] || STATUS_STYLE.Draft;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge}`}>
      <Icon size={12} />
      {status || "Draft"}
    </span>
  );
};
const PaymentBadge = ({ status }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PAYMENT_STYLE[status] || PAYMENT_STYLE.Pending}`}>
    {status || "Pending"}
  </span>
);
const Field = ({ label, required, hint, className = "", children }) => (
  <div className={className}>
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);
const SectionHeading = ({ icon: Icon, title, wrapper = "bg-slate-100 text-slate-500" }) => (
  <div className="mb-3 flex items-center gap-2">
    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-slate-200/60 ${wrapper}`}><Icon size={14} /></div>
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
  </div>
);
const DetailRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="shrink-0 text-[11px] font-medium text-slate-400">{label}</span>
    <span className="max-w-[65%] break-words text-right text-xs font-semibold leading-5 text-slate-700">{value || "—"}</span>
  </div>
);
const DetailMetric = ({ label, value, strong }) => (
  <div className="min-w-0">
    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
    <span className={`mt-1 block break-words text-xs tabular-nums ${strong ? "font-bold text-slate-800" : "font-semibold text-slate-700"}`}>{value || "—"}</span>
  </div>
);
const Skeleton = ({ width = "w-20", rounded }) => (
  <div className={`h-4 ${width} animate-pulse bg-slate-100 ${rounded ? "rounded-full" : "rounded"}`} />
);
const TimelineItem = ({ title, description, date, active }) => (
  <div className="relative">
    <span className={`absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ring-1 ${active ? "bg-[#0a1e3f] ring-[#0a1e3f]/20" : "bg-slate-300 ring-slate-200"}`} />
    <p className="text-xs font-semibold text-slate-700">{title}</p>
    <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
    <span className="mt-1.5 block text-[10px] font-medium text-slate-400">{date}</span>
  </div>
);
const KpiCard = ({ label, value, description, icon: Icon, tone = "slate" }) => {
  const t = {
    slate: ["ring-slate-200/70", "bg-slate-100", "text-slate-600", "bg-slate-400"],
    emerald: ["ring-emerald-200/70", "bg-emerald-50", "text-emerald-600", "bg-emerald-500"],
    amber: ["ring-amber-200/70", "bg-amber-50", "text-amber-600", "bg-amber-500"],
    sky: ["ring-sky-200/70", "bg-sky-50", "text-sky-600", "bg-sky-500"],
  }[tone] || ["ring-slate-200/70", "bg-slate-100", "text-slate-600", "bg-slate-400"];
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_20px_-10px_rgba(15,23,42,0.15)] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
          <p className="mt-1.5 truncate text-lg font-semibold leading-tight tabular-nums tracking-tight text-slate-900 sm:text-xl">{value}</p>
          <p className="mt-1 truncate text-[11px] text-slate-500">{description}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${t[0]} ${t[1]} ${t[2]}`}><Icon size={15} strokeWidth={2.2} /></div>
      </div>
      <div className="mt-3 h-px w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full w-6 rounded-full ${t[3]} transition-all duration-300 group-hover:w-12`} />
      </div>
    </div>
  );
};

/* Shared modal shell */
function Modal({ onClose, busy, z = "z-[100]", width = "sm:max-w-3xl", children }) {
  return (
    <div className={`${OVERLAY} ${z}`} onClick={() => !busy && onClose()}>
      <div className={`${SHEET} ${width}`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
function ModalHeader({ title, subtitle, badges, onClose, busy, leadingIcon, tone = "default" }) {
  const warn = tone === "warn";
  return (
    <div className={`relative flex shrink-0 items-start justify-between gap-3 border-b px-4 py-4 sm:px-6 sm:py-5 ${warn ? "border-amber-100 bg-amber-50/60" : "border-slate-100 bg-gradient-to-b from-slate-50/80 to-white"}`}>
      {!warn && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#0a1e3f] via-slate-500 to-transparent" />}
      <div className="flex min-w-0 items-start gap-3">
        {leadingIcon && <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${warn ? "bg-amber-100 text-amber-700" : "bg-[#0a1e3f]"}`}>{leadingIcon}</div>}
        <div className="min-w-0">
          {badges}
          <h2 className="mt-0.5 truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
        <X size={18} />
      </button>
    </div>
  );
}
function ModalFooter({ children }) {
  return <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 sm:px-6 sm:py-4">{children}</div>;
}

/* Generic confirm */
function ConfirmDialog({ title, message, confirmLabel, tone = "primary", onConfirm, onClose }) {
  const toneMap = {
    danger: ["border-rose-100 bg-rose-50/60", "bg-rose-100 text-rose-700 ring-rose-200/70", "bg-rose-600 hover:bg-rose-700 hover:shadow-[0_4px_12px_rgba(225,29,72,0.25)]"],
    emerald: ["border-emerald-100 bg-emerald-50/60", "bg-emerald-100 text-emerald-700 ring-emerald-200/70", "bg-emerald-600 hover:bg-emerald-700 hover:shadow-[0_4px_12px_rgba(5,150,105,0.25)]"],
    sky: ["border-sky-100 bg-sky-50/60", "bg-sky-100 text-sky-700 ring-sky-200/70", "bg-sky-600 hover:bg-sky-700 hover:shadow-[0_4px_12px_rgba(2,132,199,0.25)]"],
    primary: ["border-amber-100 bg-amber-50/60", "bg-amber-100 text-amber-700 ring-amber-200/70", "bg-[#0a1e3f] hover:bg-[#06142b] hover:shadow-[0_4px_12px_rgba(10,30,63,0.25)]"],
  }[tone] || [];
  return (
    <Modal onClose={onClose} z="z-[140]" width="sm:max-w-md">
      <div className={`flex shrink-0 items-start gap-3 border-b px-4 py-4 sm:px-5 ${toneMap[0]}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${toneMap[1]}`}>
          {tone === "danger" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">{message}</p>
        </div>
        <button type="button" onClick={onClose} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/70 hover:text-slate-700"><X size={17} /></button>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
        <button type="button" onClick={onClose} className={`${BTN_SECONDARY} h-9 sm:w-auto`}>Cancel</button>
        <button type="button" onClick={onConfirm} className={`${BTN} ${toneMap[2]} h-9 px-4 text-xs text-white`}>
          <CheckCircle2 size={14} />{confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function EmptyOrders({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center sm:py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/70"><Package size={22} /></div>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">No orders found</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Try adjusting your search or filters, or create a new purchase order.</p>
      <button type="button" onClick={onNew} className={`${BTN_PRIMARY} mt-5 h-9 px-3.5 text-xs`}><Plus size={14} /> New Order</button>
    </div>
  );
}

/* ================================================================
 *  KPI CONFIG
 * ================================================================ */
const KPI_CONFIG = [
  { key: "total", label: "Total Orders", icon: FileText, tone: "slate", desc: "All purchase orders" },
  { key: "inProcess", label: "In Process", icon: Factory, tone: "amber", desc: "Awaiting dispatch" },
  { key: "dispatched", label: "Dispatched", icon: Truck, tone: "sky", desc: "In transit or delivered" },
  { key: "value", label: "Order Value", icon: IndianRupee, tone: "emerald", desc: "Total on this page", money: true },
];

/* ================================================================
 *  MAIN
 * ================================================================ */
function Orders() {
  /* ── data ── */
  const [orders, setOrders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  /* ── filters ── */
  const [filters, setFilters] = useState({ search: "", status: "All", payment: "All" });
  const patchFilters = (p) => setFilters((f) => ({ ...f, ...p }));

  /* ── flash ── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  /* ── view order modal ── */
  const [view, setView] = useState(null); // { order, loading, invoice, invoiceLoading, invoiceOpen }

  /* ── create/edit order modal ── */
  const [modal, setModal] = useState(null); // { editing, form, customerMode, newName, newPhone }

  /* ── payments modal (viewer) ── */
  const [payments, setPayments] = useState(null); // { order, list, loading }

  /* ── add payment modal ── */
  const [addPayment, setAddPayment] = useState(null); // { form, submitting }

  /* ── reserved-conflict modal ── */
  const [reserved, setReserved] = useState(null); // { conflict, order, newStatus }

  /* ── confirm dialog ── */
  const [confirm, setConfirm] = useState(null);

  /* ── data loaders ── */
  const fetchOrders = async (pageOverride) => {
    try {
      setLoading(true);
      setError("");
      const p = pageOverride ?? pagination.page;
      const params = { page: p, limit: ORDERS_PER_PAGE };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status !== "All") params.status = filters.status;
      if (filters.payment !== "All") params.paymentStatus = filters.payment;

      const res = await getOrders(params);
      const r = res?.data;
      if (!r?.success) throw new Error(r?.message || "Failed to fetch orders");
      setOrders(r.data || []);
      setPagination({ page: p, pages: Math.max(1, r.pages || 1), total: r.total || 0 });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await getContacts({ limit: 100 });
      const r = res?.data;
      if (r?.success) setContacts((r.data || []).filter((c) => c.role === "customer"));
    } catch (err) {
      console.error("Fetch contacts error:", err);
    }
  };

  useEffect(() => { fetchContacts(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchOrders(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.status, filters.payment]);

  /* ── KPI ── */
  const stats = useMemo(() => ({
    total: pagination.total,
    inProcess: orders.filter((o) => IN_PROCESS.includes(o.status)).length,
    dispatched: orders.filter((o) => o.status === "Dispatched" || o.status === "Delivered").length,
    value: orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0),
  }), [orders, pagination.total]);

  /* ── modal openers ── */
  const openViewOrder = async (order) => {
    if (!order?._id) return;
    setView({ order, loading: true, invoice: null, invoiceLoading: false, invoiceOpen: false });
    try {
      const [oRes, iRes] = await Promise.all([getOrderById(order._id), getOrderInvoice(order._id)]);
      setView((v) => v && v.order._id === order._id ? {
        ...v,
        order: oRes?.data?.success ? oRes.data.data : v.order,
        invoice: iRes?.data?.success ? iRes.data.data : null,
        loading: false,
      } : v);
    } catch (err) {
      if (err?.response?.status !== 404) console.error("Fetch order/invoice details error:", err);
      setView((v) => (v ? { ...v, loading: false } : v));
    }
  };

  const closeView = () => { if (!saving) setView(null); };

  const openCreateModal = () => setModal({
    editing: null, form: emptyOrderForm(), customerMode: "existing", newName: "", newPhone: "",
  });

  const openEditModal = (order) => {
    if (!order) return;
    setModal({
      editing: order,
      customerMode: "existing",
      newName: "", newPhone: "",
      form: {
        contact: order.contact?._id || order.contact || "",
        enquiry: order.enquiry?._id || order.enquiry || "",
        items: order.items?.length
          ? order.items.map((i) => ({ size: i.size || "", quantity: i.quantity ?? "", rate: i.rate ?? "", discount: i.discount ?? "0" }))
          : [EMPTY_ITEM()],
        discount: order.discount ?? "0",
        taxPercent: order.taxPercent ?? "18",
        expectedDeliveryDate: toInputDate(order.expectedDeliveryDate),
        shippingAddress: order.shippingAddress || "",
        billingAddress: order.billingAddress || "",
        notes: order.notes || "",
      },
    });
  };

  const closeModal = () => { if (!saving) setModal(null); };
  const setForm = (patch) => setModal((m) => (m ? { ...m, form: { ...m.form, ...patch } } : m));
  const setModalField = (patch) => setModal((m) => (m ? { ...m, ...patch } : m));

  const updateItem = (i, patch) => setForm({ items: modal.form.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const addItemRow = () => setForm({ items: [...modal.form.items, EMPTY_ITEM()] });
  const removeItemRow = (i) => setForm({ items: modal.form.items.length > 1 ? modal.form.items.filter((_, idx) => idx !== i) : modal.form.items });

  /* ── preview ── */
  const preview = useMemo(() => {
    if (!modal) return { subTotal: 0, tax: 0, grandTotal: 0 };
    let sub = 0;
    for (const it of modal.form.items) {
      const q = Number(it.quantity) || 0;
      const r = Number(it.rate) || 0;
      const d = Number(it.discount) || 0;
      sub += Math.max(0, q * r - d);
    }
    const disc = Number(modal.form.discount) || 0;
    const taxable = Math.max(0, sub - disc);
    const tax = taxable * ((Number(modal.form.taxPercent) || 0) / 100);
    return { subTotal: sub, tax, grandTotal: taxable + tax };
  }, [modal]);

  /* ── validate + payload ── */
  const validate = () => {
    const f = modal.form;
    if (modal.customerMode === "existing" && !f.contact) return "Please select a customer.";
    if (modal.customerMode === "new") {
      const name = modal.newName.trim();
      const phone = modal.newPhone.trim();
      if (!name) return "Customer name is required.";
      if (name.length < 2) return "Customer name must be at least 2 characters.";
      if (!phone) return "Customer phone is required.";
      if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) return "Enter a valid 10-digit Indian mobile number (starts with 6–9).";
    }
    if (!f.items.filter((it) => it.size).length) return "Add at least one item.";
    for (let i = 0; i < f.items.length; i++) {
      const it = f.items[i];
      if (!it.size) continue;
      if (!it.quantity || Number(it.quantity) <= 0) return `Row ${i + 1}: quantity must be > 0.`;
      if (Number(it.rate || 0) < 0) return `Row ${i + 1}: rate cannot be negative.`;
    }
    return null;
  };

  const buildItems = () => modal.form.items
    .filter((it) => it.size && Number(it.quantity) > 0)
    .map((it) => {
      const specs = getReelSpecs(it.size);
      return { size: it.size, quantity: Number(it.quantity), rate: Number(it.rate || 0), discount: Number(it.discount || 0), spoolKg: specs.spoolKg, steelKg: specs.steelKg };
    });

  /* ── create / update ── */
  const handleCreate = async () => {
    const err = validate();
    if (err) return toast.error(err);
    try {
      setSaving(true);
      const f = modal.form;
      const payload = {
        items: buildItems(),
        discount: Number(f.discount || 0),
        taxPercent: Number(f.taxPercent || 18),
        expectedDeliveryDate: f.expectedDeliveryDate || undefined,
        shippingAddress: f.shippingAddress.trim(),
        billingAddress: f.billingAddress.trim(),
        notes: f.notes.trim(),
      };
      if (f.enquiry.trim()) payload.enquiry = f.enquiry.trim();
      if (modal.customerMode === "existing") payload.contact = f.contact;
      else { payload.customerName = modal.newName.trim(); payload.customerPhone = modal.newPhone.trim(); }

      const res = await createOrder(payload);
      if (!res?.data?.success) throw new Error(res?.data?.message || "Failed to create order");
      const created = res.data.data;
      toast.success(`Order ${created.orderNumber} created`);
      setModal(null);
      await fetchOrders();
      if (created?._id) await openViewOrder(created);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create order.");
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!modal.editing?._id) return;
    try {
      setSaving(true);
      const f = modal.form;
      const isDraft = modal.editing.status === "Draft";
      const payload = {
        expectedDeliveryDate: f.expectedDeliveryDate || undefined,
        shippingAddress: f.shippingAddress.trim(),
        billingAddress: f.billingAddress.trim(),
        notes: f.notes.trim(),
        discount: Number(f.discount || 0),
        taxPercent: Number(f.taxPercent || 18),
      };
      if (isDraft) {
        const err = validate();
        if (err) { toast.error(err); return; }
        payload.items = buildItems();
      }
      const res = await updateOrder(modal.editing._id, payload);
      if (!res?.data?.success) throw new Error(res?.data?.message || "Failed to update order");
      const updated = res.data.data;
      toast.success(`Order ${updated.orderNumber} updated`);
      setModal(null);
      await fetchOrders();
      if (updated?._id) await openViewOrder(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update order.");
    } finally { setSaving(false); }
  };

  /* ── status change ── */
  const performStatusChange = async (order, newStatus, extra = {}) => {
    try {
      const res = await updateOrderStatus(order._id, { status: newStatus, ...extra });
      if (!res?.data?.success) throw new Error(res?.data?.message || "Failed to update order status");
      const updated = res.data.data;
      setOrders((cur) => cur.map((o) => (o._id === order._id ? { ...o, ...updated, status: newStatus } : o)));
      setView((v) => v && v.order._id === order._id ? { ...v, order: { ...v.order, ...updated, status: newStatus } } : v);
      toast.success(`Order ${order.orderNumber} marked as ${newStatus}`);
    } catch (err) {
      const body = err?.response?.data ?? err;
      if (body?.code === "RESERVED_CONFLICT" && body?.data) {
        setReserved({ conflict: body.data, order, newStatus });
        return;
      }
      toast.error(body?.message || err?.message || "Failed to update order status.");
    }
  };

  const handleStatusChange = (order, newStatus) => {
    if (!order?._id || !newStatus || newStatus === order.status) return;
    const meta = {
      Confirmed: { title: "Confirm this order?", message: "Confirming will deduct stock from inventory. If the deduction dips into reserved stock, you'll be prompted to approve that separately.", confirmLabel: "Yes, Confirm Order", confirmTone: "primary" },
      Dispatched: { title: "Mark as dispatched?", message: "This updates the order status to Dispatched. Stock was already deducted at confirmation.", confirmLabel: "Yes, Mark Dispatched", confirmTone: "sky" },
      Delivered: { title: "Mark as delivered?", message: "Confirm delivery to close this order out.", confirmLabel: "Yes, Mark Delivered", confirmTone: "emerald" },
      Cancelled: { title: "Cancel this order?", message: "Cancelling will restore any deducted stock back to inventory. This cannot be undone.", confirmLabel: "Yes, Cancel Order", confirmTone: "danger" },
    }[newStatus] || { title: `Change status to "${newStatus}"?`, message: "Are you sure you want to proceed?", confirmLabel: "Confirm", confirmTone: "primary" };
    setConfirm({ ...meta, onConfirm: () => performStatusChange(order, newStatus) });
  };

  const handleReservedConfirm = async () => {
    if (!reserved) return;
    const { order, newStatus } = reserved;
    try {
      setSaving(true);
      await performStatusChange(order, newStatus, { allowReserved: true });
      setReserved(null);
    } finally { setSaving(false); }
  };

  /* ── delete ── */
  const handleDelete = (order) => {
    if (!order?._id) return;
    if (!["Draft", "Cancelled"].includes(order.status)) return toast.warn("Only Draft or Cancelled orders can be deleted.");
    setConfirm({
      title: `Delete ${order.orderNumber}?`,
      message: "This action cannot be undone.",
      confirmLabel: "Yes, Delete",
      confirmTone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        try {
          setDeleting(true);
          const res = await deleteOrder(order._id);
          if (!res?.data?.success) throw new Error(res?.data?.message || "Failed to delete order");
          toast.success(`Order ${order.orderNumber} deleted`);
          setView(null);
          await fetchOrders();
        } catch (err) {
          toast.error(err?.response?.data?.message || "Failed to delete order");
        } finally { setDeleting(false); }
      },
    });
  };

  /* ── invoice ── */
  const handleGenerateInvoice = async (order) => {
    if (!order?._id) return;
    try {
      setView((v) => (v ? { ...v, invoiceLoading: true } : v));
      setError("");
      const res = await generateInvoice(order._id);
      if (!res?.data?.success) throw new Error(res?.data?.message || "Failed to generate invoice");
      setView((v) => (v ? { ...v, invoice: res.data.data, invoiceLoading: false, invoiceOpen: true } : v));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to generate invoice.");
      setView((v) => (v ? { ...v, invoiceLoading: false } : v));
    }
  };

  /* ── payments ── */
  const openPayments = async (order) => {
    if (!order?._id) return;
    try {
      setPayments({ order, list: [], loading: true });
      const res = await getPaymentsByOrder(order._id);
      const data = res.data;
      setPayments({ order: { ...order, ...(data.order || {}) }, list: data.data || [], loading: false });
    } catch (err) {
      console.error("Failed to fetch payments:", err);
      toast.error(err?.response?.data?.message || "Failed to load payment details");
      setPayments(null);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!payments?.order?._id) return;
    const amount = Number(addPayment.form.amount);
    if (!amount || amount <= 0) return toast.warn("Please enter a valid payment amount.");
    const remaining = Number(payments.order.grandTotal || 0) - Number(payments.order.amountPaid || 0);
    if (amount > remaining) return toast.warn(`Payment cannot exceed the remaining amount of ₹${remaining.toLocaleString("en-IN")}.`);
    try {
      setAddPayment((p) => ({ ...p, submitting: true }));
      const f = addPayment.form;
      await createPayment({
        order: payments.order._id,
        contact: payments.order.contact?._id || payments.order.contact,
        amount, paymentMode: f.paymentMode, paymentDate: f.paymentDate,
        paidFrom: f.paidFrom, transactionId: f.transactionId,
        chequeNumber: f.chequeNumber, bankName: f.bankName, notes: f.notes,
      });
      const res = await getPaymentsByOrder(payments.order._id);
      const data = res.data;
      setPayments((p) => ({ ...p, order: { ...p.order, ...(data.order || {}) }, list: data.data || [] }));
      setAddPayment(null);
      toast.success(`Payment of ₹${amount.toLocaleString("en-IN")} recorded`);
      fetchOrders();
    } catch (err) {
      console.error("Failed to create payment:", err);
      toast.error(err?.response?.data?.message || "Failed to add payment.");
    } finally { setAddPayment((p) => (p ? { ...p, submitting: false } : p)); }
  };

  /* ── pagination ── */
  const firstShown = pagination.total === 0 ? 0 : (pagination.page - 1) * ORDERS_PER_PAGE + 1;
  const lastShown = Math.min(pagination.page * ORDERS_PER_PAGE, pagination.total);
  const goPage = (p) => { if (p >= 1 && p <= pagination.pages) fetchOrders(p); };

  /* ── primary action button ── */
  const renderPrimaryAction = (order) => {
    if (!order) return null;
    const map = {
      Draft: { status: "Confirmed", label: "Confirm Order", icon: CheckCircle2, cls: "bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white hover:from-[#0a1e3f] hover:to-[#06142b]" },
      Confirmed: { status: "Ready for Dispatch", label: "Ready for Dispatch", icon: Package, cls: "bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white hover:from-[#0a1e3f] hover:to-[#06142b]" },
      "In Production": { status: "Ready for Dispatch", label: "Ready for Dispatch", icon: Package, cls: "bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white hover:from-[#0a1e3f] hover:to-[#06142b]" },
      "Ready for Dispatch": { status: "Dispatched", label: "Dispatch Order", icon: Truck, cls: "bg-sky-600 text-white hover:bg-sky-700" },
      Dispatched: { status: "Delivered", label: "Mark Delivered", icon: CheckCircle2, cls: "bg-emerald-600 text-white hover:bg-emerald-700" },
    }[order.status];
    if (!map) return null;
    const Icon = map.icon;
    return (
      <button type="button" onClick={() => handleStatusChange(order, map.status)}
        className={`col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-[0_1px_2px_rgba(10,30,63,0.2)] transition-all active:scale-[0.98] sm:h-9 ${map.cls}`}>
        <Icon size={13} /> {map.label}
      </button>
    );
  };

  /* ================================================================
   *  RENDER
   * ================================================================ */
  return (
    <div className="min-h-full min-w-0 space-y-4 pb-8 sm:space-y-5">
      {/* HEADER */}
      <section className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Purchase Orders · Fulfilment
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a1e3f] sm:text-[28px] sm:leading-tight">Orders</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Manage customer purchase orders, production and fulfilment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fetchOrders()} disabled={loading} className={`${BTN_SECONDARY} h-10`}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button type="button" onClick={openCreateModal} className={`${BTN_PRIMARY} h-10 flex-1 sm:flex-none`}>
            <Plus size={16} /> New Order
          </button>
        </div>
      </section>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Unable to load orders</p>
            <p className="mt-0.5 break-words text-rose-600">{error}</p>
          </div>
        </div>
      )}

      {/* KPI */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {KPI_CONFIG.map((k) => <KpiCard key={k.key} {...k} value={k.money ? currency(stats[k.key]) : stats[k.key]} />)}
      </section>

      {/* FILTERS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => patchFilters({ search: e.target.value })}
              placeholder="Search by order number, customer or phone..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0a1e3f] focus:bg-white focus:ring-4 focus:ring-[#0a1e3f]/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select className={FILTER_SELECT} value={filters.status} onChange={(e) => patchFilters({ status: e.target.value })}>
              <option value="All">All Status</option>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={FILTER_SELECT} value={filters.payment} onChange={(e) => patchFilters({ payment: e.target.value })}>
              <option value="All">All Payments</option>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* LIST */}
      <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-1 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Manufacturing &amp; Dispatch Log</h2>
            <p className="mt-1 text-xs text-slate-500">Purchase orders and current fulfilment status.</p>
          </div>
          <div className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:self-auto">
            {loading ? "Updating…" : `${orders.length} shown`}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2.5 px-4 py-4">
                  <div className="flex items-center justify-between"><Skeleton width="w-24" /><Skeleton width="w-20" rounded /></div>
                  <Skeleton width="w-40" /><Skeleton width="w-28" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <EmptyOrders onNew={openCreateModal} />
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((order) => (
                <div key={order._id} role="button" tabIndex={0}
                  onClick={() => openViewOrder(order)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewOrder(order); } }}
                  className="cursor-pointer px-4 py-3.5 transition active:bg-slate-50 focus:bg-slate-50 focus:outline-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-[#0a1e3f]">{order.orderNumber}</span>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400"><CalendarDays size={11} />{fmtDate(order.orderDate)}</div>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-100 text-slate-500 ring-1 ring-slate-200"><UserRound size={14} /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{contactName(order.contact)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{contactPerson(order.contact)}</p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <p className="truncate text-sm font-medium text-slate-700">{itemsLabel(order)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{itemsQuantity(order)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums text-slate-800">{currency(order.grandTotal)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{order.amountPaid ? `${currency(order.amountPaid)} paid` : "No payment"}</p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); openPayments(order); }} className="shrink-0 rounded-full transition active:scale-95">
                      <PaymentBadge status={order.paymentStatus} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className={TH}>Order</th>
                <th className={TH}>Customer</th>
                <th className={TH}>Items / Qty</th>
                <th className={TH}>Value</th>
                <th className={TH}>Payment</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: ORDERS_PER_PAGE }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-5 py-4"><Skeleton width="w-24" /><Skeleton width="w-16" /></td>
                  <td className="px-4 py-4"><Skeleton width="w-28" /><Skeleton width="w-20" /></td>
                  <td className="px-4 py-4"><Skeleton width="w-32" /><Skeleton width="w-20" /></td>
                  <td className="px-4 py-4"><Skeleton width="w-20" /></td>
                  <td className="px-4 py-4"><Skeleton width="w-16" rounded /></td>
                  <td className="px-5 py-4"><Skeleton width="w-24" rounded /></td>
                </tr>
              )) : orders.length === 0 ? (
                <tr><td colSpan="6"><EmptyOrders onNew={openCreateModal} /></td></tr>
              ) : orders.map((order) => (
                <tr key={order._id} onClick={() => openViewOrder(order)} className="group cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs font-bold tracking-tight text-[#0a1e3f]">{order.orderNumber}</span>
                    <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-400"><CalendarDays size={11} />{fmtDate(order.orderDate)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-100 text-slate-500 ring-1 ring-slate-200"><UserRound size={14} /></div>
                      <div className="min-w-0">
                        <p className="max-w-[180px] truncate text-sm font-semibold text-slate-800">{contactName(order.contact)}</p>
                        <p className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400">{contactPerson(order.contact)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-[220px] truncate text-sm font-medium text-slate-700">{itemsLabel(order)}</p>
                    <p className="mt-1 max-w-[220px] truncate text-xs text-slate-400">{itemsQuantity(order)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-800">{currency(order.grandTotal)}</p>
                    <p className="mt-1 whitespace-nowrap text-[11px] text-slate-400">{order.amountPaid ? `${currency(order.amountPaid)} paid` : "No payment"}</p>
                  </td>
                  <td className="px-4 py-4" onClick={(e) => { e.stopPropagation(); openPayments(order); }}>
                    <button type="button" className="cursor-pointer rounded-full transition hover:scale-[1.03]"><PaymentBadge status={order.paymentStatus} /></button>
                  </td>
                  <td className="px-5 py-4"><StatusPill status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-center text-xs text-slate-400 sm:text-left">
            Showing <span className="font-semibold text-slate-600">{firstShown}</span> to <span className="font-semibold text-slate-600">{lastShown}</span> of <span className="font-semibold text-slate-600">{pagination.total}</span> purchase orders
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <button type="button" disabled={pagination.page <= 1 || loading} onClick={() => goPage(pagination.page - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:px-2.5">
              <ChevronLeft size={14} /> Previous
            </button>
            <div className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#0a1e3f] px-2 text-xs font-semibold tabular-nums text-white shadow-[0_1px_2px_rgba(10,30,63,0.2)] sm:h-8 sm:min-w-8">{pagination.page}</div>
            <button type="button" disabled={pagination.page >= pagination.pages || loading} onClick={() => goPage(pagination.page + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:px-2.5">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================
          ORDER DETAILS MODAL
      ============================================================ */}
      {view && (
        <Modal onClose={closeView} busy={saving} width="sm:max-w-3xl">
          <ModalHeader
            leadingIcon={<Package size={18} className="text-white" />}
            title="Order Details"
            subtitle={`Created ${fmtDate(view.order.orderDate)} · Expected ${fmtDate(view.order.expectedDeliveryDate)}`}
            badges={
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#0a1e3f]">{view.order.orderNumber}</span>
                <StatusPill status={view.order.status} />
                <PaymentBadge status={view.order.paymentStatus} />
              </div>
            }
            onClose={closeView}
            busy={saving}
          />

          <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {view.loading && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-500 shadow-sm sm:right-5 sm:top-5">
                <RefreshCw size={13} className="animate-spin" /> Loading details...
              </div>
            )}
            <div className="space-y-6">
              {/* Purchaser */}
              <div>
                <SectionHeading icon={UserRound} title="Purchaser Information" />
                <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <p className="break-words text-sm font-bold text-slate-800">{contactName(view.order.contact)}</p>
                  <p className="mt-1 break-words text-xs text-slate-500">{contactPerson(view.order.contact)}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                    <DetailRow label="Contact Person" value={view.order.contact?.name} />
                    <DetailRow label="Role" value={view.order.contact?.role} />
                    <DetailRow label="Phone" value={view.order.contact?.phone} />
                    <DetailRow label="Email" value={view.order.contact?.email} />
                    <DetailRow label="GSTIN" value={view.order.contact?.gstin} />
                    <DetailRow label="State" value={view.order.contact?.state ? `${view.order.contact.state}${view.order.contact?.stateCode ? ` (${view.order.contact.stateCode})` : ""}` : "—"} />
                    <div className="sm:col-span-2"><DetailRow label="Address" value={view.order.contact?.billingAddress || view.order.contact?.address} /></div>
                    {view.order.enquiry && <DetailRow label="Enquiry" value={view.order.enquiry?.enquiryNumber || view.order.enquiry} />}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <SectionHeading icon={Package} title="Consignment Specification" />
                <div className="space-y-3">
                  {view.order.items?.map((item, i) => (
                    <div key={item._id || i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-200 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-slate-800">{itemName(item)}</p>
                          <p className="mt-1 text-xs text-slate-400">{item.size ? `Reel ${item.size}` : `Item ${i + 1}`}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/70">
                          {Number(item.quantity || 0).toLocaleString("en-IN")} {item.unit || "Reel"}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-100 pt-3.5 sm:grid-cols-3">
                        <DetailMetric label="Rate / Unit" value={currency(item.rate)} />
                        <DetailMetric label="Item Discount" value={currency(item.discount)} />
                        <DetailMetric label="Line Amount" value={currency(item.amount)} strong />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-4">
                  <div className="space-y-2.5">
                    <DetailRow label="Subtotal" value={currency(view.order.subTotal)} />
                    <DetailRow label="Overall Discount" value={currency(view.order.discount)} />
                    <DetailRow label={`Tax (${view.order.taxPercent || 0}%)`} value={currency(view.order.taxAmount)} />
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                      <span className="text-sm font-bold text-slate-700">Grand Total</span>
                      <span className="text-base font-bold tabular-nums text-[#0a1e3f]">{currency(view.order.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div>
                <SectionHeading icon={CreditCard} title="Financial / Ledger" wrapper="bg-emerald-50 text-emerald-600" />
                <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <DetailMetric label="Order Value" value={currency(view.order.grandTotal)} strong />
                    <DetailMetric label="Amount Paid" value={currency(view.order.amountPaid)} strong />
                    <DetailMetric label="Balance Due" value={currency(Math.max(0, Number(view.order.grandTotal || 0) - Number(view.order.amountPaid || 0)))} strong />
                  </div>
                  <div className="mt-4 border-t border-slate-200/70 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-slate-400">Payment Status</span>
                      <PaymentBadge status={view.order.paymentStatus} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Logistics */}
              <div>
                <SectionHeading icon={MapPin} title="Logistics &amp; Site Address" wrapper="bg-sky-50 text-sky-600" />
                <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white p-4">
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Shipping Address</p>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-600">{view.order.shippingAddress || "No shipping address provided."}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                    <DetailMetric label="Billing Address" value={view.order.billingAddress || "Same / not provided"} />
                    <DetailMetric label="Expected Delivery" value={fmtDate(view.order.expectedDeliveryDate)} />
                    {view.order.dispatchedDate && <DetailMetric label="Dispatched" value={fmtDate(view.order.dispatchedDate)} />}
                    {view.order.deliveredDate && <DetailMetric label="Delivered" value={fmtDate(view.order.deliveredDate)} />}
                  </div>
                </div>
              </div>

              {view.order.notes && (
                <div>
                  <SectionHeading icon={FileText} title="Notes" />
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{view.order.notes}</p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <SectionHeading icon={Clock3} title="Order Status" />
                <select
                  value={view.order.status || "Draft"}
                  onChange={(e) => handleStatusChange(view.order, e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition hover:border-slate-300 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10"
                >
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Timeline */}
              <div>
                <SectionHeading icon={Clock3} title="Audit &amp; Dispatch Timeline" />
                <div className="relative space-y-5 pl-6">
                  <span className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />
                  {view.order.stockDeductedAt && <TimelineItem title="Stock deducted" description="Quantities deducted from ProductStock." date={fmtDate(view.order.stockDeductedAt)} active />}
                  {view.order.dispatchedDate && <TimelineItem title="Order dispatched" description="Order left the warehouse." date={fmtDate(view.order.dispatchedDate)} active />}
                  {view.order.deliveredDate && <TimelineItem title="Order delivered" description="Delivery confirmed." date={fmtDate(view.order.deliveredDate)} active />}
                </div>
              </div>
            </div>
          </div>

          <ModalFooter>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button"
                onClick={() => { const o = view.order; closeView(); openEditModal(o); }}
                disabled={view.order.status !== "Draft" && view.order.status !== "Confirmed"}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9">
                <Pencil size={13} /> Edit
              </button>

              <button type="button"
                onClick={() => { if (view.invoice) setView((v) => ({ ...v, invoiceOpen: true })); else handleGenerateInvoice(view.order); }}
                disabled={view.invoiceLoading || ["Draft", "Cancelled"].includes(view.order.status)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9">
                {view.invoiceLoading ? <RefreshCw size={13} className="animate-spin" /> : <ReceiptText size={13} />}
                {view.invoiceLoading ? "Loading..." : view.invoice ? "View Invoice" : "Generate Invoice"}
              </button>

              {renderPrimaryAction(view.order)}

              {["Draft", "Cancelled"].includes(view.order.status) && (
                <button type="button" onClick={() => handleDelete(view.order)} disabled={deleting}
                  className={`${BTN_DANGER} col-span-2 h-10 text-xs sm:col-span-4 sm:h-9`}>
                  <Trash2 size={13} />{deleting ? "Deleting..." : "Delete Order"}
                </button>
              )}

              {!["Draft", "Delivered", "Cancelled"].includes(view.order.status) && (
                <button type="button" onClick={() => handleStatusChange(view.order, "Cancelled")}
                  className={`${BTN_DANGER} col-span-2 h-10 text-xs sm:col-span-4 sm:h-9`}>
                  <AlertCircle size={13} /> Cancel Order
                </button>
              )}
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* ============================================================
          CREATE / EDIT ORDER MODAL
      ============================================================ */}
      {modal && (() => {
        const isEdit = Boolean(modal.editing);
        const itemsLocked = isEdit && modal.editing.status !== "Draft";
        const selectedContact = contacts.find((c) => c._id === modal.form.contact)
          || (isEdit && typeof modal.editing.contact === "object" ? modal.editing.contact : null);
        const filledItems = modal.form.items.filter((it) => it.size);
        const orderDiscount = Number(modal.form.discount) || 0;
        const fld = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
        const ta = "w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-5 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10";

        return (
          <Modal onClose={closeModal} busy={saving} z="z-[110]" width="sm:max-w-5xl">
            <ModalHeader
              leadingIcon={isEdit ? <Pencil size={18} className="text-white" /> : <Layers size={18} className="text-white" />}
              title={isEdit ? `Edit ${modal.editing.orderNumber}` : "New purchase order"}
              subtitle={isEdit ? `${contactName(modal.editing.contact)} · ${modal.editing.status}` : "Select customer, add reels, then save as draft"}
              onClose={closeModal}
              busy={saving}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
              {/* LEFT */}
              <div className="min-w-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto">
                <div className="space-y-6">
                  {/* Customer */}
                  <section>
                    <div className="mb-3 flex items-center gap-2"><UserRound size={15} className="text-[#0a1e3f]" /><h4 className="text-sm font-semibold text-slate-900">Customer</h4></div>
                    <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4 md:grid-cols-2">
                      {!isEdit && (
                        <div className="md:col-span-2">
                          <div className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:inline-flex sm:w-auto">
                            {[["existing", "Existing Customer"], ["new", "New Customer"]].map(([v, label]) => (
                              <button key={v} type="button" onClick={() => setModalField({ customerMode: v })}
                                className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-all sm:py-1.5 ${modal.customerMode === v ? "bg-[#0a1e3f] text-white shadow-[0_1px_2px_rgba(10,30,63,0.2)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isEdit && modal.customerMode === "existing" && (
                        <Field label="Customer" required className="md:col-span-2">
                          <select className={fld} value={modal.form.contact}
                            onChange={(e) => {
                              const picked = contacts.find((c) => c._id === e.target.value);
                              setForm({
                                contact: e.target.value,
                                shippingAddress: picked?.shippingAddress || picked?.address || modal.form.shippingAddress || "",
                                billingAddress: picked?.billingAddress || picked?.address || modal.form.billingAddress || "",
                              });
                            }}>
                            <option value="">Select a customer</option>
                            {contacts.map((c) => <option key={c._id} value={c._id}>{contactName(c)}{c.name && c.company ? ` — ${c.name}` : ""}</option>)}
                          </select>
                        </Field>
                      )}

                      {!isEdit && modal.customerMode === "new" && (
                        <>
                          <Field label="Customer name" required>
                            <input type="text" className={fld} value={modal.newName} onChange={(e) => setModalField({ newName: e.target.value })} placeholder="e.g. Ramesh Kumar" />
                          </Field>
                          <Field label="Phone number" required>
                            <input type="tel" inputMode="numeric" maxLength={10} className={fld}
                              value={modal.newPhone}
                              onChange={(e) => setModalField({ newPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                              placeholder="10-digit mobile e.g. 9876543210" />
                            {modal.newPhone && !/^[6-9]\d{9}$/.test(modal.newPhone) && (
                              <p className="mt-1 text-[11px] font-medium text-rose-600">Enter a valid 10-digit number starting with 6–9</p>
                            )}
                          </Field>
                          <p className="md:col-span-2 -mt-1 text-[11px] text-slate-500">A new contact will be created automatically. You can fill in company, email, and GSTIN later from the Contacts page.</p>
                        </>
                      )}

                      <Field label="Expected delivery (optional)" className={isEdit || modal.customerMode === "new" ? "md:col-span-2" : ""}>
                        <div className="relative">
                          <CalendarDays size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input className={`${fld} pl-10`} type="date" value={modal.form.expectedDeliveryDate} onChange={(e) => setForm({ expectedDeliveryDate: e.target.value })} />
                        </div>
                      </Field>

                      {modal.customerMode === "existing" && selectedContact && (
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a1e3f] text-xs font-bold text-white">{contactName(selectedContact).charAt(0).toUpperCase()}</div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{contactName(selectedContact)}</p>
                              <p className="truncate text-xs text-slate-500">{[contactPerson(selectedContact), selectedContact.phone].filter((v) => v && v !== "—").join("  ·  ")}</p>
                            </div>
                            <div className="hidden flex-wrap gap-1.5 sm:flex">
                              {selectedContact.gstin && <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200/70">{selectedContact.gstin}</span>}
                              {selectedContact.state && <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200/70">{selectedContact.state}</span>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Reels */}
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2"><Layers size={15} className="text-[#0a1e3f]" /><h4 className="text-sm font-semibold text-slate-900">Reels</h4></div>
                      {!itemsLocked && (
                        <button type="button" onClick={addItemRow} className={`${BTN_CHIP} py-1.5`}><Plus size={14} /> Add reel</button>
                      )}
                    </div>

                    {itemsLocked && (
                      <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                        <p className="text-xs leading-5 text-amber-800">This order is <strong>{modal.editing.status}</strong>. Items are locked. Cancel the order to change them.</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {modal.form.items.map((item, i) => {
                        const rowAmount = Math.max(0, Number(item.quantity || 0) * Number(item.rate || 0) - Number(item.discount || 0));
                        return (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300 sm:p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-slate-800">{item.size ? `${item.size} reel` : `Reel ${i + 1}`}</span>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <span className="text-sm font-bold tabular-nums text-slate-900">{currency(rowAmount)}</span>
                                {!itemsLocked && (
                                  <button type="button" onClick={() => removeItemRow(i)} disabled={modal.form.items.length === 1}
                                    className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 sm:h-7 sm:w-7">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <Field label="Reel size (kg)">
                              <div className="relative">
                                <input type="number" inputMode="decimal" min="0" step="0.5" disabled={itemsLocked}
                                  value={sizeToNumberString(item.size)}
                                  onChange={(e) => { const v = e.target.value; updateItem(i, { size: v ? `${v}kg` : "" }); }}
                                  placeholder="e.g. 5" className={fld} />
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                              </div>
                              {item.size && (() => {
                                const s = getReelSpecs(item.size);
                                if (!s.kg) return null;
                                return (
                                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                                    <span className="text-slate-500">Spool weight <span className="ml-1 font-bold text-slate-800">{s.spoolKg} kg</span></span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-500">Steel content <span className="ml-1 font-bold text-slate-800">{s.steelKg.toFixed(2)} kg</span></span>
                                  </div>
                                );
                              })()}
                            </Field>

                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                              <Field label="Qty"><input className={fld} type="number" inputMode="numeric" min="0" step="1" disabled={itemsLocked} value={item.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} placeholder="0" /></Field>
                              <Field label="Rate (₹)"><input className={fld} type="number" inputMode="decimal" min="0" step="0.01" disabled={itemsLocked} value={item.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} placeholder="0.00" /></Field>
                              <Field label="Discount (₹)" className="col-span-2 sm:col-span-1"><input className={fld} type="number" inputMode="decimal" min="0" step="0.01" disabled={itemsLocked} value={item.discount} onChange={(e) => updateItem(i, { discount: e.target.value })} placeholder="0.00" /></Field>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Addresses */}
                  <section>
                    <div className="mb-3 flex items-center gap-2"><MapPin size={15} className="text-[#0a1e3f]" /><h4 className="text-sm font-semibold text-slate-900">Addresses</h4></div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Shipping address">
                        <textarea className={ta} value={modal.form.shippingAddress} onChange={(e) => setForm({ shippingAddress: e.target.value })} placeholder="Delivery address" rows="3" />
                      </Field>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Billing address</label>
                          <button type="button" onClick={() => setForm({ billingAddress: modal.form.shippingAddress })} className="text-[11px] font-medium text-[#0a1e3f] hover:underline">Same as shipping</button>
                        </div>
                        <textarea className={ta} value={modal.form.billingAddress} onChange={(e) => setForm({ billingAddress: e.target.value })} placeholder="Billing address" rows="3" />
                      </div>
                    </div>
                  </section>

                  {/* Notes */}
                  <section>
                    <div className="mb-3 flex items-center gap-2"><FileText size={15} className="text-[#0a1e3f]" /><h4 className="text-sm font-semibold text-slate-900">Notes</h4></div>
                    <textarea className={ta} value={modal.form.notes} onChange={(e) => setForm({ notes: e.target.value })} placeholder="PO reference, packing instructions, etc." rows="2" />
                  </section>
                </div>
              </div>

              {/* RIGHT – summary */}
              <aside className="w-full shrink-0 border-t border-slate-200 bg-gradient-to-b from-slate-50 to-slate-50/60 lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-t-0">
                <div className="flex h-full flex-col p-4 sm:p-6">
                  <div className="mb-4 flex items-center gap-2"><Receipt size={15} className="text-[#0a1e3f]" /><h4 className="text-sm font-semibold text-slate-900">Order summary</h4></div>

                  <div className="mb-4 flex-1 space-y-2">
                    {filledItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-white py-6 text-center text-xs text-slate-400">No reels added yet</p>
                    ) : filledItems.map((it, i) => {
                      const amt = Math.max(0, Number(it.quantity || 0) * Number(it.rate || 0) - Number(it.discount || 0));
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                          <span className="font-medium text-slate-700">{it.size} × {Number(it.quantity || 0).toLocaleString("en-IN")}</span>
                          <span className="font-semibold tabular-nums text-slate-900">{currency(amt)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <Field label="Discount (₹)"><input className={fld} type="number" inputMode="decimal" min="0" step="0.01" value={modal.form.discount} onChange={(e) => setForm({ discount: e.target.value })} placeholder="0" /></Field>
                    <Field label="Tax %"><input className={fld} type="number" inputMode="decimal" min="0" step="0.01" value={modal.form.taxPercent} onChange={(e) => setForm({ taxPercent: e.target.value })} /></Field>
                  </div>

                  <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
                    <div className="flex justify-between gap-3 text-slate-600"><span>Subtotal</span><span className="font-medium tabular-nums text-slate-800">{currency(preview.subTotal)}</span></div>
                    {orderDiscount > 0 && <div className="flex justify-between gap-3 text-slate-600"><span>Discount</span><span className="font-medium tabular-nums text-emerald-600">−{currency(orderDiscount)}</span></div>}
                    <div className="flex justify-between gap-3 text-slate-600"><span>Tax ({modal.form.taxPercent || 0}%)</span><span className="font-medium tabular-nums text-slate-800">{currency(preview.tax)}</span></div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Grand total</p>
                    <p className="mt-0.5 break-words text-2xl font-bold tabular-nums tracking-tight text-slate-900">{currency(preview.grandTotal)}</p>
                  </div>
                </div>
              </aside>
            </div>

            <ModalFooter>
              <div className="flex items-center justify-between gap-3">
                <p className="hidden text-xs text-slate-500 sm:block">{isEdit ? "Changes save immediately." : "Saves as draft. Confirm later to deduct stock."}</p>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  <button type="button" onClick={closeModal} disabled={saving} className={`${BTN_SECONDARY} h-10 flex-1 sm:flex-none`}>Cancel</button>
                  <button type="button" onClick={isEdit ? handleUpdate : handleCreate} disabled={saving} className={`${BTN_PRIMARY} h-10 flex-1 sm:flex-none`}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {saving ? "Saving..." : isEdit ? "Save changes" : "Create order"}
                  </button>
                </div>
              </div>
            </ModalFooter>
          </Modal>
        );
      })()}

      {/* Invoice modal */}
      {view?.invoiceOpen && view.invoice && <InvoiceModal invoice={view.invoice} onClose={() => setView((v) => (v ? { ...v, invoiceOpen: false } : v))} />}

      {/* ============================================================
          PAYMENTS MODAL
      ============================================================ */}
      {payments && (
        <Modal onClose={() => setPayments(null)} z="z-[120]" width="sm:max-w-2xl">
          <ModalHeader
            title={`Payments — ${payments.order.orderNumber}`}
            subtitle={contactName(payments.order.contact)}
            onClose={() => setPayments(null)}
          />
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <DetailMetric label="Order Value" value={currency(payments.order.grandTotal)} strong />
              <DetailMetric label="Amount Paid" value={currency(payments.order.amountPaid)} strong />
              <DetailMetric label="Balance Due" value={currency(Math.max(0, Number(payments.order.grandTotal || 0) - Number(payments.order.amountPaid || 0)))} strong />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
              <span className="text-[11px] font-medium text-slate-400">Payment Status</span>
              <PaymentBadge status={payments.order.paymentStatus} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {payments.loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><RefreshCw size={16} className="animate-spin" /> Loading payments...</div>
            ) : payments.list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/70"><Wallet size={20} /></div>
                <p className="mt-4 text-sm font-semibold text-slate-800">No payments recorded</p>
                <p className="mt-1 text-xs text-slate-500">Add the first payment for this order.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.list.map((p) => (
                  <div key={p._id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-200 hover:bg-white hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold tabular-nums text-slate-800">{currency(p.amount)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{p.paymentMode || "—"} · {fmtDate(p.paymentDate)}</p>
                      </div>
                      <span className="max-w-[45%] shrink-0 break-all text-right text-[11px] font-medium text-slate-400">{p.transactionId || p.chequeNumber || "—"}</span>
                    </div>
                    {(p.paidFrom || p.bankName || p.notes) && (
                      <div className="mt-2 space-y-0.5 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                        {p.paidFrom && <p className="break-words">From: {p.paidFrom}</p>}
                        {p.bankName && <p className="break-words">Bank: {p.bankName}</p>}
                        {p.notes && <p className="break-words">{p.notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ModalFooter>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPayments(null)} className={`${BTN_SECONDARY} h-10 w-full sm:w-auto`}>Close</button>
              <button type="button" onClick={() => setAddPayment({ form: emptyPaymentForm(), submitting: false })} className={`${BTN_PRIMARY} h-10 w-full sm:w-auto`}>
                <Plus size={15} /> Add Payment
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* ============================================================
          ADD PAYMENT MODAL
      ============================================================ */}
      {addPayment && payments && (
        <Modal onClose={() => setAddPayment(null)} busy={addPayment.submitting} z="z-[125]" width="sm:max-w-2xl">
          <ModalHeader title="Add Payment" subtitle="Record a payment for this order" onClose={() => setAddPayment(null)} busy={addPayment.submitting} />
          <form onSubmit={handleAddPayment} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mb-5 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Order</p>
                    <p className="mt-1 truncate font-semibold text-slate-900">{payments.order.orderNumber}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-amber-600">
                      ₹{Math.max(0, Number(payments.order.grandTotal || 0) - Number(payments.order.amountPaid || 0)).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                <Field label="Payment Amount" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">₹</span>
                    <input type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="Enter amount"
                      value={addPayment.form.amount}
                      onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, amount: e.target.value } }))}
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-8 pr-3 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10" />
                  </div>
                </Field>

                <Field label="Payment Method" required>
                  <select value={addPayment.form.paymentMode} onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, paymentMode: e.target.value } }))} required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10">
                    {["UPI", "Cash", "Bank Transfer", "NEFT", "RTGS", "Cheque", "Other"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Payment Date" required>
                  <input type="date" required value={addPayment.form.paymentDate} onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, paymentDate: e.target.value } }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10" />
                </Field>

                <Field label="Paid From">
                  <input type="text" value={addPayment.form.paidFrom} onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, paidFrom: e.target.value } }))}
                    placeholder="e.g. HDFC Bank / Customer Account"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10" />
                </Field>

                <Field label="Transaction / Reference ID" className="md:col-span-2">
                  <input type="text" value={addPayment.form.transactionId} onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, transactionId: e.target.value } }))}
                    placeholder="Enter transaction or reference ID"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10" />
                </Field>

                {addPayment.form.paymentMode === "Cheque" && (
                  <>
                    <Field label="Cheque Number" required>
                      <input type="text" required value={addPayment.form.chequeNumber} onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, chequeNumber: e.target.value } }))}
                        placeholder="Enter cheque number"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10" />
                    </Field>
                    <Field label="Bank Name" required>
                      <input type="text" required value={addPayment.form.bankName} onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, bankName: e.target.value } }))}
                        placeholder="Enter bank name"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10" />
                    </Field>
                  </>
                )}

                <Field label="Notes" className="md:col-span-2">
                  <textarea rows={3} value={addPayment.form.notes} onChange={(e) => setAddPayment((p) => ({ ...p, form: { ...p.form, notes: e.target.value } }))}
                    placeholder="Add any notes about this payment..."
                    className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition hover:border-slate-400 focus:border-[#0a1e3f] focus:ring-4 focus:ring-[#0a1e3f]/10" />
                </Field>
              </div>
            </div>

            <ModalFooter>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button type="button" onClick={() => setAddPayment(null)} className={`${BTN_SECONDARY} h-10 w-full sm:w-auto`}>Cancel</button>
                <button type="submit" disabled={addPayment.submitting}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 active:scale-[0.98] disabled:opacity-60 sm:w-auto">
                  {addPayment.submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Saving...</> : <><Plus size={17} />Add Payment</>}
                </button>
              </div>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* ============================================================
          RESERVED STOCK CONFLICT
      ============================================================ */}
      {reserved && (
        <Modal onClose={() => setReserved(null)} busy={saving} z="z-[150]" width="sm:max-w-md">
          <ModalHeader
            tone="warn"
            title="Reserved stock will be used"
            subtitle={`Confirming ${reserved.order.orderNumber} exceeds the available (free) stock.`}
            onClose={() => setReserved(null)}
            busy={saving}
          />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{reserved.conflict.name}</p>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center sm:gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Free</p><p className="mt-1 text-base font-semibold tabular-nums text-emerald-700">{Number(reserved.conflict.freeQty || 0).toLocaleString("en-IN")} <span className="text-[10px] font-medium text-slate-500">{reserved.conflict.unit}</span></p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reserved</p><p className="mt-1 text-base font-semibold tabular-nums text-indigo-600">{Number(reserved.conflict.reservedQty || 0).toLocaleString("en-IN")} <span className="text-[10px] font-medium text-slate-500">{reserved.conflict.unit}</span></p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Requested</p><p className="mt-1 text-base font-semibold tabular-nums text-amber-700">{Number(reserved.conflict.requested || 0).toLocaleString("en-IN")} <span className="text-[10px] font-medium text-slate-500">{reserved.conflict.unit}</span></p></div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-900">
                <span className="font-semibold">{Number(reserved.conflict.usedFromReserved || 0).toLocaleString("en-IN")} {reserved.conflict.unit}</span> will be taken from stock reserved by the admin. This will reduce the reserved quantity on <span className="font-semibold">{reserved.conflict.size}</span> reel stock.
              </p>
            </div>
            <p className="text-xs text-slate-600">Do you grant permission to proceed?</p>
          </div>
          <ModalFooter>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setReserved(null)} disabled={saving} className={`${BTN_SECONDARY} h-9 sm:w-auto`}>No, Cancel</button>
              <button type="button" onClick={handleReservedConfirm} disabled={saving}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-all hover:bg-amber-700 active:scale-[0.98] disabled:opacity-60 sm:w-auto">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Yes, Use Reserved
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* Generic confirm */}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/* ================================================================
 *  INVOICE MODAL — A4-style printable GST tax invoice
 * ================================================================ */
function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null;

  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};
  const consignee = invoice.consignee || {};
  const items = invoice.items || [];

  const num = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
  };

  const isIGST = invoice.taxType === "IGST";
  const taxPercent = isIGST ? invoice.igstPercent || 18 : invoice.cgstPercent || 9;
  const taxAmount = isIGST ? invoice.igstAmount : Number(invoice.cgstAmount || 0) + Number(invoice.sgstAmount || 0);
  const primaryHsn = items[0]?.hsnSac || "—";

  // Meta cells config
  const metaCells = [
    ["Invoice No.", invoice.invoiceNumber || "—"], ["e-Way Bill No.", invoice.eWayBillNumber || "—"],
    ["Dated", dt(invoice.invoiceDate)], ["Mode/Terms of Payment", invoice.paymentTerms || "As per Order"],
    ["Reference No. & Date", invoice.reference || "—"], ["Other References", invoice.otherReferences || "—"],
    ["Buyer's Order No.", invoice.buyersOrderNumber || invoice.reference || "—"], ["Dated", dt(invoice.buyersOrderDate || invoice.invoiceDate)],
    ["Dispatch Doc No.", invoice.dispatchDocNumber || "—"], ["Delivery Note Date", dt(invoice.deliveryNoteDate)],
    ["Dispatched through", invoice.dispatchedThrough || "—"], ["Destination", invoice.destination || consignee.state || buyer.state || "—"],
  ];

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 pb-3 print:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Tax Invoice</p>
          <p className="mt-0.5 truncate text-xs text-slate-300">{invoice.invoiceNumber || "Invoice"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/20">
            <FileText size={14} /> Print
          </button>
          <button type="button" onClick={onClose} aria-label="Close invoice" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/20">
            <X size={17} />
          </button>
        </div>
      </div>

      <p className="mx-auto max-w-[794px] pb-2 text-center text-[11px] text-slate-300 md:hidden print:hidden">Swipe sideways to see the full invoice</p>

      <div className="mx-auto max-w-[794px] overflow-x-auto print:max-w-none print:overflow-visible">
        <div id="invoice-print" className="invoice-paper mx-auto w-full min-w-[794px] max-w-[794px] bg-white text-[10px] text-black shadow-2xl print:min-w-0 print:max-w-none print:shadow-none" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          {/* Title */}
          <div className="border border-black border-b-0 px-2 py-1.5 text-center"><h1 className="text-[16px] font-bold tracking-wide">Tax Invoice</h1></div>

          {/* Seller + meta */}
          <div className="grid grid-cols-12 border border-black">
            <div className="col-span-6 border-r border-black p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[12px] font-bold uppercase leading-tight">{seller.name || "CORVEX STEEL WIRES"}</p>
                  <p className="mt-1 whitespace-pre-line text-[9px] leading-3.5">{seller.address || "Seller address not configured"}</p>
                  <p className="mt-1.5 text-[9px]"><span className="font-semibold">GSTIN/UIN :</span> {seller.gstin || "—"}</p>
                  <p className="text-[9px]"><span className="font-semibold">State Name :</span> {seller.state || "—"}{seller.stateCode ? `, Code : ${seller.stateCode}` : ""}</p>
                </div>
                <img src={logo} alt="Company Logo" className="h-16 w-auto max-w-[120px] shrink-0 object-contain" />
              </div>
            </div>
            <div className="col-span-6">
              <div className="grid grid-cols-2">
                {metaCells.map(([label, value], i) => (
                  <div key={i} className={`px-1.5 py-1 ${i % 2 === 0 ? "border-r" : ""} border-black ${i < metaCells.length - 2 ? "border-b" : ""}`}>
                    <p className="text-[8px] text-slate-600">{label}</p>
                    <p className="font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Consignee + buyer */}
          <div className="grid grid-cols-2 border border-black border-t-0">
            {[["Consignee (Ship to)", consignee], ["Buyer (Bill to)", buyer]].map(([title, party], i) => (
              <div key={title} className={`p-2 ${i === 0 ? "border-r border-black" : ""}`}>
                <p className="text-[9px] font-bold">{title}</p>
                <p className="mt-1 text-[11px] font-bold uppercase leading-tight">{party.company || party.name || "—"}</p>
                <p className="mt-0.5 whitespace-pre-line text-[9px] leading-3.5">{party.address || "—"}</p>
                <p className="mt-1 text-[9px]"><span className="font-semibold">GSTIN/UIN</span> : {party.gstin || "—"}</p>
                <p className="text-[9px]"><span className="font-semibold">State Name</span> : {party.state || "—"}{party.stateCode ? `, Code : ${party.stateCode}` : ""}</p>
              </div>
            ))}
          </div>

          {/* Terms */}
          <div className="border border-black border-t-0 px-2 py-1">
            <p className="text-[9px]"><span className="font-semibold">Terms of Delivery</span><span className="ml-2">{invoice.termsOfDelivery || "—"}</span></p>
          </div>

          {/* Items table */}
          <table className="w-full border-collapse border border-black border-t-0">
            <thead>
              <tr className="border-b border-black">
                <th className="w-[6%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">SI<br />No.</th>
                <th className="w-[32%] border-r border-black px-1 py-1.5 text-left text-[9px] font-bold">Description of Goods</th>
                <th className="w-[12%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">HSN/SAC</th>
                <th className="w-[14%] border-r border-black px-1 py-1.5 text-right text-[9px] font-bold">Quantity</th>
                <th className="w-[12%] border-r border-black px-1 py-1.5 text-right text-[9px] font-bold">Rate</th>
                <th className="w-[8%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">per</th>
                <th className="w-[16%] px-1 py-1.5 text-right text-[9px] font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item._id || i} className="border-b border-black">
                  <td className="border-r border-black px-1 py-2 text-center align-top">{i + 1}</td>
                  <td className="border-r border-black px-1 py-2 align-top"><p className="font-semibold uppercase">{item.description || "—"}</p></td>
                  <td className="border-r border-black px-1 py-2 text-center align-top">{item.hsnSac || "—"}</td>
                  <td className="border-r border-black px-1 py-2 text-right align-top">{Number(item.quantity || 0).toLocaleString("en-IN")} {item.unit || ""}</td>
                  <td className="border-r border-black px-1 py-2 text-right align-top">{num(item.rate)}</td>
                  <td className="border-r border-black px-1 py-2 text-center align-top">{item.unit || "kg"}</td>
                  <td className="px-1 py-2 text-right align-top font-semibold">{num(item.amount)}</td>
                </tr>
              ))}

              {isIGST ? (
                <tr className="border-b border-black">
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right font-semibold italic">IGST</td>
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right">{taxPercent}</td>
                  <td className="border-r border-black px-1 py-1 text-center">%</td>
                  <td className="px-1 py-1 text-right font-semibold">{num(invoice.igstAmount)}</td>
                </tr>
              ) : (
                [["CGST", invoice.cgstPercent || 9, invoice.cgstAmount], ["SGST", invoice.sgstPercent || 9, invoice.sgstAmount]].map(([label, pct, amt]) => (
                  <tr key={label} className="border-b border-black">
                    <td className="border-r border-black px-1 py-1" />
                    <td className="border-r border-black px-1 py-1 text-right font-semibold italic">{label}</td>
                    <td className="border-r border-black px-1 py-1" />
                    <td className="border-r border-black px-1 py-1" />
                    <td className="border-r border-black px-1 py-1 text-right">{pct}</td>
                    <td className="border-r border-black px-1 py-1 text-center">%</td>
                    <td className="px-1 py-1 text-right font-semibold">{num(amt)}</td>
                  </tr>
                ))
              )}

              <tr className="border-b border-black bg-slate-50">
                <td className="border-r border-black px-1 py-1.5" />
                <td className="border-r border-black px-1 py-1.5 text-right font-bold">Total</td>
                <td className="border-r border-black px-1 py-1.5" />
                <td className="border-r border-black px-1 py-1.5 text-right font-semibold">{items.reduce((s, i) => s + Number(i.quantity || 0), 0).toLocaleString("en-IN")} {items[0]?.unit || ""}</td>
                <td className="border-r border-black px-1 py-1.5" />
                <td className="border-r border-black px-1 py-1.5" />
                <td className="px-1 py-1.5 text-right text-[11px] font-bold">₹ {num(invoice.grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount in words */}
          <div className="border border-black border-t-0 px-2 py-1.5">
            <p className="text-[9px]"><span className="font-semibold">Amount Chargeable (in words)</span></p>
            <p className="mt-0.5 text-[10px] font-semibold">{invoice.amountInWords || "Amount in words not available"}</p>
            <p className="mt-0.5 text-right text-[8px] italic text-slate-500">E. & O.E</p>
          </div>

          {/* Tax summary */}
          <table className="w-full border-collapse border border-black border-t-0">
            <thead>
              <tr className="border-b border-black">
                <th className="border-r border-black px-1 py-1 text-left text-[8px] font-bold">HSN/SAC</th>
                <th className="border-r border-black px-1 py-1 text-right text-[8px] font-bold">Taxable<br />Value</th>
                {isIGST ? (
                  <>
                    <th colSpan={2} className="border-r border-black px-1 py-1 text-center text-[8px] font-bold">Integrated Tax</th>
                    <th className="px-1 py-1 text-right text-[8px] font-bold">Total<br />Tax Amount</th>
                  </>
                ) : (
                  <>
                    <th colSpan={2} className="border-r border-black px-1 py-1 text-center text-[8px] font-bold">Central Tax</th>
                    <th colSpan={2} className="border-r border-black px-1 py-1 text-center text-[8px] font-bold">State Tax</th>
                    <th className="px-1 py-1 text-right text-[8px] font-bold">Total<br />Tax Amount</th>
                  </>
                )}
              </tr>
              <tr className="border-b border-black">
                <th className="border-r border-black px-1 py-0.5" />
                <th className="border-r border-black px-1 py-0.5" />
                {isIGST ? (
                  <>
                    <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">Rate</th>
                    <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">Amount</th>
                    <th className="px-1 py-0.5" />
                  </>
                ) : (
                  <>
                    <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">Rate</th>
                    <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">Amount</th>
                    <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">Rate</th>
                    <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">Amount</th>
                    <th className="px-1 py-0.5" />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black px-1 py-1.5 text-[9px]">{primaryHsn}</td>
                <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">{num(invoice.taxableAmount)}</td>
                {isIGST ? (
                  <>
                    <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">{taxPercent}%</td>
                    <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">{num(invoice.igstAmount)}</td>
                    <td className="px-1 py-1.5 text-right text-[9px] font-semibold">{num(invoice.igstAmount)}</td>
                  </>
                ) : (
                  <>
                    <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">{invoice.cgstPercent || 9}%</td>
                    <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">{num(invoice.cgstAmount)}</td>
                    <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">{invoice.sgstPercent || 9}%</td>
                    <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">{num(invoice.sgstAmount)}</td>
                    <td className="px-1 py-1.5 text-right text-[9px] font-semibold">{num(taxAmount)}</td>
                  </>
                )}
              </tr>
              <tr>
                <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">Total</td>
                <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">{num(invoice.taxableAmount)}</td>
                {isIGST ? (
                  <>
                    <td className="border-r border-black px-1 py-1" />
                    <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">{num(invoice.igstAmount)}</td>
                    <td className="px-1 py-1 text-right text-[9px] font-bold">{num(invoice.igstAmount)}</td>
                  </>
                ) : (
                  <>
                    <td className="border-r border-black px-1 py-1" />
                    <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">{num(invoice.cgstAmount)}</td>
                    <td className="border-r border-black px-1 py-1" />
                    <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">{num(invoice.sgstAmount)}</td>
                    <td className="px-1 py-1 text-right text-[9px] font-bold">{num(taxAmount)}</td>
                  </>
                )}
              </tr>
            </tbody>
          </table>

          <div className="border border-black border-t-0 px-2 py-1.5">
            <p className="text-[9px]"><span className="font-semibold">Tax Amount (in words) :</span> <span className="font-semibold">{invoice.taxAmountInWords || "Tax amount in words not available"}</span></p>
          </div>

          {/* Declaration + signature */}
          <div className="grid grid-cols-2 border border-black border-t-0">
            <div className="min-h-[100px] border-r border-black p-2">
              <p className="text-[9px] font-bold underline">Declaration</p>
              <p className="mt-1 text-[9px] leading-3.5">{invoice.declaration || "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}</p>
            </div>
            <div className="relative min-h-[100px] p-2">
              <p className="text-right text-[9px] font-semibold">for {seller.name || "CORVEX STEEL WIRES"}</p>
              <div className="absolute bottom-2 right-2 text-right">
                <div className="mb-6 h-6" />
                <p className="text-[9px] font-semibold">{invoice.authorisedSignatory || "Authorised Signatory"}</p>
              </div>
            </div>
          </div>

          <div className="border border-black border-t-0 px-2 py-1.5 text-center"><p className="text-[8px] text-slate-600">This is a Computer Generated Invoice</p></div>
        </div>
      </div>
    </div>
  );
}

export default Orders;