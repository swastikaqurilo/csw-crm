import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import {
  Plus, Search, Eye, Pencil, Trash2, X, Download, FileText, CreditCard,
  Clock3, CheckCircle2, CalendarDays, ReceiptText, Wallet, CircleDollarSign,
  Inbox, Layers, Split, History, Smartphone, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  getPayments, getPaymentById, createPayment, updatePayment, deletePayment,
  getPaymentSummary, getOrders, getPaymentsByOrder, exportRevenueLedger,
} from "../api/api";
import DateFilter from "../components/DateFilter";

/* ================================================================
 *  CONSTANTS
 * ================================================================ */
const PAYMENT_MODES = ["Bank Transfer", "UPI", "Cheque", "Cash", "NEFT", "RTGS", "Other"];
const PAYMENT_STATUSES = ["Pending", "Completed", "Cancelled"];
const ORDERS_PER_PAGE = 10;
const TXN_ID_MODES = ["UPI", "NEFT", "RTGS", "Bank Transfer"];

const blankForm = (order = "") => ({
  order,
  amount: "",
  paymentDate: new Date().toISOString().split("T")[0],
  paymentMode: "Bank Transfer",
  transactionId: "",
  chequeNumber: "",
  bankName: "",
  status: "Completed",
  notes: "",
  attachmentUrl: "",
});

/* ================================================================
 *  FORMATTERS + HELPERS
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
const ts = (v) => { if (!v) return 0; const t = new Date(v).getTime(); return isNaN(t) ? 0 : t; };

const ref = (p) => p?.transactionId || p?.chequeNumber || "—";
const customerName = (p) =>
  p?.order?.contact?.company || p?.order?.contact?.name || p?.order?.customerName
  || p?.contact?.company || p?.contact?.name || "Unknown Customer";
const customerPhone = (p) => p?.order?.contact?.phone || p?.order?.customerPhone || p?.contact?.phone || "—";

const STATUS_CLS = {
  Completed: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  Paid: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  Pending: "border-amber-200/80 bg-amber-50 text-amber-700",
  Partial: "border-sky-200/80 bg-sky-50 text-sky-700",
  Cancelled: "border-slate-200 bg-slate-100 text-slate-600",
};
const STATUS_ICON = { Completed: CheckCircle2, Paid: CheckCircle2, Pending: Clock3, Partial: Clock3, Failed: X };
const MODE_ICON = { UPI: Smartphone, Cash: Wallet, Cheque: FileText };

/* ================================================================
 *  THEME
 * ================================================================ */
