import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import {
  Warehouse, Package, AlertTriangle, Plus, ArrowDownToLine, ArrowUpFromLine,
  X, RefreshCw, Save, Factory, ShoppingCart, Truck, CheckCircle2, XCircle,
  Clock, Search, Layers, Boxes, CircleEqual, DatabasePlus, Wallet, Pencil,
  UserRound, CalendarDays, FileText,
} from "lucide-react";
import {
  getRawStock, createRawStock, updateRawStock, adjustRawStock,
  getRawPurchases, createRawPurchase, updateRawPurchase,
  receiveRawPurchase, cancelRawPurchase, getContacts, recordRawPurchasePayment,
} from "../api/api";
import DateFilter, { isWithinRange } from "../components/DateFilter";

const CATEGORIES = ["Steel", "Tape", "Reel"];
const UNIT_BY_CATEGORY = { Steel: "Kg", Tape: "Box", Reel: "Piece" };
const PER_PAGE = 10;
const PAY_METHODS = ["Bank Transfer", "UPI", "Cheque", "Cash", "NEFT", "RTGS", "Other"];
const PURCHASE_STATUSES = ["Pending", "Received", "Cancelled"];

const num = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const money = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v) || 0);
const parseDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const fmtDate = (v) => parseDate(v)?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) || "—";
const fmtShort = (v) => parseDate(v)?.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) || null;
const toInput = (v) => {
  const d = parseDate(v);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const today = () => toInput(new Date());
const errMsg = (err, fb) => err?.response?.data?.message || fb;

function stockStatus(item) {
  const qty = Number(item.quantity || 0);
  const free = Math.max(qty - Number(item.reservedQty || 0), 0);
  const crit = Number(item.criticalLevel || 0);
  const reorder = Number(item.reorderLevel || 0);
  if (qty === 0) return { label: "Out of Stock", type: "danger" };
  if (free === 0) return { label: "No Stock", type: "critical" };
  if (crit > 0 && free <= crit) return { label: "Critical", type: "critical" };
  if (reorder > 0 && free <= reorder) return { label: "Low", type: "warning" };
  return { label: "In Stock", type: "success" };
}
const STOCK_CLS = {
  danger: "bg-red-50 text-red-700 border-red-100",
  critical: "bg-rose-100 text-rose-800 border-rose-200",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
};
const PURCHASE_CLS = {
  Received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
};
const PAYMENT_CLS = {
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
  Overdue: "bg-rose-50 text-rose-700 border-rose-200",
  Pending: "bg-slate-100 text-slate-600 border-slate-200",
};
const PURCHASE_ICON = { Received: CheckCircle2, Pending: Clock, Cancelled: XCircle };

const isOverdue = (date, status) => {
  if (status !== "Pending" || !date) return false;
  const d = parseDate(date);
  if (!d) return false;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return d < end;
};
const balanceOf = (p) => {
  const total = Number(p.totalAmount || 0);
  const paid = Number(p.amountPaid || 0);
  return { total, paid, due: Math.max(0, total - paid) };
};

const INPUT = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const TEXTAREA = "w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10";
const BTN_PRIMARY = "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] px-4 text-xs font-semibold text-white shadow-sm transition hover:from-[#0a1e3f] hover:to-[#06142b] disabled:cursor-not-allowed disabled:opacity-60";
const BTN_SECONDARY = "inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60";
const BTN_DANGER = "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60";
const CHIP_BTN = "inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50";
const LABEL = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";
const TH = "px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500";

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className={LABEL}>
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

const Banner = ({ type, message, onClose }) => {
  const isError = type === "error";
  const Icon = isError ? AlertTriangle : CheckCircle2;
  const cls = isError
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const closeCls = isError ? "text-red-500 hover:bg-red-100" : "text-emerald-500 hover:bg-emerald-100";
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 text-xs font-semibold">{message}</p>
      <button type="button" onClick={onClose} className={`rounded-md p-1 ${closeCls}`}><X size={15} /></button>
    </div>
  );
};

const KpiCard = ({ Icon, top, icon, value, label }) => (
  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <div className={`absolute inset-x-0 top-0 h-[3px] ${top}`} />
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${icon}`}>
      <Icon size={18} />
    </div>
    <div className="mt-4">
      <p className="text-[26px] font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  </div>
);

const DetailItem = ({ label, children }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <div className="mt-1 text-sm text-slate-800">{children}</div>
  </div>
);

const Modal = ({ title, subtitle, onClose, busy, width = "max-w-lg", tone = "default", children, footer }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [busy, onClose]);
  const warn = tone === "warn";
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`my-auto max-h-[calc(100dvh-2rem)] w-full ${width} overflow-y-auto rounded-2xl border bg-white shadow-2xl ${warn ? "border-amber-200" : "border-slate-200"}`}
      >
        <header className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${warn ? "border-amber-100 bg-amber-50/60" : "border-slate-200"}`}>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
            <X size={17} />
          </button>
        </header>
        {children}
        {footer}
      </div>
    </div>
  );
};