const INPUT = "h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-sm text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0a1e3f] focus:ring-[3px] focus:ring-[#0a1e3f]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const TEXTAREA = "min-h-[90px] w-full resize-y rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0a1e3f] focus:ring-[3px] focus:ring-[#0a1e3f]/10";
const FILTER_INPUT = "h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/50 pl-10 pr-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0a1e3f] focus:bg-white focus:ring-[3px] focus:ring-[#0a1e3f]/10";
const SELECT_INPUT = "h-10 rounded-xl border border-slate-200/80 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all hover:border-slate-300 focus:border-[#0a1e3f] focus:ring-[3px] focus:ring-[#0a1e3f]/10";
const LABEL = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500";
const BTN = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = `${BTN} bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] hover:from-[#0a1e3f] hover:to-[#06142b] hover:shadow-[0_4px_12px_rgba(15,23,42,0.18)]`;
const BTN_SECONDARY = `${BTN} border border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900`;
const ICON_BTN = "flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-700 hover:shadow-sm";
const TH = "px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500";

/* ================================================================
 *  PRIMITIVES
 * ================================================================ */
const Field = ({ label, required, hint, className = "", children }) => (
  <div className={className}>
    <label className={LABEL}>
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
    {children}
    {hint && <span className="mt-1.5 block text-[10px] text-slate-400">{hint}</span>}
  </div>
);

const StatusPill = ({ status, size = "md" }) => {
  const Icon = STATUS_ICON[status] || Clock3;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} ${STATUS_CLS[status] || STATUS_CLS.Cancelled}`}>
      <Icon size={size === "sm" ? 9 : 11} />
      {status}
    </span>
  );
};

const DetailItem = ({ label, value, emphasize }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
    <p className={`mt-1 text-sm ${emphasize ? "font-semibold tabular-nums text-slate-900" : "font-medium text-slate-800"}`}>{value}</p>
  </div>
);

function KpiCard({ label, value, hint, tone = "slate", icon: Icon, iconBg = "bg-slate-100", iconColor = "text-slate-700", loading }) {
  const hintColors = { emerald: "text-emerald-600", amber: "text-amber-600", slate: "text-slate-500" };
  const accents = { emerald: "from-emerald-400 to-emerald-500", amber: "from-amber-400 to-amber-500", slate: "from-slate-400 to-slate-500" };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.1)]">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accents[tone]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</span>
          <div className="mt-2 truncate text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">
            {loading ? "—" : value}
          </div>
          {hint && <div className={`mt-1.5 truncate text-[11px] font-medium ${hintColors[tone]}`}>{hint}</div>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-slate-200/60 ${iconBg} ${iconColor} transition-transform group-hover:scale-105`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function Modal({ onClose, busy, width = "max-w-[600px]", children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
    >
      <div
        className={`flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.4)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ eyebrow, title, subtitle, onClose, busy }) {
  return (
    <div className="relative flex shrink-0 items-start justify-between border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white px-6 py-5">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#0a1e3f] via-slate-500 to-transparent" />
      <div className="min-w-0">
        {eyebrow && <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{eyebrow}</div>}
        <h3 className="mt-1.5 text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>}
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40">
        <X size={18} />
      </button>
    </div>
  );
}

/* ================================================================
 *  KPI CONFIG
 * ================================================================ */
const KPI_CONFIG = [
  { key: "collected", label: "Total Collected", icon: Wallet, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", tone: "emerald" },
  { key: "partial", label: "Partial Payments", icon: Split, iconBg: "bg-amber-50", iconColor: "text-amber-600", tone: "amber" },
  { key: "today", label: "Received Today", icon: CalendarDays, iconBg: "bg-slate-100", iconColor: "text-slate-600", tone: "slate" },
  { key: "remaining", label: "Payments Remaining", icon: Inbox, iconBg: "bg-amber-50", iconColor: "text-amber-600", tone: "amber" },
];

/* ================================================================
 *  MAIN
 * ================================================================ */
function Payments() {
  /* ── data ── */
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ totalCollected: 0, totalCollectedCount: 0, totalToday: 0, totalTodayCount: 0, byStatus: [] });

  /* ── filters ── */
  const [filters, setFilters] = useState({ search: "", method: "All Methods", status: "All Records", from: "", to: "" });
  const patchFilters = (patch) => setFilters((f) => ({ ...f, ...patch }));

  /* ── ui ── */
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── list ui ── */
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(new Set());

  /* ── add/edit modal ── */
  const [modal, setModal] = useState(null); // { editing, form }

  /* ── view modal ── */
  const [view, setView] = useState(null); // { payment, order, payments, loading }

  /* ── fetchers ── */
  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getPayments({
        page: 1, limit: 1000,
        ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.method !== "All Methods" ? { paymentMode: filters.method } : {}),
        ...(filters.status !== "All Records" ? { status: filters.status } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      });
      setPayments(res?.data?.data || []);
      setPage(1);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load payments. Please check the backend connection.");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await getPaymentSummary();
      setSummary(res?.data?.data || { totalCollected: 0, totalCollectedCount: 0, totalToday: 0, totalTodayCount: 0, byStatus: [] });
    } catch (err) {
      console.error("Failed to fetch payment summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await getOrders({ page: 1, limit: 100 });
      setOrders(res?.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchSummary(); fetchOrders(); }, [fetchSummary, fetchOrders]);

  /* ── grouped payments (by order) ── */
  const groupedPayments = useMemo(() => {
    const groups = {};
    for (const p of payments) {
      const orderId = p.order?._id || p.order;
      if (!orderId) continue;
      if (!groups[orderId]) {
        groups[orderId] = {
          order: p.order || { _id: orderId, orderNumber: "Unknown Order" },
          payments: [],
          totalAmount: 0, completedAmount: 0, pendingAmount: 0,
          latestDate: p.paymentDate, latestTimestamp: ts(p.paymentDate),
          status: "Pending",
        };
      }
      const g = groups[orderId];
      g.payments.push(p);
      g.totalAmount += Number(p.amount || 0);
      if (p.status === "Completed") g.completedAmount += Number(p.amount || 0);
      const t = ts(p.paymentDate);
      if (t > g.latestTimestamp) { g.latestTimestamp = t; g.latestDate = p.paymentDate; }
    }
    for (const g of Object.values(groups)) {
      g.payments.sort((a, b) => ts(b.paymentDate) - ts(a.paymentDate) || (b._id || "").localeCompare(a._id || ""));
      const total = Number(g.order.grandTotal || 0);
      const paid = g.completedAmount;
      const remaining = Math.max(0, total - paid);
      g.pendingAmount = remaining;
      if (remaining <= 0.01 && total > 0) g.status = "Paid";
      else if (paid > 0.01 && remaining > 0.01) g.status = "Partial";
      else if (remaining > 0) g.status = "Pending";
      else g.status = g.order.paymentStatus || "Pending";
    }
    return Object.values(groups).sort((a, b) => b.latestTimestamp - a.latestTimestamp || (b.order.orderNumber || "").localeCompare(a.order.orderNumber || ""));
  }, [payments]);

  const totalOrders = groupedPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / ORDERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(
    () => groupedPayments.slice((safePage - 1) * ORDERS_PER_PAGE, safePage * ORDERS_PER_PAGE),
    [groupedPayments, safePage]
  );

  /* ── derived KPIs ── */
  const paymentsRemaining = useMemo(() => {
    let count = 0, total = 0;
    for (const o of orders) {
      const balance = Math.max(0, Number(o.grandTotal || 0) - Number(o.amountPaid || 0));
      if (balance > 0.01) { count += 1; total += balance; }
    }
    return { count, total };
  }, [orders]);

  const partialPayments = useMemo(() => {
    let count = 0, outstanding = 0;
    for (const o of orders) {
      const total = Number(o.grandTotal || 0);
      const paid = Number(o.amountPaid || 0);
      const balance = total - paid;
      if (paid > 0.01 && balance > 0.01) { count += 1; outstanding += balance; }
    }
    return { count, outstanding };
  }, [orders]);

  const selectedOrder = useMemo(() => orders.find((o) => o._id === modal?.form.order), [orders, modal?.form.order]);
  const orderBalance = useMemo(() => {
    if (!selectedOrder) return { total: 0, paid: 0, remaining: 0 };
    const total = Number(selectedOrder.grandTotal || 0);
    const paid = Number(selectedOrder.amountPaid || 0);
    return { total, paid, remaining: Math.max(0, total - paid) };
  }, [selectedOrder]);

  const splitTotals = useMemo(() => {
    if (!view?.order) return { value: 0, paid: 0, remaining: 0, percent: 0 };
    const value = Number(view.order.grandTotal || 0);
    const paid = Number(view.order.amountPaid || 0);
    const remaining = Math.max(0, value - paid);
    return { value, paid, remaining, percent: value > 0 ? Math.min((paid / value) * 100, 100) : 0 };
  }, [view?.order]);

  /* ── expansion ── */
  const toggleExpand = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const collapseAll = () => setExpanded(new Set());

  /* ── modal openers ── */
  const openAdd = () => setModal({ editing: null, form: blankForm() });
  const openAddForOrder = (orderId) => {
    if (!orderId) return;
    setView(null);
    setModal({ editing: null, form: blankForm(orderId) });
  };

  const openEdit = async (p) => {
    try {
      setSaving(true);
      const res = await getPaymentById(p._id);
      const full = res?.data?.data || p;
      setView(null);
      setModal({
        editing: full,
        form: {
          order: full.order?._id || "",
          amount: full.amount || "",
          paymentDate: toInputDate(full.paymentDate),
          paymentMode: full.paymentMode || "Bank Transfer",
          transactionId: full.transactionId || "",
          chequeNumber: full.chequeNumber || "",
          bankName: full.bankName || "",
          status: full.status || "Completed",
          notes: full.notes || "",
          attachmentUrl: full.attachmentUrl || "",
        },
      });
    } catch (err) {
      console.error("Failed to load payment:", err);
      window.alert(err?.response?.data?.message || "Failed to load payment details.");
    } finally {
      setSaving(false);
    }
  };

  const openView = async (p) => {
    setView({ payment: p, order: null, payments: [], loading: true });
    const orderId = p?.order?._id || p?.order;
    if (!orderId) return setView((v) => (v ? { ...v, loading: false } : v));
    try {
      const res = await getPaymentsByOrder(orderId);
      const payload = res?.data || {};
      setView((v) => (v && v.payment._id === p._id
        ? { ...v, order: payload.order || null, payments: Array.isArray(payload.data) ? payload.data : [], loading: false }
        : v));
    } catch (err) {
      console.error("Failed to load order splits:", err);
      setView((v) => (v ? { ...v, loading: false } : v));
    }
  };

  const closeModal = () => { if (!saving) setModal(null); };
  const setForm = (patch) => setModal((m) => (m ? { ...m, form: { ...m.form, ...patch } } : m));

  /* ── validation + submit ── */
  const validate = () => {
    const f = modal.form;
    if (!f.order) return "Please select an order.";
    const amt = Number(f.amount);
    if (!amt || amt <= 0) return "Payment amount must be greater than 0.";
    if (!modal.editing && f.status === "Completed" && amt > orderBalance.remaining + 0.01)
      return `Payment amount cannot exceed the remaining balance of ${currency(orderBalance.remaining)}.`;
    if (TXN_ID_MODES.includes(f.paymentMode) && !f.transactionId.trim())
      return `Transaction ID is required for ${f.paymentMode} payments.`;
    if (f.paymentMode === "Cheque") {
      if (!f.chequeNumber.trim()) return "Cheque number is required.";
      if (!f.bankName.trim()) return "Bank name is required for cheque payments.";
    }
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return window.alert(err);

    const f = modal.form;
    const shared = {
      paymentMode: f.paymentMode,
      transactionId: f.transactionId.trim() || undefined,
      chequeNumber: f.chequeNumber.trim() || undefined,
      bankName: f.bankName.trim() || undefined,
      notes: f.notes.trim() || undefined,
      status: f.status,
      paymentDate: f.paymentDate || undefined,
      attachmentUrl: f.attachmentUrl.trim() || undefined,
    };

    try {
      setSaving(true);
      if (modal.editing) {
        await updatePayment(modal.editing._id, shared);
        window.alert("Payment updated successfully.");
      } else {
        await createPayment({ order: f.order, amount: Number(f.amount), currency: "INR", ...shared });
        window.alert("Payment recorded successfully.");
      }
      setModal(null);
      await Promise.all([fetchPayments(), fetchSummary(), fetchOrders()]);
    } catch (err) {
      console.error("Payment save error:", err);
      window.alert(err?.response?.data?.message || "Failed to save payment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Are you sure you want to delete ${p.paymentNumber}?`)) return;
    try {
      setSaving(true);
      await deletePayment(p._id);
      window.alert("Payment deleted and order balance updated successfully.");
      await Promise.all([fetchPayments(), fetchSummary(), fetchOrders()]);
    } catch (err) {
      console.error("Payment delete error:", err);
      window.alert(err?.response?.data?.message || "Failed to delete payment.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      const res = await exportRevenueLedger({
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.method !== "All Methods" ? { paymentMode: filters.method } : {}),
        ...(filters.status !== "All Records" ? { status: filters.status } : {}),
        ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const match = (res.headers?.["content-disposition"] || "").match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `payments-ledger-${new Date().toISOString().split("T")[0]}.csv`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      window.alert(err?.response?.data?.message || "Failed to export ledger. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  /* ================================================================
   *  RENDER
   * ================================================================ */
  const hasActiveFilter = Boolean(filters.from || filters.to || filters.search);
  const firstShown = totalOrders === 0 ? 0 : (safePage - 1) * ORDERS_PER_PAGE + 1;
  const lastShown = Math.min(safePage * ORDERS_PER_PAGE, totalOrders);

  return (
    <div className="w-full space-y-6 pb-10">
      {/* HEADER */}
      <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-[26px] font-semibold tracking-tight text-[#0a1e3f] sm:text-[28px]">Payments & Settlements</h1>
          <p className="max-w-xl text-[13px] leading-relaxed text-slate-500">
            Track customer receivables, banking reconciliations, and real-time balances across commercial contracts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button className={BTN_SECONDARY} type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />Exporting…</>
            ) : (
              <><Download size={15} />Report Ledger</>
            )}
          </button>
          <button className={BTN_PRIMARY} type="button" onClick={openAdd}>
            <Plus size={16} />Record Payment
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3.5 text-sm text-red-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500 ring-4 ring-red-500/15" />
          <span className="leading-5">{error}</span>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CONFIG.map((k) => {
          const props =
            k.key === "collected" ? { value: currency(summary.totalCollected), hint: `${summary.totalCollectedCount} completed payments`, loading: summaryLoading }
            : k.key === "partial" ? { value: partialPayments.count, hint: `${currency(partialPayments.outstanding)} outstanding`, loading }
            : k.key === "today" ? { value: currency(summary.totalToday), hint: `${summary.totalTodayCount} payments today`, loading: summaryLoading }
            : { value: paymentsRemaining.count, hint: `${currency(paymentsRemaining.total)} outstanding`, loading };
          return <KpiCard key={k.key} {...k} {...props} />;
        })}
      </div>

      {/* FILTERS */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(e) => patchFilters({ search: e.target.value })}
            placeholder="Search by payment ID, transaction ID, cheque..."
            className={FILTER_INPUT}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <select className={SELECT_INPUT} value={filters.method} onChange={(e) => patchFilters({ method: e.target.value })}>
            <option>All Methods</option>
            {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select className={SELECT_INPUT} value={filters.status} onChange={(e) => patchFilters({ status: e.target.value })}>
            <option>All Records</option>
            {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <DateFilter
            from={filters.from}
            to={filters.to}
            accent="#0a1e3f"
            onChange={({ from, to }) => patchFilters({ from, to })}
          />
        </div>
      </div>

      {/* LEDGER */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Payment Ledger by Order</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Orders with payments — expand a row to see every payment (LIFO)</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={collapseAll} className="h-8 rounded-lg border border-slate-200/80 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
              Collapse all
            </button>
            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/60 bg-slate-50/80 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <ReceiptText size={13} className="text-slate-400" />
              {totalOrders} ORDERS · {payments.length} PAYMENTS
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className={TH}>Order</th>
                <th className={TH}>Customer</th>
                <th className={`${TH} text-right`}>Payments</th>
                <th className={`${TH} text-right`}>Completed</th>
                <th className={`${TH} text-right`}>Pending</th>
                <th className={TH}>Latest</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0a1e3f]" />
                    <span className="text-xs font-medium text-slate-500">Loading payments…</span>
                  </div>
                </td></tr>
              ) : paginatedOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-20 text-center">
                  <div className="flex flex-col items-center">
                    <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/60"><Inbox size={24} /></div>
                    <p className="text-sm font-semibold text-slate-700">No payments found</p>
                    <p className="mt-1.5 max-w-xs text-xs text-slate-400">
                      {hasActiveFilter ? "Try adjusting the date range, filters, or search." : "Record your first payment to get started."}
                    </p>
                  </div>
                </td></tr>
              ) : (
                paginatedOrders.map((group) => {
                  const orderId = group.order._id;
                  const isOpen = expanded.has(orderId);
                  const name = group.order.contact?.company || group.order.contact?.name || group.order.customerName || "Unknown Customer";
                  const phone = group.order.contact?.phone || group.order.customerPhone || "—";

                  return (
                    <Fragment key={orderId}>
                      {/* ORDER ROW */}
                      <tr
                        onClick={() => toggleExpand(orderId)}
                        className={`group cursor-pointer border-b border-slate-100/80 transition-colors last:border-b-0 ${isOpen ? "bg-slate-50/70" : "hover:bg-slate-50/50"}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <button className={`flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all ${isOpen ? "bg-slate-200/80 text-slate-700" : "group-hover:bg-slate-100 group-hover:text-slate-600"}`}>
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <div>
                              <p className="font-mono text-[13px] font-semibold tracking-tight text-slate-900">{group.order.orderNumber || "—"}</p>
                              <p className="mt-0.5 text-[10px] font-medium text-slate-400">{group.payments.length} payment{group.payments.length !== 1 ? "s" : ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[180px] truncate text-[13px] font-medium text-slate-700">{name}</p>
                              {phone !== "—" && <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-slate-400">{phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900">{currency(group.totalAmount)}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-emerald-600">{currency(group.completedAmount)}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-amber-600">
                          {group.pendingAmount > 0 ? currency(group.pendingAmount) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-500">{fmtDate(group.latestDate)}</td>
                        <td className="px-5 py-3.5"><StatusPill status={group.status} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              title="Add payment to this order"
                              onClick={(e) => { e.stopPropagation(); openAddForOrder(orderId); }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-800 hover:shadow-sm"
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* PAYMENT ROWS */}
                      {isOpen && group.payments.map((p) => {
                        const ModeIcon = MODE_ICON[p.paymentMode] || CreditCard;
                        return (
                          <tr key={p._id} className="border-b border-slate-100/60 bg-slate-50/40 transition-colors last:border-b-0 hover:bg-slate-100/50">
                            <td className="px-5 py-3 pl-16">
                              <div className="relative flex items-center gap-2">
                                <span className="absolute -left-6 top-1/2 h-px w-3.5 -translate-y-1/2 bg-slate-300/80" />
                                <span className="font-mono text-[11px] font-semibold text-slate-600">{p.paymentNumber}</span>
                                <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-[0_1px_1px_rgba(15,23,42,0.02)]">
                                  <ModeIcon size={10} /><span>{p.paymentMode}</span>
                                </div>
                                {ref(p) !== "—" && <span className="max-w-[100px] truncate font-mono text-[10px] text-slate-400">{ref(p)}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-3" />
                            <td className="px-5 py-3 text-right text-xs font-semibold tabular-nums text-slate-700">{currency(p.amount)}</td>
                            <td className="px-5 py-3 text-right text-xs font-semibold tabular-nums text-emerald-600">
                              {p.status === "Completed" ? currency(p.amount) : "—"}
                            </td>
                            <td className="px-5 py-3 text-right text-xs font-semibold tabular-nums text-amber-600">
                              {p.status === "Pending" ? currency(p.amount) : "—"}
                            </td>
                            <td className="px-5 py-3 text-[11px] text-slate-500">{fmtDate(p.paymentDate)}</td>
                            <td className="px-5 py-3"><StatusPill status={p.status} size="sm" /></td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-0.5">
                                <button className={ICON_BTN} type="button" title="View payment" onClick={(e) => { e.stopPropagation(); openView(p); }}><Eye size={13} /></button>
                                <button className={ICON_BTN} type="button" title="Edit payment" onClick={(e) => { e.stopPropagation(); openEdit(p); }}><Pencil size={13} /></button>
                                <button
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-sm"
                                  type="button" title="Delete payment" disabled={saving}
                                  onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-slate-500">
            Showing <span className="font-semibold text-slate-700">{firstShown}</span> to{" "}
            <span className="font-semibold text-slate-700">{lastShown}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalOrders}</span> orders
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}
              className="h-8 rounded-lg border border-slate-200/80 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n} type="button" onClick={() => setPage(n)}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition-all ${safePage === n ? "bg-[#0a1e3f] text-white shadow-[0_1px_2px_rgba(15,23,42,0.2)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                {n}
              </button>
            ))}
            <button
              type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}
              className="h-8 rounded-lg border border-slate-200/80 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* POLICY NOTE */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50/80 to-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"><ReceiptText size={15} /></div>
          <strong className="text-xs font-semibold text-slate-800">Payment Recording Policy</strong>
        </div>
        <span className="text-[11px] leading-relaxed text-slate-500">
          Completed payments are automatically applied to the linked order balance. Pending and Cancelled payments are recorded for audit purposes but do not affect the order's amount paid.
        </span>
      </div>

      {/* ============ ADD / EDIT MODAL ============ */}
      {modal && (
        <Modal onClose={closeModal} busy={saving}>
          <ModalHeader
            eyebrow="Treasury Entry"
            title={modal.editing ? "Edit Payment" : modal.form.order && orders.some((o) => o._id === modal.form.order) ? "Add Split Payment" : "Record New Payment"}
            subtitle={modal.editing ? "Update the payment information." : modal.form.order ? "Record an additional payment against this order." : "Record money received from a customer."}
            onClose={closeModal}
            busy={saving}
          />
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Order" required className="sm:col-span-2">
                  <select
                    className={INPUT} value={modal.form.order}
                    onChange={(e) => setForm({ order: e.target.value, amount: "" })}
                    disabled={Boolean(modal.editing)} required
                  >
                    <option value="">Select an order</option>
                    {orders.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.orderNumber} — {o.contact?.company || o.contact?.name || "Customer"} — {currency(o.grandTotal)}
                      </option>
                    ))}
                  </select>
                </Field>

                {selectedOrder && (
                  <div className="sm:col-span-2 rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="mb-3.5 flex items-center gap-2">
                      <CircleDollarSign size={15} className="text-slate-600" />
                      <span className="text-xs font-semibold text-slate-800">Order Payment Position</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <DetailItem label="Order Total" value={currency(orderBalance.total)} />
                      <DetailItem label="Already Paid" value={currency(orderBalance.paid)} />
                      <DetailItem label="Remaining Balance" value={currency(orderBalance.remaining)} emphasize />
                      <DetailItem label="Payment Status" value={selectedOrder.paymentStatus || "Pending"} />
                    </div>
                  </div>
                )}

                <Field
                  label="Amount"
                  required
                  hint={!modal.editing && selectedOrder && orderBalance.remaining > 0 ? `Maximum: ${currency(orderBalance.remaining)}` : undefined}
                >
                  <input
                    className={INPUT} type="number" value={modal.form.amount}
                    onChange={(e) => setForm({ amount: e.target.value })}
                    placeholder="₹ Amount" min="0.01" step="0.01" required
                    disabled={Boolean(modal.editing)}
                  />
                </Field>

                <Field label="Payment Date">
                  <input className={INPUT} type="date" value={modal.form.paymentDate} onChange={(e) => setForm({ paymentDate: e.target.value })} />
                </Field>

                <Field label="Payment Mode" required>
                  <select className={INPUT} value={modal.form.paymentMode} onChange={(e) => setForm({ paymentMode: e.target.value })} required>
                    {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>

                <Field label="Status" required>
                  <select className={INPUT} value={modal.form.status} onChange={(e) => setForm({ status: e.target.value })} required>
                    {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>

                {TXN_ID_MODES.includes(modal.form.paymentMode) && (
                  <Field label="Transaction ID" required>
                    <input className={INPUT} value={modal.form.transactionId} onChange={(e) => setForm({ transactionId: e.target.value })} placeholder="UTR / transaction ID" required />
                  </Field>
                )}

                {modal.form.paymentMode === "Cheque" && (
                  <>
                    <Field label="Cheque Number" required>
                      <input className={INPUT} value={modal.form.chequeNumber} onChange={(e) => setForm({ chequeNumber: e.target.value })} placeholder="Cheque number" required />
                    </Field>
                    <Field label="Bank Name" required>
                      <input className={INPUT} value={modal.form.bankName} onChange={(e) => setForm({ bankName: e.target.value })} placeholder="Issuing bank" required />
                    </Field>
                  </>
                )}

                <Field label="Notes" className="sm:col-span-2">
                  <textarea className={TEXTAREA} value={modal.form.notes} onChange={(e) => setForm({ notes: e.target.value })} placeholder="Optional payment notes" rows="3" />
                </Field>

                <Field label="Attachment URL" className="sm:col-span-2">
                  <input className={INPUT} value={modal.form.attachmentUrl} onChange={(e) => setForm({ attachmentUrl: e.target.value })} placeholder="Optional receipt / document URL" />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button type="button" className={BTN_SECONDARY} onClick={closeModal} disabled={saving}>Cancel</button>
              <button type="submit" className={BTN_PRIMARY} disabled={saving}>
                {saving ? "Saving..." : modal.editing ? "Save Changes" : "Record Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ VIEW MODAL ============ */}
      {view && (
        <Modal onClose={() => setView(null)} width="max-w-3xl">
          <div className="relative flex shrink-0 items-start justify-between border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white px-6 py-5">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#0a1e3f] via-slate-500 to-transparent" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Active Reconciliation</p>
              <div className="mt-1.5 flex items-center gap-3">
                <h2 className="font-mono text-lg font-semibold tracking-tight text-slate-900">{view.payment.paymentNumber}</h2>
                <StatusPill status={view.payment.status} />
              </div>
            </div>
            <button type="button" onClick={() => setView(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <X size={17} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <DetailItem label="Linked Order" value={view.payment.order?.orderNumber || "—"} />
                <DetailItem label="Customer" value={view.payment.order?.contact?.company || view.payment.order?.contact?.name || view.payment.order?.customerName || "—"} />
                <DetailItem label="Phone" value={view.payment.order?.contact?.phone || view.payment.order?.customerPhone || "—"} />
                <DetailItem label="Payment Amount" value={currency(view.payment.amount)} emphasize />
                <DetailItem label="Payment Date" value={fmtDate(view.payment.paymentDate)} />
                <DetailItem label="Payment Mode" value={view.payment.paymentMode || "—"} />
                <DetailItem label="Reference" value={ref(view.payment)} />
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="mb-3.5 flex items-center gap-2">
                  <Layers size={15} className="text-slate-600" />
                  <span className="text-xs font-semibold text-slate-800">Order Payment Position</span>
                </div>

                {view.loading ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    Loading…
                  </div>
                ) : view.order ? (
                  <>
                    <div className="space-y-3">
                      {[["Order Value", currency(splitTotals.value), "text-slate-900"],
                        ["Paid so far", currency(splitTotals.paid), "text-emerald-700"],
                        ["Remaining", currency(splitTotals.remaining), "text-amber-700"]].map(([label, value, tone]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">{label}</span>
                          <span className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-slate-400">
                        <span>Progress</span>
                        <span className="tabular-nums">{splitTotals.percent.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all" style={{ width: `${splitTotals.percent}%` }} />
                      </div>
                    </div>
                    {view.payment.order?.paymentStatus && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order Payment Status</span>
                        <p className="mt-1 text-xs font-semibold text-slate-700">{view.payment.order.paymentStatus}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Order payment position not available.</p>
                )}
              </div>
            </div>

            {/* SPLIT TIMELINE */}
            <div className="mt-6">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Split size={15} className="text-slate-600" />
                  <h3 className="text-xs font-semibold text-slate-800">Split Transactions</h3>
                  {view.payments.length > 0 && (
                    <span className="rounded-full border border-slate-200/80 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">{view.payments.length}</span>
                  )}
                </div>
                {view.payments.length > 1 && (
                  <span className="text-[10px] font-medium text-slate-400">This order was paid in {view.payments.length} parts</span>
                )}
              </div>

              {view.loading ? (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500">Loading split history…</div>
              ) : view.payments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                  <History size={20} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-xs font-medium text-slate-500">No other payments on this order</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {view.payments.map((s, i) => {
                    const isCurrent = s._id === view.payment._id;
                    return (
                      <div
                        key={s._id || i}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${isCurrent ? "border-[#0a1e3f] bg-slate-50 ring-1 ring-[#0a1e3f]/10" : "border-slate-200/80 bg-white hover:border-slate-300"}`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${isCurrent ? "bg-[#0a1e3f] text-white shadow-[0_1px_2px_rgba(15,23,42,0.2)]" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"}`}>
                          #{i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-slate-900">{currency(s.amount)}</span>
                            <StatusPill status={s.status} size="sm" />
                            {isCurrent && <span className="rounded-full bg-[#0a1e3f] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Current</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                            <span>{s.paymentMode || "—"}</span>
                            <span className="text-slate-300">·</span>
                            <span>{fmtDate(s.paymentDate)}</span>
                            {ref(s) !== "—" && <><span className="text-slate-300">·</span><span className="font-mono text-[10px]">{ref(s)}</span></>}
                          </div>
                          {s.notes && <p className="mt-1 truncate text-[11px] text-slate-400">{s.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {view.payment.notes && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-slate-900">Notes</p>
                <div className="mt-2 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
                  <p className="text-sm leading-6 text-slate-600">{view.payment.notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => window.print()} className={BTN_SECONDARY}>
              <FileText size={15} />Print Receipt
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => openEdit(view.payment)} className={BTN_SECONDARY}>
                <Pencil size={15} />Edit Payment
              </button>
              <button
                type="button"
                onClick={() => openAddForOrder(view.payment?.order?._id || view.payment?.order)}
                disabled={!view.payment?.order || (splitTotals.remaining <= 0 && view.payment?.order?.paymentStatus === "Paid")}
                className={BTN_PRIMARY}
              >
                <Plus size={15} />Add Split Payment
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Payments;