const ModalFooter = ({ onCancel, formId, busy, saveLabel, hint, danger }) => (
  <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end">
    {hint && <p className="hidden text-[11px] text-slate-400 sm:mr-auto sm:block">{hint}</p>}
    <button type="button" onClick={onCancel} disabled={busy} className={`${BTN_SECONDARY} w-full sm:w-auto`}>Cancel</button>
    <button type="submit" form={formId} disabled={busy} className={`${danger ? BTN_DANGER : BTN_PRIMARY} w-full sm:w-auto`}>
      {busy ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
      {saveLabel}
    </button>
  </div>
);

const KPIS = [
  { key: "total",    label: "Materials Tracked",  Icon: Package,       top: "bg-gradient-to-r from-slate-400 to-slate-600",   icon: "from-slate-100 to-slate-200 text-slate-700" },
  { key: "lowStock", label: "Low Stock",          Icon: AlertTriangle, top: "bg-gradient-to-r from-amber-400 to-orange-500", icon: "from-amber-50 to-orange-100 text-amber-700" },
  { key: "pending",  label: "Pending Purchases",  Icon: Clock,         top: "bg-gradient-to-r from-sky-400 to-blue-600",     icon: "from-sky-50 to-blue-100 text-blue-700" },
  { key: "received", label: "Received Purchases", Icon: CheckCircle2,  top: "bg-gradient-to-r from-emerald-400 to-teal-600", icon: "from-emerald-50 to-teal-100 text-emerald-700" },
];

function RawMaterials() {
  const [stock, setStock] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({ status: "All", search: "", page: 1, from: "", to: "" });
  const patchFilters = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  const [material, setMaterial] = useState(null);
  const [purchase, setPurchase] = useState(null); 
  const [adjust, setAdjust] = useState(null);    
  const [reserve, setReserve] = useState(null);  
  const [viewing, setViewing] = useState(null);   
  const [payment, setPayment] = useState(null);   
  const [conflict, setConflict] = useState(null); 
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  /* ── flash auto-clear ── */
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => { if (error) setSuccess(""); }, [error]);
  useEffect(() => { if (success) setError(""); }, [success]);

  /* ── fetchers ── */
  const fetchStock = useCallback(async () => {
    try { setStockLoading(true); setStock((await getRawStock()).data?.data || []); }
    catch (err) { setError(errMsg(err, "Failed to load raw stock")); }
    finally { setStockLoading(false); }
  }, []);

  const fetchPurchases = useCallback(async () => {
    try { setPurchasesLoading(true); setPurchases((await getRawPurchases({ limit: 200 })).data?.data || []); }
    catch (err) { setError(errMsg(err, "Failed to load purchases")); }
    finally { setPurchasesLoading(false); }
  }, []);

  const fetchContacts = useCallback(async () => {
    try { setContacts((await getContacts({ limit: 200 })).data?.data || []); }
    catch (err) { console.error("Failed to load contacts", err); }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStock(), fetchPurchases()]);
  }, [fetchStock, fetchPurchases]);

  useEffect(() => { refreshAll(); fetchContacts(); }, [refreshAll, fetchContacts]);

  /* ── derived ── */
  const stockByCategory = useMemo(() => {
    const map = { Steel: [], Tape: [], Reel: [] };
    for (const item of stock) map[item.category]?.push(item);
    map.Reel.sort((a, b) => Number(a.sizeKg || 0) - Number(b.sizeKg || 0));
    return map;
  }, [stock]);

  const suppliers = useMemo(() => contacts.filter((c) => c.role === "supplier"), [contacts]);

  const filteredPurchases = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return purchases.filter((p) => {
      if (filters.status !== "All" && p.status !== filters.status) return false;
      if (!isWithinRange(p.orderedAt, filters.from, filters.to)) return false;
      if (!q) return true;
      return [p.material?.name, p.supplier?.name, p.supplier?.company, p.notes]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [purchases, filters]);

  const purchaseTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / PER_PAGE));
  const paginatedPurchases = useMemo(
    () => filteredPurchases.slice((filters.page - 1) * PER_PAGE, filters.page * PER_PAGE),
    [filteredPurchases, filters.page]
  );

  const incomingByMaterial = useMemo(() => {
    const map = {};
    for (const p of purchases) {
      if (p.status !== "Pending") continue;
      const id = p.material?._id || p.material;
      if (!id) continue;
      const slot = (map[id] ||= { qty: 0, earliestExpected: null });
      slot.qty += Number(p.quantity || 0);
      const d = parseDate(p.expectedAt);
      if (d && (!slot.earliestExpected || d < slot.earliestExpected)) slot.earliestExpected = d;
    }
    return map;
  }, [purchases]);

  const kpi = useMemo(() => {
    const lowStock = stock.filter((s) =>
      ["Low", "Critical", "Out of Stock", "Fully Allocated"].includes(stockStatus(s).label)
    ).length;
    return {
      total: stock.length,
      lowStock,
      pending: purchases.filter((p) => p.status === "Pending").length,
      received: purchases.filter((p) => p.status === "Received").length,
    };
  }, [stock, purchases]);

  /* ── shared save wrapper ── */
  const withSave = async (fn, okMsg, after) => {
    if (saving) return;
    setSaving(true); setError("");
    try {
      await fn();
      setSuccess(okMsg);
      after?.();
      await refreshAll();
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  /* ── STOCK ACTIONS ── */
  const openMaterial = () => setMaterial({
    form: { category: "Reel", name: "", sizeKg: "", reorderLevel: "", criticalLevel: "", notes: "" },
  });

  const submitMaterial = async (e) => {
    e.preventDefault();
    const f = material.form;
    const payload = {
      category: f.category,
      name: f.name.trim(),
      unit: UNIT_BY_CATEGORY[f.category],
      reorderLevel: Number(f.reorderLevel) || 0,
      criticalLevel: Number(f.criticalLevel) || 0,
      notes: f.notes.trim() || undefined,
    };
    if (f.category === "Reel") {
      payload.sizeKg = Number(f.sizeKg);
      if (!payload.name) payload.name = `Reel ${payload.sizeKg}kg`;
    }
    try { await withSave(() => createRawStock(payload), "Material added", () => setMaterial(null)); }
    catch (err) { setError(errMsg(err, "Failed to add material")); }
  };

  const openAdjust = (item, type = "in") =>
    setAdjust({ item, form: { type, quantity: "", reason: "", notes: "" } });

  const submitAdjust = async (e) => {
    e.preventDefault();
    const payload = {
      type: adjust.form.type,
      quantity: Number(adjust.form.quantity) || 0,
      reason: adjust.form.reason.trim() || undefined,
      notes: adjust.form.notes.trim() || undefined,
    };
    try {
      await withSave(() => adjustRawStock(adjust.item._id, payload), "Stock adjusted", () => setAdjust(null));
    } catch (err) {
      const body = err?.response?.data ?? err;
      if (body?.code === "RESERVED_CONFLICT" && body.data) {
        setConflict({ info: body.data, payload });
        return;
      }
      setError(errMsg(err, "Failed to adjust stock"));
    }
  };

  const openReserve = (item) => setReserve({ item, form: { reservedQty: item.reservedQty ?? 0 } });

  const submitReserve = async (e) => {
    e.preventDefault();
    try {
      await withSave(
        () => updateRawStock(reserve.item._id, { reservedQty: Number(reserve.form.reservedQty) || 0 }),
        "Reserved quantity updated",
        () => setReserve(null)
      );
    } catch (err) { setError(errMsg(err, "Failed to update reserved quantity")); }
  };

  const confirmReserved = async () => {
    if (!adjust || !conflict) return;
    setSaving(true); setError("");
    try {
      await adjustRawStock(adjust.item._id, { ...conflict.payload, allowReserved: true });
      setSuccess("Stock adjusted — reserved stock was used");
      setConflict(null); setAdjust(null);
      await refreshAll();
    } catch (err) { setError(errMsg(err, "Failed to adjust stock")); }
    finally { setSaving(false); }
  };

  /* ── PURCHASE ACTIONS ── */
  const blankPurchaseForm = () => ({
    material: "", supplier: "", supplierName: "", supplierPhone: "",
    quantity: "", unitPrice: "", orderedAt: today(), expectedAt: "", dueDate: "", notes: "",
  });

  const openPurchase = () => setPurchase({ editing: null, form: blankPurchaseForm() });

  const openEditPurchase = (p) => setPurchase({
    editing: p,
    form: {
      material: p.material?._id || p.material || "",
      supplier: p.supplier?._id || p.supplier || "",
      supplierName: p.supplierName || "",
      supplierPhone: p.supplierPhone || "",
      quantity: p.quantity ?? "",
      unitPrice: p.unitPrice ?? "",
      orderedAt: toInput(p.orderedAt),
      expectedAt: toInput(p.expectedAt),
      dueDate: toInput(p.dueDate),
      notes: p.notes || "",
    },
  });

  const submitPurchase = async (e) => {
    e.preventDefault();
    const f = purchase.form;
    const shared = {
      supplier: f.supplier || null,
      supplierName: f.supplierName.trim() || null,
      supplierPhone: f.supplierPhone.trim() || null,
      quantity: Number(f.quantity) || 0,
      unitPrice: Number(f.unitPrice) || 0,
      orderedAt: f.orderedAt || undefined,
      expectedAt: f.expectedAt || undefined,
      dueDate: f.dueDate || undefined,
      notes: f.notes.trim() || undefined,
    };
    const isEdit = !!purchase.editing;
    try {
      await withSave(
        () => isEdit
          ? updateRawPurchase(purchase.editing._id, shared)
          : createRawPurchase({ material: f.material, ...shared }),
        isEdit ? "Purchase updated" : "Purchase order created (pending receipt)",
        () => setPurchase(null)
      );
    } catch (err) { setError(errMsg(err, "Failed to save purchase")); }
  };

    const handleReceive = (p) => {
    setConfirm({
      title: "Mark as received?",
      message: `"${p.material?.name}" (${num(p.quantity)} ${p.unit}) will be added to stock.`,
      confirmLabel: "Yes, Receive",
      tone: "emerald",
      onConfirm: async () => {
        setConfirm(null);
        try {
          await withSave(() => receiveRawPurchase(p._id), "Purchase received — stock updated");
        } catch (err) {
          setError(errMsg(err, "Failed to receive purchase"));
        }
      },
    });
  };

    const handleCancelPurchase = (p) => {
    setConfirm({
      title: "Cancel purchase order?",
      message: `"${p.material?.name}" (${num(p.quantity)} ${p.unit}) — this cannot be undone.`,
      confirmLabel: "Yes, Cancel Purchase",
      tone: "danger",
      onConfirm: async () => {
        setConfirm(null);
        try {
          await withSave(() => cancelRawPurchase(p._id), "Purchase cancelled");
        } catch (err) {
          setError(errMsg(err, "Failed to cancel purchase"));
        }
      },
    });
  };

  /* ── PAYMENT ── */
  const openPayment = (p) => {
    const remaining = Number(p.totalAmount || 0) - Number(p.amountPaid || 0);
    setPayment({
      target: p, saving: false,
      form: {
        amount: remaining > 0 ? remaining.toFixed(2) : "",
        method: "Bank Transfer", paidAt: today(),
        transactionId: "", chequeNumber: "", bankName: "", notes: "",
      },
    });
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    const f = payment.form;
    const amt = Number(f.amount);
    const remaining = Number(payment.target.totalAmount || 0) - Number(payment.target.amountPaid || 0);
    if (!amt || amt <= 0) return setError("Payment amount must be greater than 0");
    if (amt > remaining + 0.01) return setError(`Payment exceeds remaining balance of ₹${remaining.toFixed(2)}`);

    setPayment((p) => ({ ...p, saving: true }));
    setError("");
    try {
      await recordRawPurchasePayment(payment.target._id, {
        amount: amt, method: f.method, paidAt: f.paidAt || undefined,
        transactionId: f.transactionId.trim() || undefined,
        chequeNumber: f.chequeNumber.trim() || undefined,
        bankName: f.bankName.trim() || undefined,
        notes: f.notes.trim() || undefined,
      });
      setSuccess("Payment recorded — payable updated");
      setPayment(null);
      await refreshAll();
    } catch (err) { setError(errMsg(err, "Failed to record payment")); }
    finally { setPayment((p) => (p ? { ...p, saving: false } : p)); }
  };

  /* ── form setter helpers ── */
  const setMat = (patch) => setMaterial((m) => ({ ...m, form: { ...m.form, ...patch } }));
  const setPur = (patch) => setPurchase((p) => ({ ...p, form: { ...p.form, ...patch } }));
  const setAdj = (patch) => setAdjust((a) => ({ ...a, form: { ...a.form, ...patch } }));
  const setRes = (patch) => setReserve((r) => ({ ...r, form: { ...r.form, ...patch } }));
  const setPay = (patch) => setPayment((p) => ({ ...p, form: { ...p.form, ...patch } }));

  /* ================================================================
   *  STOCK TABLE
   * ================================================================ */
  const renderStockRow = (item) => {
    const status = stockStatus(item);
    const incoming = incomingByMaterial[item._id];
    const lastMovement = item.movementLog?.[item.movementLog.length - 1]?.at;
    const reserved = Number(item.reservedQty || 0);
    const free = Math.max(Number(item.quantity || 0) - reserved, 0);

    return (
      <tr key={item._id} className="group transition-colors hover:bg-slate-50/70">
        <td className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-900">{item.name}</p>
          {item.category === "Reel" && item.sizeKg && (
            <p className="mt-0.5 text-[10px] text-slate-400">{item.sizeKg} kg reel</p>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <span className="text-sm font-semibold tabular-nums text-slate-900">{num(item.quantity)}</span>
          <span className="ml-1 text-[10px] text-slate-400">{item.unit}</span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          {reserved > 0 ? (
            <>
              <span className="text-sm font-semibold tabular-nums text-indigo-600">{num(reserved)}</span>
              <span className="ml-1 text-[10px] text-slate-400">{item.unit}</span>
            </>
          ) : <span className="text-xs text-slate-300">—</span>}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <span className={`text-sm font-semibold tabular-nums ${free === 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {num(free)}
          </span>
          <span className="ml-1 text-[10px] text-slate-400">{item.unit}</span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          {incoming && incoming.qty > 0 ? (
            <>
              <span className="text-xs font-semibold tabular-nums text-sky-700">+{num(incoming.qty)}</span>
              {incoming.earliestExpected && (
                <span className="ml-1 text-[10px] text-slate-500">· {fmtShort(incoming.earliestExpected)}</span>
              )}
            </>
          ) : <span className="text-xs text-slate-300">—</span>}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right text-xs tabular-nums text-slate-500">
          {num(item.reorderLevel)}
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STOCK_CLS[status.type]}`}>
            {status.label}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right text-[11px] text-slate-500">
          {fmtDate(item.lastReceivedAt || lastMovement)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-0.5 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
            <button type="button" title="Reserve" onClick={() => openReserve(item)} className="flex h-7 w-7 items-center justify-center rounded-md text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"><Layers size={14} /></button>
            <button type="button" title="Stock In" onClick={() => openAdjust(item, "in")} className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800"><ArrowDownToLine size={14} /></button>
            <button type="button" title="Stock Out" onClick={() => openAdjust(item, "out")} className="flex h-7 w-7 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-800"><ArrowUpFromLine size={14} /></button>
          </div>
        </td>
      </tr>
    );
  };

  const STOCK_ICON = { Steel: Factory, Tape: CircleEqual, Reel: DatabasePlus };
  const STOCK_TINT = {
    Steel: ["from-sky-50/60", "from-sky-100 to-sky-200 text-sky-700"],
    Tape: ["from-violet-50/60", "from-violet-100 to-violet-200 text-violet-700"],
    Reel: ["from-amber-50/60", "from-amber-100 to-amber-200 text-amber-700"],
  };

  const renderStockSection = (category, items) => {
    const Icon = STOCK_ICON[category];
    const [tint, iconBg] = STOCK_TINT[category];
    return (
      <div key={category} className="border-b border-slate-100 last:border-b-0">
        <div className={`flex items-center justify-between border-b border-slate-100 bg-gradient-to-r ${tint} to-transparent px-4 py-2.5`}>
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${iconBg}`}><Icon size={14} /></div>
            <div>
              <h3 className="text-xs font-bold tracking-tight text-slate-900">{category === "Reel" ? "Empty Reels" : category}</h3>
              <p className="text-[10px] text-slate-500">{items.length} {items.length === 1 ? "item" : "items"}</p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            Unit: {UNIT_BY_CATEGORY[category]}
          </span>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            No {category.toLowerCase()} stock records.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left">
              <colgroup>
                <col className="w-[230px]" /><col className="w-[100px]" /><col className="w-[100px]" />
                <col className="w-[110px]" /><col className="w-[120px]" /><col className="w-[90px]" />
                <col className="w-[110px]" /><col className="w-[100px]" /><col className="w-[120px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-left`}>{category === "Reel" ? "Size" : "Material"}</th>
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-right`}>On Hand</th>
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-right`}>Reserved</th>
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-right`}>Available</th>
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-right`}>Incoming</th>
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-right`}>Reorder</th>
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-center`}>Status</th>
                  <th className={`${TH} px-3 py-2.5 text-[10px] text-slate-400 text-right`}>Last Received</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">{items.map(renderStockRow)}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  /* ================================================================
   *  PURCHASE ROW
   * ================================================================ */
  const renderPurchaseRow = (p) => {
    const { total, paid, due } = balanceOf(p);
    const canPay = p.status === "Received" && due > 0.01;
    const StatusIcon = PURCHASE_ICON[p.status];
    const overdue = isOverdue(p.expectedAt, p.status);

    return (
      <tr
        key={p._id}
        role="button"
        tabIndex={0}
        onClick={() => setViewing(p)}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setViewing(p); } }}
        className="cursor-pointer transition-colors hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none"
      >
        <td className="px-4 py-3 text-xs text-slate-700">{fmtDate(p.orderedAt)}</td>
        <td className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-900">{p.material?.name || "—"}</p>
          {p.material?.category === "Reel" && p.material?.sizeKg && (
            <p className="mt-0.5 text-[10px] text-slate-400">{p.material.sizeKg} kg each</p>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs font-semibold tabular-nums text-slate-900">{num(p.quantity)}</span>
          <span className="ml-1 text-[10px] text-slate-400">{p.unit}</span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-600">{p.supplier?.company || p.supplier?.name || p.supplierName || "—"}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PURCHASE_CLS[p.status]}`}>
            {StatusIcon && <StatusIcon size={10} />}{p.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs">
          {p.status === "Received" && p.receivedAt && <span className="text-slate-500">{fmtDate(p.receivedAt)}</span>}
          {p.status === "Pending" && p.expectedAt && (
            <span className={overdue ? "font-medium text-red-600" : "text-sky-600"}>by {fmtDate(p.expectedAt)}</span>
          )}
          {((p.status === "Pending" && !p.expectedAt) || p.status === "Cancelled") && <span className="text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PAYMENT_CLS[p.paymentStatus] || PAYMENT_CLS.Pending}`}>
              {p.paymentStatus || "Pending"}
            </span>
            {total > 0 && <span className="text-[10px] tabular-nums text-slate-500">{money(paid)} / {money(total)}</span>}
            {due > 0.01 && <span className="text-[10px] font-semibold tabular-nums text-amber-600">Due {money(due)}</span>}
          </div>
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {canPay && (
              <button type="button" onClick={() => openPayment(p)} title="Record payment" className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-700">
                <Wallet size={11} /> Pay
              </button>
            )}
            {p.status === "Pending" && (
              <>
                <button type="button" onClick={() => openEditPurchase(p)} title="Edit" disabled={saving} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"><Pencil size={13} /></button>
                <button type="button" onClick={() => handleReceive(p)} disabled={saving} className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60">
                  <Truck size={11} /> Receive
                </button>
                <button type="button" onClick={() => handleCancelPurchase(p)} title="Cancel" disabled={saving} className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 disabled:opacity-60"><X size={13} /></button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const inputUnit = (materialId) => stock.find((s) => s._id === materialId)?.unit || "unit";
  const viewSupplier = (p) => ({
    name: p.supplier?.company || p.supplier?.name || p.supplierName || "—",
    sub: p.supplier?.company && p.supplier?.name ? p.supplier.name : null,
    phone: p.supplier?.phone || p.supplierPhone || null,
  });

  return (
    <div className="w-full min-w-0 space-y-4 pb-6 sm:space-y-5">
      {/* HEADER */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f2a52] to-[#0a1e3f] text-white shadow-md ring-1 ring-[#0a1e3f]/10"><Warehouse size={20} /></div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[#0a1e3f]">Raw Materials</h1>
            <p className="mt-0.5 text-[12.5px] text-slate-500">Steel, tape, and empty reels — stock levels & purchase orders</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto sm:items-center">
          <button type="button" onClick={openPurchase} className={`${BTN_PRIMARY} h-10 flex-1 sm:h-9 sm:flex-none`}>
            <ShoppingCart size={15} /> Add Purchase
          </button>
          <button type="button" onClick={refreshAll} title="Refresh" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            <RefreshCw size={15} className={stockLoading || purchasesLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {error && <Banner type="error" message={error} onClose={() => setError("")} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess("")} />}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {KPIS.map((k) => <KpiCard key={k.key} {...k} value={kpi[k.key]} />)}
      </div>

      {/* STOCK PANEL */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0a1e3f] text-white"><Boxes size={14} /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">Current Raw Stock</p>
              <p className="text-[10px] text-slate-400">Live stock levels by category</p>
            </div>
          </div>
          <button type="button" onClick={openMaterial} className={CHIP_BTN}><Plus size={12} /> Add Material</button>
        </header>
        {stockLoading ? (
          <div className="flex min-h-[180px] items-center justify-center"><RefreshCw size={24} className="animate-spin text-slate-400" /></div>
        ) : (
          CATEGORIES.map((c) => renderStockSection(c, stockByCategory[c]))
        )}
      </section>

      {/* PURCHASE PANEL */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-3 py-3.5 sm:px-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a1e3f] text-white"><ShoppingCart size={14} /></div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">Purchase Orders</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">Mark as received to increase stock</p>
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto] xl:w-auto xl:flex xl:items-center">
              <div className="relative min-w-0 sm:min-w-[220px]">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search material or supplier..."
                  value={filters.search}
                  onChange={(e) => patchFilters({ search: e.target.value })}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-[#0a1e3f] focus:bg-white focus:ring-2 focus:ring-[#0a1e3f]/10"
                />
              </div>
              <select
                value={filters.status}
                onChange={(e) => patchFilters({ status: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10 sm:w-auto"
              >
                <option value="All">All Status</option>
                {PURCHASE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <div className="min-w-0">
                <DateFilter
                  from={filters.from}
                  to={filters.to}
                  onChange={({ from, to }) => patchFilters({ from, to })}
                  accent="#0a1e3f"
                />
              </div>
            </div>
          </div>
        </div>

        {purchasesLoading ? (
          <div className="flex min-h-[180px] items-center justify-center"><RefreshCw size={24} className="animate-spin text-slate-400" /></div>
        ) : filteredPurchases.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ShoppingCart size={18} /></div>
            <h4 className="mt-3 text-sm font-semibold text-slate-800">No purchase orders</h4>
            <p className="mt-1 text-xs text-slate-500">
              {filters.search || filters.status !== "All"
                ? "No purchases match the current filters."
                : "Add your first purchase order to get started."}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  {["Date", "Material", "Quantity", "Supplier", "Status", "Received / Expected", "Payment", "Actions"].map((h, i) => (
                    <th key={h} className={`${TH} whitespace-nowrap ${i === 2 || i === 6 || i === 7 ? "text-right" : ""} ${i === 7 ? "w-[180px]" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">{paginatedPurchases.map(renderPurchaseRow)}</tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100">
          <Pagination
            page={filters.page}
            totalPages={purchaseTotalPages}
            onPage={(p) => patchFilters({ page: p })}
            totalRecords={filteredPurchases.length}
            perPage={PER_PAGE}
          />
        </div>
      </section>

      {/* ============ ADD MATERIAL MODAL ============ */}
      {material && (
        <Modal
          title="Add Material" subtitle="Create a new raw material or reel size"
          onClose={() => setMaterial(null)} busy={saving}
          footer={<ModalFooter formId="mat-form" onCancel={() => setMaterial(null)} busy={saving} saveLabel="Add Material" />}
        >
          <form id="mat-form" onSubmit={submitMaterial}>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <Field label="Category">
                <select
                  value={material.form.category}
                  onChange={(e) => setMat({ category: e.target.value, name: "", sizeKg: "" })}
                  className={INPUT}
                >
                  <option value="Reel">Reel (empty spool)</option>
                  <option value="Steel">Steel</option>
                  <option value="Tape">Tape</option>
                </select>
              </Field>
              {material.form.category === "Reel" && (
                <Field label="Size (kg)" required>
                  <input type="number" min="0.1" step="0.1" required placeholder="e.g. 8"
                    value={material.form.sizeKg} onChange={(e) => setMat({ sizeKg: e.target.value })} className={INPUT} />
                </Field>
              )}
              <Field
                label="Name"
                required={material.form.category !== "Reel"}
                hint={material.form.category === "Reel" ? `Optional. If left empty, defaults to "Reel ${material.form.sizeKg || "X"}kg".` : undefined}
              >
                <input type="text" value={material.form.name}
                  onChange={(e) => setMat({ name: e.target.value })}
                  placeholder={material.form.category === "Reel" ? `e.g. Heavy Duty Reel ${material.form.sizeKg || ""}kg` : material.form.category}
                  required={material.form.category !== "Reel"} className={INPUT} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Reorder Level">
                  <input type="number" min="0" step="0.001" placeholder="0" value={material.form.reorderLevel}
                    onChange={(e) => setMat({ reorderLevel: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Critical Level">
                  <input type="number" min="0" step="0.001" placeholder="0" value={material.form.criticalLevel}
                    onChange={(e) => setMat({ criticalLevel: e.target.value })} className={INPUT} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea rows={2} placeholder="Optional" value={material.form.notes}
                  onChange={(e) => setMat({ notes: e.target.value })} className={TEXTAREA} />
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ ADD / EDIT PURCHASE MODAL ============ */}
      {purchase && (
        <Modal
          title={purchase.editing ? "Edit Purchase Order" : "Add Purchase Order"}
          subtitle={purchase.editing ? "Update quantity, price, expected date or supplier" : "Stock increases when marked as received"}
          onClose={() => setPurchase(null)} busy={saving} width="max-w-2xl"
          footer={<ModalFooter
            formId="po-form"
            onCancel={() => setPurchase(null)}
            busy={saving}
            saveLabel={purchase.editing ? "Save Changes" : "Create Purchase"}
            hint={purchase.editing ? "Changes apply immediately on save." : "Quantity in the material's unit. Stock updates when received."}
          />}
        >
          <form id="po-form" onSubmit={submitPurchase}>
            <div className="max-h-[calc(100dvh-12rem)] space-y-5 overflow-y-auto px-5 py-5">
              <section className="space-y-3">
                <SectionLabel Icon={Package} label="Order Details" />
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <Field label="Material" required hint={purchase.editing ? "Material is locked after creation." : undefined}>
                    <select value={purchase.form.material} required disabled={!!purchase.editing}
                      onChange={(e) => setPur({ material: e.target.value })} className={INPUT}>
                      <option value="">Select material</option>
                      {stock.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.unit}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Quantity" required>
                      <div className="relative">
                        <input type="number" min="0.001" step="0.001" required placeholder="0" value={purchase.form.quantity}
                          onChange={(e) => setPur({ quantity: e.target.value })} className={`${INPUT} pr-16`} />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {inputUnit(purchase.form.material)}
                        </span>
                      </div>
                    </Field>
                    <Field label="Unit Price">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={purchase.form.unitPrice}
                          onChange={(e) => setPur({ unitPrice: e.target.value })} className={`${INPUT} pl-7`} />
                      </div>
                    </Field>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel Icon={UserRound} label="Supplier" note="Optional" />
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <Field
                    label="Pick from suppliers"
                    hint={suppliers.length === 0 ? "No suppliers found. Add contacts with role 'supplier' first." : "Only contacts marked as supplier are shown."}
                  >
                    <select value={purchase.form.supplier}
                      onChange={(e) => {
                        const c = suppliers.find((x) => x._id === e.target.value);
                        setPur({
                          supplier: e.target.value,
                          supplierName: c ? (c.company ? `${c.company} — ${c.name}` : c.name) : purchase.form.supplierName,
                          supplierPhone: c?.phone || purchase.form.supplierPhone,
                        });
                      }}
                      className={INPUT}
                    >
                      <option value="">None / Type manually below</option>
                      {suppliers.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.company ? `${c.company} — ${c.name}` : c.name}{c.phone ? ` (${c.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Supplier Name">
                      <input type="text" placeholder="e.g. ABC Traders" maxLength={100} value={purchase.form.supplierName}
                        onChange={(e) => setPur({ supplierName: e.target.value })} className={INPUT} />
                    </Field>
                    <Field label="Supplier Phone">
                      <input type="tel" placeholder="e.g. +91 98765 43210" maxLength={20} value={purchase.form.supplierPhone}
                        onChange={(e) => setPur({ supplierPhone: e.target.value })} className={INPUT} />
                    </Field>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel Icon={CalendarDays} label="Schedule" />
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-3">
                  <Field label="Ordered On">
                    <input type="date" value={purchase.form.orderedAt}
                      onChange={(e) => setPur({ orderedAt: e.target.value })} className={INPUT} />
                  </Field>
                  <Field label="Expected On">
                    <input type="date" value={purchase.form.expectedAt}
                      onChange={(e) => setPur({ expectedAt: e.target.value })} className={INPUT} />
                  </Field>
                  <Field label="Payment Due On">
                    <input type="date" value={purchase.form.dueDate || ""}
                      onChange={(e) => setPur({ dueDate: e.target.value })} className={INPUT} />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <SectionLabel Icon={FileText} label="Notes" />
                <textarea rows={3} value={purchase.form.notes}
                  onChange={(e) => setPur({ notes: e.target.value })}
                  placeholder="PO number, remarks, or any special instructions…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10" />
              </section>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ ADJUST STOCK MODAL ============ */}
      {adjust && (
        <Modal
          title="Adjust Stock" subtitle={adjust.item.name}
          onClose={() => setAdjust(null)} busy={saving} width="max-w-md"
          footer={<ModalFooter formId="adj-form" onCancel={() => setAdjust(null)} busy={saving} saveLabel="Save" />}
        >
          <form id="adj-form" onSubmit={submitAdjust}>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <StockStatStrip item={adjust.item} />
              <Field label="Type">
                <select value={adjust.form.type} onChange={(e) => setAdj({ type: e.target.value })} className={INPUT}>
                  <option value="in">Stock In (add)</option>
                  <option value="out">Stock Out (remove)</option>
                  <option value="adjustment">Set Level (override)</option>
                </select>
              </Field>
              <Field label={adjust.form.type === "adjustment" ? "New Stock Level" : "Quantity"} required>
                <div className="relative">
                  <input type="number" min="0" step="0.001" required placeholder="0"
                    max={adjust.form.type === "out" ? adjust.item.quantity : undefined}
                    value={adjust.form.quantity} onChange={(e) => setAdj({ quantity: e.target.value })}
                    className={`${INPUT} pr-14`} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                    {adjust.item.unit}
                  </span>
                </div>
              </Field>
              <Field label="Reason">
                <input type="text" placeholder="e.g. Damaged, Found extra, Cycle count"
                  value={adjust.form.reason} onChange={(e) => setAdj({ reason: e.target.value })} className={INPUT} />
              </Field>
              <Field label="Notes">
                <textarea rows={2} placeholder="Optional" value={adjust.form.notes}
                  onChange={(e) => setAdj({ notes: e.target.value })} className={TEXTAREA} />
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ RESERVE MODAL ============ */}
      {reserve && (
        <Modal
          title="Reserve Stock" subtitle={`${reserve.item.name} — commit stock to production`}
          onClose={() => setReserve(null)} busy={saving} width="max-w-md"
          footer={<ModalFooter formId="res-form" onCancel={() => setReserve(null)} busy={saving} saveLabel="Save" />}
        >
          <form id="res-form" onSubmit={submitReserve}>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <StockStatStrip item={reserve.item} size="lg" />
              <Field label="Reserved Quantity" required hint="Cannot exceed available stock. Set to 0 to release all.">
                <div className="relative">
                  <input type="number" min="0" step="0.001" required max={reserve.item.quantity}
                    value={reserve.form.reservedQty} onChange={(e) => setRes({ reservedQty: e.target.value })}
                    className={`${INPUT} pr-14`} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                    {reserve.item.unit}
                  </span>
                </div>
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ RESERVED CONFLICT MODAL ============ */}
      {conflict && (
        <Modal
          title="Reserved stock will be used"
          subtitle="This issue exceeds the available (free) stock."
          onClose={() => setConflict(null)} busy={saving} width="max-w-md" tone="warn"
          footer={
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConflict(null)} disabled={saving} className={`${BTN_SECONDARY} w-full sm:w-auto`}>No, Cancel</button>
              <button type="button" onClick={confirmReserved} disabled={saving}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60 sm:w-auto">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Yes, Use Reserved
              </button>
            </div>
          }
        >
          <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
              <MiniStat label="Available" value={num(conflict.info.freeQty)} unit={conflict.info.unit} tone="text-emerald-700" />
              <MiniStat label="Reserved" value={num(conflict.info.reservedQty)} unit={conflict.info.unit} tone="text-indigo-600" />
              <MiniStat label="Requested" value={num(conflict.info.requested)} unit={conflict.info.unit} tone="text-amber-700" />
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-900">
                <span className="font-semibold">{num(conflict.info.usedFromReserved)} {conflict.info.unit}</span>{" "}
                will be taken from stock reserved for other orders. This will reduce the reserved quantity.
              </p>
            </div>
            <p className="text-xs text-slate-600">Do you grant permission to proceed?</p>
          </div>
        </Modal>
      )}

      {/* ============ VIEW PURCHASE MODAL ============ */}
      {viewing && (
        <Modal
          title="Purchase Order Details"
          subtitle={`Ordered on ${fmtDate(viewing.orderedAt)}`}
          onClose={() => setViewing(null)} width="max-w-xl"
          footer={
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setViewing(null)} className={`${BTN_SECONDARY} w-full sm:w-auto`}>Close</button>
              {viewing.status === "Pending" && (
                <>
                  <button type="button" onClick={() => { const p = viewing; setViewing(null); openEditPurchase(p); }}
                    className={`${BTN_SECONDARY} w-full gap-2 sm:w-auto`}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" disabled={saving} onClick={() => { const p = viewing; setViewing(null); handleReceive(p); }}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto">
                    <Truck size={13} /> Receive
                  </button>
                </>
              )}
            </div>
          }
        >
          <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PURCHASE_CLS[viewing.status]}`}>
                {(() => { const I = PURCHASE_ICON[viewing.status]; return I ? <I size={10} /> : null; })()}
                {viewing.status}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label="Material">
                <p className="font-semibold">{viewing.material?.name || "—"}</p>
                {viewing.material?.category === "Reel" && viewing.material?.sizeKg && (
                  <p className="text-[11px] text-slate-400">{viewing.material.sizeKg} kg each</p>
                )}
              </DetailItem>
              {(() => {
                const s = viewSupplier(viewing);
                return (
                  <DetailItem label="Supplier">
                    <p className="font-semibold">{s.name}</p>
                    {s.sub && <p className="text-[11px] text-slate-400">{s.sub}</p>}
                    {s.phone && <p className="text-[11px] text-slate-400">{s.phone}</p>}
                  </DetailItem>
                );
              })()}
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
              <DetailItem label="Quantity">
                <span className="font-semibold tabular-nums">{num(viewing.quantity)}</span>{" "}
                <span className="text-[11px] text-slate-500">{viewing.unit}</span>
              </DetailItem>
              <DetailItem label="Unit Price">
                <span className="font-semibold tabular-nums">{money(viewing.unitPrice)}</span>
              </DetailItem>
              <DetailItem label="Total">
                <span className="font-semibold tabular-nums text-emerald-700">
                  {money(Number(viewing.quantity || 0) * Number(viewing.unitPrice || 0))}
                </span>
              </DetailItem>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DetailItem label="Ordered On">{fmtDate(viewing.orderedAt)}</DetailItem>
              <DetailItem label="Expected On">
                <span className={isOverdue(viewing.expectedAt, viewing.status) ? "font-medium text-red-600" : ""}>
                  {fmtDate(viewing.expectedAt)}
                </span>
                {isOverdue(viewing.expectedAt, viewing.status) && <p className="text-[11px] text-red-500">Overdue</p>}
              </DetailItem>
              <DetailItem label="Received On">
                {viewing.status === "Received" ? fmtDate(viewing.receivedAt) : "—"}
              </DetailItem>
            </div>
            <DetailItem label="Notes">
              {viewing.notes ? (
                <p className="whitespace-pre-wrap text-sm text-slate-700">{viewing.notes}</p>
              ) : (
                <span className="text-slate-400">No notes</span>
              )}
            </DetailItem>
          </div>
        </Modal>
      )}

      {/* ============ RECORD PAYMENT MODAL ============ */}
      {payment && (
        <Modal
          title="Record Payment"
          subtitle={`${payment.target.purchaseNumber || "Purchase"} — ${payment.target.material?.name || ""}`}
          onClose={() => setPayment(null)} busy={payment.saving} width="max-w-md"
          footer={<ModalFooter formId="pay-form" onCancel={() => setPayment(null)} busy={payment.saving} saveLabel="Save Payment" />}
        >
          <form id="pay-form" onSubmit={submitPayment}>
            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <MiniStat label="Total" value={money(payment.target.totalAmount)} tone="text-slate-900" />
                <MiniStat label="Paid" value={money(payment.target.amountPaid)} tone="text-emerald-700" />
                <MiniStat label="Due" value={money(balanceOf(payment.target).due)} tone="text-amber-700" />
              </div>
              <Field label="Amount" required>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                  <input type="number" min="0.01" step="0.01" required value={payment.form.amount}
                    onChange={(e) => setPay({ amount: e.target.value })} className={`${INPUT} pl-7`} />
                </div>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Method">
                  <select value={payment.form.method} onChange={(e) => setPay({ method: e.target.value })} className={INPUT}>
                    {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Date">
                  <input type="date" value={payment.form.paidAt} onChange={(e) => setPay({ paidAt: e.target.value })} className={INPUT} />
                </Field>
              </div>
              {payment.form.method === "Cheque" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Cheque #">
                    <input type="text" value={payment.form.chequeNumber} onChange={(e) => setPay({ chequeNumber: e.target.value })} className={INPUT} />
                  </Field>
                  <Field label="Bank">
                    <input type="text" value={payment.form.bankName} onChange={(e) => setPay({ bankName: e.target.value })} className={INPUT} />
                  </Field>
                </div>
              ) : (
                <Field label="Transaction / Reference ID">
                  <input type="text" placeholder="UTR / reference" value={payment.form.transactionId}
                    onChange={(e) => setPay({ transactionId: e.target.value })} className={INPUT} />
                </Field>
              )}
              <Field label="Notes">
                <textarea rows={2} value={payment.form.notes} onChange={(e) => setPay({ notes: e.target.value })} className={TEXTAREA} />
              </Field>
            </div>
          </form>
        </Modal>
      )}

            {/* ============ CONFIRM MODAL ============ */}
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => setConfirm(null)}
          busy={saving}
          width="max-w-md"
          tone={confirm.tone === "danger" ? "warn" : "default"}
          footer={
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={saving}
                className={`${BTN_SECONDARY} w-full sm:w-auto`}
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={confirm.onConfirm}
                disabled={saving}
                className={`${confirm.tone === "danger" ? BTN_DANGER : BTN_PRIMARY} w-full sm:w-auto`}
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {confirm.confirmLabel || "Confirm"}
              </button>
            </div>
          }
        >
          <div className="px-5 py-5">
            <p className="text-sm text-slate-700">{confirm.message}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SectionLabel({ Icon, label, note }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Icon size={13} /></div>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700">{label}</p>
      {note && <span className="ml-auto text-[10px] font-medium text-slate-400">{note}</span>}
    </div>
  );
}

function MiniStat({ label, value, unit, tone = "text-slate-900" }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>
        {value}{unit && <span className="ml-1 text-[10px] font-medium text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}

function StockStatStrip({ item, size = "sm" }) {
  const free = Math.max(Number(item.quantity || 0) - Number(item.reservedQty || 0), 0);
  const cls = size === "lg" ? "text-base" : "text-sm";
  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">On Hand</p>
        <p className={`mt-1 ${cls} font-semibold tabular-nums text-slate-900`}>
          {num(item.quantity)} <span className="text-[10px] font-medium text-slate-500">{item.unit}</span>
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reserved</p>
        <p className={`mt-1 ${cls} font-semibold tabular-nums text-indigo-600`}>
          {num(item.reservedQty || 0)} <span className="text-[10px] font-medium text-slate-500">{item.unit}</span>
        </p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Available</p>
        <p className={`mt-1 ${cls} font-semibold tabular-nums text-emerald-700`}>
          {num(free)} <span className="text-[10px] font-medium text-slate-500">{item.unit}</span>
        </p>
      </div>
    </div>
  );
}

export default RawMaterials;