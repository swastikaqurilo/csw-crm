import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import DateFilter from "../components/DateFilter";
import {
  Package, Plus, X, RefreshCw, Save, AlertTriangle, CheckCircle2,
  CalendarRange, Pencil, Trash2, Layers, Boxes, PackageX,
} from "lucide-react";
import {
  getProductProductions, createProductProduction, updateProductProduction,
  deleteProductProduction, getProductStock, updateProductStockReserved,
  adjustProductStock, recordProductScrap, getWorkers, getAttendance,
} from "../api/api";

const SIZES = ["2kg", "5kg", "8kg", "10kg"];
const PER_PAGE = 15;
const REEL_COMPOSITION = {
  "2kg":  { spoolKg: 0.2, steelKg: 1.8 },
  "5kg":  { spoolKg: 0.6, steelKg: 4.4 },
  "8kg":  { spoolKg: 0.7, steelKg: 7.3 },
  "10kg": { spoolKg: 0.7, steelKg: 9.3 },
};
const SIZE_META = SIZES.map((size) => ({ size, key: `qty${size}`, weight: parseFloat(size) }));
const SIZE_META_RATE = SIZES.map((size) => ({ size, rateKey: `rate${size}`, weight: parseFloat(size) }));

const pad = (n) => String(n).padStart(2, "0");
const toLocalDateString = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const parseDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const fmtDate = (v) => parseDate(v)?.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) || "—";
const fmtDateShort = (v) => parseDate(v)?.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) || "—";
const fmtDateLong = (v) => parseDate(v)?.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) || "—";
const fmtNum = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtMoney = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errMsg = (err, fb) => err?.response?.data?.message || err?.message || fb;

function getEntryMetrics(entry) {
  let totalReels = 0, totalWtNoReel = 0, totalWtWithReel = 0;
  const rows = SIZE_META.map(({ key, size, weight }) => {
    const qty = Number(entry?.[key] || 0);
    const comp = REEL_COMPOSITION[size];
    const steel = qty * comp.steelKg;
    const spool = qty * comp.spoolKg;
    const withReel = qty * weight;
    totalReels += qty;
    totalWtNoReel += steel;
    totalWtWithReel += withReel;
    return { size, qty, steel, spool, withReel };
  });
  const scrap = Number(entry?.scrapKg || 0);
  const tape = Number(entry?.tapeUsedBox || 0);
  return { rows, totalReels, totalWtNoReel, totalWtWithReel, scrap, tape, steelConsumed: totalWtNoReel + scrap };
}

function getWorkerEarnings(workerEntry) {
  const production = workerEntry?.production || {};
  const rates = workerEntry?.worker?.variablePay || {};
  const rows = SIZE_META_RATE.map(({ size, rateKey, weight }) => {
    const reels = Number(production[size] || 0);
    const rate = Number(rates[rateKey] || 0);
    return { size, reels, rate, weight, kg: reels * weight, earned: reels * weight * rate };
  }).filter((r) => r.reels > 0);
  return {
    rows,
    totalReels: rows.reduce((s, r) => s + r.reels, 0),
    totalGrossKg: rows.reduce((s, r) => s + r.kg, 0),
    totalEarnings: rows.reduce((s, r) => s + r.earned, 0),
  };
}

function stockStatus(item) {
  const qty = Number(item.quantity || 0);
  const free = Math.max(qty - Number(item.reservedQty || 0), 0);
  const reorder = Number(item.reorderLevel || 0);
  const critical = Number(item.criticalLevel || 0);
  if (qty === 0) return { label: "Out of Stock", type: "danger" };
  if (free === 0) return { label: "No Stock", type: "critical" };
  if (critical > 0 && free < critical) return { label: "Critical", type: "danger" };
  if (reorder > 0 && free < reorder) return { label: "Reorder", type: "warning" };
  return { label: "In Stock", type: "success" };
}
const STATUS_CLS = {
  danger: "bg-red-50 text-red-700 border-red-100",
  critical: "bg-rose-100 text-rose-800 border-rose-200",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const blankForm = () => ({
  date: toLocalDateString(new Date()),
  qty2kg: "", qty5kg: "", qty8kg: "", qty10kg: "",
  tapeUsedBox: "", scrapKg: "", notes: "",
});

const INPUT = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:text-sm";
const TEXTAREA = "w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-base outline-none transition-all placeholder:text-slate-300 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10 sm:text-sm";
const LABEL = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";
const BTN = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto";
const BTN_PRIMARY = `${BTN} bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white shadow-sm hover:from-[#0a1e3f] hover:to-[#06142b]`;
const BTN_SECONDARY = `${BTN} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`;
const BTN_DANGER = `${BTN} bg-rose-600 text-white hover:bg-rose-700`;
const CHIP_BTN = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50";
const OVERLAY = "fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[3px] sm:items-center sm:px-4 sm:py-6";
const SHEET = "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl";
const FOOTER = "flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:justify-end sm:px-5";

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

const SectionLabel = ({ icon: Icon, label, tint = "slate", extra }) => (
  <div className="flex items-center gap-2">
    <div className={`flex h-6 w-6 items-center justify-center rounded-md bg-${tint}-100 text-${tint}-700`}>
      <Icon size={13} />
    </div>
    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">{label}</p>
    {extra && <span className="ml-auto text-[10px] font-medium text-slate-400">{extra}</span>}
  </div>
);

const Banner = ({ type, message, onClose }) => {
  const isErr = type === "error";
  const Icon = isErr ? AlertTriangle : CheckCircle2;
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-3 py-3 sm:px-4 ${isErr ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {isErr && <p className="text-xs font-semibold">Something went wrong</p>}
        <p className={`text-xs leading-5 ${isErr ? "mt-0.5 break-words text-red-600" : "font-semibold"}`}>{message}</p>
      </div>
      <button type="button" onClick={onClose} className={`rounded-md p-1 ${isErr ? "text-red-500 hover:bg-red-100" : "text-emerald-500 hover:bg-emerald-100"}`}>
        <X size={15} />
      </button>
    </div>
  );
};

const KpiCard = ({ icon: Icon, top, bg, value, tone = "text-slate-900", label, sub }) => (
  <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <div className={`absolute inset-x-0 top-0 h-[3px] ${top}`} />
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${bg}`}><Icon size={18} /></div>
    <div className="mt-3 sm:mt-4">
      <p className={`truncate text-xl font-semibold tracking-tight sm:text-[26px] ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px]">{sub}</p>}
    </div>
  </div>
);

const Strip = ({ cols = 3, children }) => (
  <div className={`grid grid-cols-${cols} gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center sm:gap-3`}>{children}</div>
);

const StripStat = ({ label, value, unit, tone = "text-slate-900" }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>
      {value}{unit && <span className="ml-1 text-[10px] font-medium text-slate-500">{unit}</span>}
    </p>
  </div>
);

const StatusPill = ({ status, size = "sm" }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full border ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"} font-semibold ${STATUS_CLS[status.type]}`}>
    {status.label}
  </span>
);

const StockStrip = ({ item, thirdLabel = "Available", size = "sm" }) => {
  const reserved = Number(item.reservedQty || 0);
  const free = Math.max(Number(item.quantity || 0) - reserved, 0);
  const st = stockStatus(item);
  const tone = st.type === "danger" ? "text-rose-600" : st.type === "warning" ? "text-amber-700" : "text-emerald-700";
  const valCls = size === "lg" ? "text-base" : "text-sm";
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center sm:gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
        <p className={`mt-1 ${valCls} font-semibold tabular-nums text-slate-900`}>{fmtNum(item.quantity)} <span className="text-[10px] font-medium text-slate-500">{item.unit}</span></p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reserved</p>
        <p className={`mt-1 ${valCls} font-semibold tabular-nums text-indigo-600`}>{fmtNum(reserved)} <span className="text-[10px] font-medium text-slate-500">{item.unit}</span></p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{thirdLabel}</p>
        <p className={`mt-1 ${valCls} font-semibold tabular-nums ${tone}`}>{fmtNum(free)} <span className="text-[10px] font-medium text-slate-500">{item.unit}</span></p>
      </div>
    </div>
  );
};

/* ================================================================
 *  MODAL SHELL
 * ================================================================ */
function Modal({ onClose, busy, width = "sm:max-w-md", z = "z-50", children }) {
  return (
    <div className={OVERLAY.replace("z-50", z)} onClick={() => !busy && onClose()}>
      <div className={`${SHEET} ${width}`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalHeader({ icon: Icon, title, subtitle, onClose, busy, tone = "default" }) {
  const warn = tone === "warn";
  return (
    <div className={`flex shrink-0 items-start justify-between gap-3 border-b px-4 py-4 sm:px-5 ${warn ? "border-amber-100 bg-amber-50/60" : "border-slate-200"}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${warn ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
            <Icon size={16} />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
        <X size={17} />
      </button>
    </div>
  );
}

function ModalFooter({ onCancel, formId, busy, saveLabel = "Save", icon: Icon = Save, danger }) {
  return (
    <div className={FOOTER}>
      <button type="button" onClick={onCancel} disabled={busy} className={BTN_SECONDARY}>Cancel</button>
      <button type="submit" form={formId} disabled={busy} className={danger ? BTN_DANGER : BTN_PRIMARY}>
        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} />}
        {saveLabel}
      </button>
    </div>
  );
}

/* ================================================================
 *  KPI CONFIG
 * ================================================================ */
const KPIS = [
  { key: "stockTotal", label: "Total Stock (all sizes)", icon: Package, top: "bg-gradient-to-r from-sky-400 to-blue-600", bg: "bg-gradient-to-br from-sky-50 to-blue-100 text-blue-700" },
  { key: "totalKg", label: "Total Kg Produced", icon: Boxes, top: "bg-gradient-to-r from-emerald-400 to-teal-600", bg: "bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700" },
  { key: "stockReserved", label: "Reserved", icon: Layers, top: "bg-gradient-to-r from-indigo-400 to-violet-600", bg: "bg-gradient-to-br from-indigo-50 to-violet-100 text-violet-700" },
];

/* ================================================================
 *  MAIN
 * ================================================================ */
function Products() {
  /* ── data ── */
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [stock, setStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [absentIds, setAbsentIds] = useState(() => new Set());
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  /* ── shared ── */
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState({ error: "", success: "" });
  const flashMsg = (patch) => setFlash((f) => ({ ...f, ...patch }));

  /* ── filters ── */
  const [filters, setFilters] = useState({ from: "", to: "", page: 1 });
  const patchFilters = (patch) => setFilters((f) => ({ ...f, page: patch.page ?? f.page, ...patch }));

  /* ── modals ── */
  const [detailId, setDetailId] = useState(null);
  const [prodModal, setProdModal] = useState(null); // { editing, form, workerRows }
  const [stockModal, setStockModal] = useState(null); // { kind, item, form }
  const [conflict, setConflict] = useState(null); // { info, pending }

  /* ── fetchers ── */
  const fetchEntries = useCallback(async () => {
    try { setEntriesLoading(true); setEntries((await getProductProductions({ limit: 500 })).data?.data || []); }
    catch (err) { flashMsg({ error: errMsg(err, "Failed to load production entries") }); }
    finally { setEntriesLoading(false); }
  }, []);

  const fetchStock = useCallback(async () => {
    try { setStockLoading(true); setStock((await getProductStock()).data?.data || []); }
    catch (err) { flashMsg({ error: errMsg(err, "Failed to load product stock") }); }
    finally { setStockLoading(false); }
  }, []);

  const loadWorkers = useCallback(async () => {
    try {
      setWorkersLoading(true);
      const res = await getWorkers({ status: "Active", payType: "Variable", limit: 100 });
      setWorkers(res?.data?.data || []);
    } catch (err) { console.error("Failed to load workers:", err); setWorkers([]); }
    finally { setWorkersLoading(false); }
  }, []);

  const loadAttendance = useCallback(async (date) => {
    if (!date) return setAbsentIds(new Set());
    try {
      setAttendanceLoading(true);
      const rec = (await getAttendance(date))?.data?.data;
      const ids = rec && !rec.allPresent
        ? (rec.absentWorkers || []).map((w) => String(typeof w === "object" ? w._id : w))
        : [];
      setAbsentIds(new Set(ids));
    } catch (err) { console.error("Failed to load attendance:", err); setAbsentIds(new Set()); }
    finally { setAttendanceLoading(false); }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchEntries(), fetchStock(), loadWorkers()]);
  }, [fetchEntries, fetchStock, loadWorkers]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  useEffect(() => {
    if (!flash.success) return;
    const t = setTimeout(() => flashMsg({ success: "" }), 4000);
    return () => clearTimeout(t);
  }, [flash.success]);

  useEffect(() => { if (flash.error) flashMsg({ success: "" }); }, [flash.error]);
  useEffect(() => { if (flash.success) flashMsg({ error: "" }); }, [flash.success]);

  useEffect(() => {
    if (prodModal?.form?.date) loadAttendance(prodModal.form.date);
  }, [prodModal?.form?.date, loadAttendance]);

  /* ── derived ── */
  const filteredEntries = useMemo(() => {
    if (!filters.from && !filters.to) return entries;
    return entries.filter((e) => {
      const d = toLocalDateString(e.date);
      if (filters.from && d < filters.from) return false;
      if (filters.to && d > filters.to) return false;
      return true;
    });
  }, [entries, filters.from, filters.to]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PER_PAGE));
  const safePage = Math.min(filters.page, totalPages);
  const paginated = useMemo(
    () => filteredEntries.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
    [filteredEntries, safePage]
  );

  useEffect(() => { if (filters.page !== safePage) patchFilters({ page: safePage }); }, [safePage, filters.page]);

  const kpi = useMemo(() => {
    let totalReels = 0, totalKg = 0, totalScrap = 0;
    for (const e of entries) {
      for (const { key, weight } of SIZE_META) {
        const q = Number(e[key] || 0);
        totalReels += q;
        totalKg += q * weight;
      }
      totalScrap += Number(e.scrapKg || 0);
    }
    let stockTotal = 0, stockReserved = 0, stockScrap = 0, criticalCount = 0, reorderCount = 0;
    for (const s of stock) {
      stockTotal += Number(s.quantity || 0);
      stockReserved += Number(s.reservedQty || 0);
      stockScrap += Number(s.scrapQty || 0);
      const st = stockStatus(s);
      if (st.type === "danger" && st.label === "Critical") criticalCount += 1;
      else if (st.type === "warning") reorderCount += 1;
    }
    return { entries: entries.length, totalReels, totalKg, totalScrap, stockTotal, stockReserved, stockScrap, criticalCount, reorderCount };
  }, [entries, stock]);

  const selectedEntry = useMemo(() => entries.find((e) => e._id === detailId) || null, [entries, detailId]);

  /* ── preview (production form) ── */
  const preview = useMemo(() => {
    if (!prodModal) return { totalReels: 0, totalKg: 0, steelNeeded: 0, reelsBySize: {} };
    const f = prodModal.form;
    let totalReels = 0, totalKg = 0, steelNeeded = 0;
    const reelsBySize = {};
    for (const { size, key, weight } of SIZE_META) {
      const q = Number(f[key]) || 0;
      if (q <= 0) continue;
      totalReels += q;
      totalKg += q * weight;
      steelNeeded += q * REEL_COMPOSITION[size].steelKg;
      reelsBySize[size] = q;
    }
    return { totalReels, totalKg, steelNeeded: Math.round(steelNeeded * 1000) / 1000, reelsBySize };
  }, [prodModal]);

  /* ── production form ── */
  const openAdd = () => {
    setProdModal({ editing: null, form: blankForm(), workerRows: [] });
  };

  const openEdit = (entry) => {
    setProdModal({
      editing: entry,
      form: {
        date: toLocalDateString(entry.date),
        qty2kg: entry.qty2kg ?? "", qty5kg: entry.qty5kg ?? "",
        qty8kg: entry.qty8kg ?? "", qty10kg: entry.qty10kg ?? "",
        tapeUsedBox: entry.tapeUsedBox ?? "", scrapKg: entry.scrapKg ?? "",
        notes: entry.notes || "",
      },
      workerRows: (entry.workers || []).map((item) => ({
        worker: typeof item.worker === "object" ? item.worker._id : item.worker,
        production: {
          "2kg": item.production?.["2kg"] || 0,
          "5kg": item.production?.["5kg"] || 0,
          "8kg": item.production?.["8kg"] || 0,
          "10kg": item.production?.["10kg"] || 0,
        },
      })),
    });
  };

  const closeProdModal = () => { if (!saving) setProdModal(null); };
  const setFormField = (patch) => setProdModal((m) => ({ ...m, form: { ...m.form, ...patch } }));
  const addWorkerRow = () => setProdModal((m) => ({ ...m, workerRows: [...m.workerRows, { worker: "", production: { "2kg": 0, "5kg": 0, "8kg": 0, "10kg": 0 } }] }));
  const removeWorkerRow = (i) => setProdModal((m) => ({ ...m, workerRows: m.workerRows.filter((_, idx) => idx !== i) }));
  const updateWorkerRow = (i, worker) => setProdModal((m) => ({ ...m, workerRows: m.workerRows.map((r, idx) => idx === i ? { ...r, worker } : r) }));
  const updateWorkerProd = (i, size, value) => setProdModal((m) => ({
    ...m,
    workerRows: m.workerRows.map((r, idx) => idx === i ? { ...r, production: { ...r.production, [size]: Number(value) || 0 } } : r),
  }));

  const validateWorkerProduction = () => {
    const daily = Object.fromEntries(SIZE_META.map(({ size, key }) => [size, Number(prodModal.form[key]) || 0]));
    const assigned = { "2kg": 0, "5kg": 0, "8kg": 0, "10kg": 0 };
    const seen = new Set();
    for (const row of prodModal.workerRows) {
      if (!row.worker) return "Please select a worker.";
      if (seen.has(row.worker)) return "The same worker cannot be added twice.";
      if (absentIds.has(String(row.worker))) {
        const w = workers.find((x) => x._id === row.worker);
        return `${w?.name || "This worker"} is marked absent on the selected date and can't be assigned production.`;
      }
      seen.add(row.worker);
      for (const size of SIZES) {
        const qty = Number(row.production?.[size] || 0);
        if (!Number.isInteger(qty) || qty < 0) return `${size} production must be a whole number.`;
        assigned[size] += qty;
        if (assigned[size] > daily[size]) return `${size} worker production cannot exceed today's production.`;
      }
    }
    return null;
  };

  const submitProduction = async (e) => {
    e.preventDefault();
    if (saving) return;
    const workerError = validateWorkerProduction();
    if (workerError) return flashMsg({ error: workerError });

    setSaving(true); flashMsg({ error: "", success: "" });
    const { editing, form, workerRows } = prodModal;
    const payload = {
      date: form.date,
      qty2kg: Number(form.qty2kg) || 0,
      qty5kg: Number(form.qty5kg) || 0,
      qty8kg: Number(form.qty8kg) || 0,
      qty10kg: Number(form.qty10kg) || 0,
      tapeUsedBox: Number(form.tapeUsedBox) || 0,
      scrapKg: Number(form.scrapKg) || 0,
      notes: form.notes.trim() || undefined,
      workers: workerRows.map((row) => ({
        worker: row.worker,
        production: {
          "2kg": Number(row.production["2kg"] || 0),
          "5kg": Number(row.production["5kg"] || 0),
          "8kg": Number(row.production["8kg"] || 0),
          "10kg": Number(row.production["10kg"] || 0),
        },
      })),
    };
    try {
      if (editing) {
        await updateProductProduction(editing._id, payload);
        flashMsg({ success: "Production entry updated" });
      } else {
        await createProductProduction(payload);
        flashMsg({ success: "Production entry added" });
      }
      setProdModal(null);
      await refreshAll();
    } catch (err) {
      const body = err?.response?.data ?? err;
      if (body?.code === "RESERVED_CONFLICT" && body.data) {
        setConflict({ info: body.data, pending: { kind: "production", payload, id: editing?._id || null, isEdit: !!editing } });
        return;
      }
      flashMsg({ error: body?.message || err?.message || "Failed to save entry" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (entry) => {
    if (saving) return;
    if (!window.confirm(`Delete production entry for ${fmtDate(entry.date)}? This cannot be undone.`)) return;
    setSaving(true); flashMsg({ error: "", success: "" });
    try {
      await deleteProductProduction(entry._id);
      flashMsg({ success: "Entry deleted" });
      if (detailId === entry._id) setDetailId(null);
      await refreshAll();
    } catch (err) { flashMsg({ error: errMsg(err, "Failed to delete entry") }); }
    finally { setSaving(false); }
  };

  /* ── stock actions ── */
  const openStockModal = (kind, item, form) => setStockModal({ kind, item, form });
  const closeStockModal = () => { if (!saving) setStockModal(null); };
  const setStockField = (patch) => setStockModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  const openReserve = (item) => openStockModal("reserve", item, {
    reservedQty: item.reservedQty ?? 0,
    reorderLevel: item.reorderLevel ?? 0,
    criticalLevel: item.criticalLevel ?? 0,
  });
  const openAdjust = (item, type = "in") => openStockModal("adjust", item, { type, quantity: "", reason: "", notes: "" });
  const openScrap = (item) => openStockModal("scrap", item, { quantity: "", reason: "", notes: "" });

  const submitReserve = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); flashMsg({ error: "", success: "" });
    try {
      await updateProductStockReserved(stockModal.item._id, {
        reservedQty: Number(stockModal.form.reservedQty) || 0,
        reorderLevel: Number(stockModal.form.reorderLevel) || 0,
        criticalLevel: Number(stockModal.form.criticalLevel) || 0,
      });
      flashMsg({ success: "Stock settings updated" });
      setStockModal(null);
      await refreshAll();
    } catch (err) { flashMsg({ error: errMsg(err, "Failed to update reserved") }); }
    finally { setSaving(false); }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    if (saving) return;
    const { item, form } = stockModal;
    const payload = {
      type: form.type,
      quantity: Number(form.quantity) || 0,
      reason: form.reason.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    setSaving(true); flashMsg({ error: "", success: "" });
    try {
      await adjustProductStock(item._id, payload);
      flashMsg({ success: form.type === "in" ? "Stock in recorded" : form.type === "out" ? "Dispatch recorded" : "Stock level updated" });
      setStockModal(null);
      await refreshAll();
    } catch (err) {
      const body = err?.response?.data ?? err;
      if (body?.code === "RESERVED_CONFLICT" && body.data) {
        setConflict({ info: body.data, pending: { kind: "adjust", payload, id: item._id } });
        return;
      }
      flashMsg({ error: body?.message || err?.message || "Failed to adjust stock" });
    } finally { setSaving(false); }
  };

  const submitScrap = async (e) => {
    e.preventDefault();
    if (saving) return;
    const { item, form } = stockModal;
    setSaving(true); flashMsg({ error: "", success: "" });
    try {
      await recordProductScrap(item._id, {
        quantity: Number(form.quantity) || 0,
        reason: form.reason.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      flashMsg({ success: "Scrap recorded" });
      setStockModal(null);
      await refreshAll();
    } catch (err) { flashMsg({ error: errMsg(err, "Failed to record scrap") }); }
    finally { setSaving(false); }
  };

  const confirmReserved = async () => {
    if (!conflict) return;
    setSaving(true); flashMsg({ error: "" });
    const { pending } = conflict;
    try {
      if (pending.kind === "adjust") {
        await adjustProductStock(pending.id, { ...pending.payload, allowReserved: true });
        flashMsg({ success: "Dispatch recorded — reserved stock was used" });
        setStockModal(null);
      } else {
        if (pending.isEdit) {
          await updateProductProduction(pending.id, { ...pending.payload, allowReserved: true });
          flashMsg({ success: "Production entry updated — reserved stock was used" });
        } else {
          await createProductProduction({ ...pending.payload, allowReserved: true });
          flashMsg({ success: "Production entry added — reserved stock was used" });
        }
        setProdModal(null);
      }
      setConflict(null);
      await refreshAll();
    } catch (err) { flashMsg({ error: errMsg(err, "Failed to save") }); }
    finally { setSaving(false); }
  };

  /* ================================================================
   *  RENDER HELPERS
   * ================================================================ */
  const renderEntryRow = (entry) => {
    const m = getEntryMetrics(entry);
    return (
      <tr
        key={entry._id}
        onClick={() => setDetailId(entry._id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailId(entry._id); } }}
        tabIndex={0}
        role="button"
        className="group cursor-pointer transition-colors hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none"
      >
        <td className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-900">{fmtDateShort(entry.date)}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">{fmtDate(entry.date)}</p>
        </td>
        {SIZE_META.map(({ key }) => (
          <td key={key} className="whitespace-nowrap px-3 py-3 text-right">
            <span className="text-xs font-semibold tabular-nums text-slate-800">{fmtNum(entry[key])}</span>
            <span className="ml-1 text-[10px] text-slate-400">reel</span>
          </td>
        ))}
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <span className="text-xs font-semibold tabular-nums text-slate-700">{fmtNum(m.totalWtNoReel)}</span>
          <span className="ml-1 text-[10px] text-slate-400">kg</span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <span className="text-xs font-semibold tabular-nums text-slate-800">{fmtNum(m.totalWtWithReel)}</span>
          <span className="ml-1 text-[10px] text-slate-400">kg</span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          {m.scrap > 0 ? <><span className="text-xs font-semibold tabular-nums text-rose-600">{fmtNum(m.scrap)}</span><span className="ml-1 text-[10px] text-slate-400">kg</span></> : <span className="text-xs text-slate-500">--</span>}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          {m.steelConsumed > 0 ? <><span className="text-xs font-semibold tabular-nums text-sky-700">{fmtNum(m.steelConsumed)}</span><span className="ml-1 text-[10px] text-slate-400">kg</span></> : <span className="text-xs text-slate-500">--</span>}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
            <button type="button" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(entry); }} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Pencil size={13} /></button>
            <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(entry); }} disabled={saving} className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:opacity-60"><Trash2 size={13} /></button>
          </div>
        </td>
      </tr>
    );
  };

  const renderEntryCard = (entry) => {
    const m = getEntryMetrics(entry);
    return (
      <div
        key={entry._id}
        onClick={() => setDetailId(entry._id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailId(entry._id); } }}
        tabIndex={0}
        role="button"
        className="cursor-pointer px-4 py-3.5 transition-colors active:bg-slate-50 focus:bg-slate-50 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{fmtDateShort(entry.date)}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{fmtDate(entry.date)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(entry); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100"><Pencil size={14} /></button>
            <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(entry); }} disabled={saving} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 active:bg-red-50 disabled:opacity-60"><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {m.rows.map((r) => (
            <div key={r.size} className={`rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 text-center ${r.qty === 0 ? "opacity-50" : ""}`}>
              <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">{r.size}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{fmtNum(r.qty)}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {[
            ["Wt (no reel)", `${fmtNum(m.totalWtNoReel)} kg`, "text-slate-700"],
            ["Wt (reel)", `${fmtNum(m.totalWtWithReel)} kg`, "text-slate-800"],
            ["Scrap", m.scrap > 0 ? `${fmtNum(m.scrap)} kg` : null, "text-rose-600"],
            ["Steel", m.steelConsumed > 0 ? `${fmtNum(m.steelConsumed)} kg` : null, "text-sky-700"],
          ].map(([label, value, tone]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-slate-500">{label}</span>
              {value ? <span className={`font-semibold tabular-nums ${tone}`}>{value}</span> : <span className="text-slate-400">--</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStockRow = (item) => {
    const st = stockStatus(item);
    const reserved = Number(item.reservedQty || 0);
    const free = Math.max(Number(item.quantity || 0) - reserved, 0);
    const lastMovement = item.movementLog?.[item.movementLog.length - 1]?.at;
    const lastStamp = item.lastReceivedAt || item.lastScrapAt || item.lastIssuedAt || lastMovement;

    return (
      <tr
        key={item._id}
        onClick={() => openReserve(item)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openReserve(item); } }}
        tabIndex={0}
        role="button"
        className="group cursor-pointer hover:bg-slate-50/70 focus:outline-none focus-visible:bg-slate-50"
      >
        <td className="px-4 py-3">
          <p className="truncate text-xs font-semibold text-slate-900">{item.name}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">{item.size} reel</p>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <span className="text-sm font-semibold tabular-nums text-slate-900">{fmtNum(item.quantity)}</span>
          <span className="ml-1 text-[10px] text-slate-400">{item.unit}</span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          {reserved > 0 ? <><span className="text-sm font-semibold tabular-nums text-indigo-600">{fmtNum(reserved)}</span><span className="ml-1 text-[10px] text-slate-400">{item.unit}</span></> : <span className="text-xs text-slate-300">—</span>}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <span className={`text-sm font-semibold tabular-nums ${free === 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmtNum(free)}</span>
          <span className="ml-1 text-[10px] text-slate-400">{item.unit}</span>
        </td>
        <td className="px-3 py-3 text-center"><StatusPill status={st} /></td>
        <td className="whitespace-nowrap px-3 py-3 text-right text-[11px] text-slate-500">{fmtDate(lastStamp)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <button type="button" title="Reserve / Edit reserved" onClick={(e) => { e.stopPropagation(); openReserve(item); }} className="flex h-7 w-7 items-center justify-center rounded-md text-indigo-500 hover:bg-indigo-50"><Layers size={14} /></button>
            <button type="button" title="Record Scrap" onClick={(e) => { e.stopPropagation(); openScrap(item); }} className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"><PackageX size={14} /></button>
          </div>
        </td>
      </tr>
    );
  };

  const renderStockCard = (item) => {
    const st = stockStatus(item);
    const reserved = Number(item.reservedQty || 0);
    const free = Math.max(Number(item.quantity || 0) - reserved, 0);
    const lastMovement = item.movementLog?.[item.movementLog.length - 1]?.at;
    const lastStamp = item.lastReceivedAt || item.lastScrapAt || item.lastIssuedAt || lastMovement;

    return (
      <div
        key={item._id}
        onClick={() => openReserve(item)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openReserve(item); } }}
        tabIndex={0}
        role="button"
        className="min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50/60"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{item.size} reel</p>
          </div>
          <StatusPill status={st} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-center">
          <div><p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Total</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{fmtNum(item.quantity)}</p></div>
          <div><p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Reserved</p><p className={`mt-0.5 text-sm font-semibold tabular-nums ${reserved > 0 ? "text-indigo-600" : "text-slate-300"}`}>{reserved > 0 ? fmtNum(reserved) : "—"}</p></div>
          <div><p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Available</p><p className={`mt-0.5 text-sm font-semibold tabular-nums ${free === 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmtNum(free)}</p></div>
        </div>
        <div className="mt-2.5 flex items-center justify-end text-[11px] text-slate-400">{fmtDate(lastStamp)}</div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); openReserve(item); }} className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-indigo-100 bg-indigo-50/50 text-indigo-600 active:bg-indigo-100"><Layers size={14} /><span className="text-[9.5px] font-semibold">Reserve</span></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); openScrap(item); }} className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border border-rose-100 bg-rose-50/50 text-rose-500 active:bg-rose-100"><PackageX size={14} /><span className="text-[9.5px] font-semibold">Scrap</span></button>
        </div>
      </div>
    );
  };

  /* ================================================================
   *  RENDER
   * ================================================================ */
  return (
    <div className="w-full min-w-0 space-y-4 pb-6 sm:space-y-5">
      {/* HEADER */}
      <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f2a52] to-[#0a1e3f] text-white shadow-md ring-1 ring-[#0a1e3f]/10 sm:h-11 sm:w-11"><Package size={20} /></div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-[#0a1e3f] sm:text-[24px]">Product Inventory</h1>
            <p className="mt-0.5 text-[12.5px] text-slate-500">Finished goods stock and daily production</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openAdd} className={`${BTN_PRIMARY} h-10 flex-1 sm:h-9 sm:flex-none`}><Plus size={15} /> Add Today's Stock</button>
          <button type="button" onClick={refreshAll} title="Refresh" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:h-9 sm:w-9">
            <RefreshCw size={15} className={entriesLoading || stockLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {flash.error && <Banner type="error" message={flash.error} onClose={() => flashMsg({ error: "" })} />}
      {flash.success && <Banner type="success" message={flash.success} onClose={() => flashMsg({ success: "" })} />}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {KPIS.map((k) => (
          <KpiCard key={k.key} {...k} value={fmtNum(kpi[k.key])} />
        ))}
        <KpiCard
          icon={AlertTriangle}
          top="bg-gradient-to-r from-amber-400 to-rose-500"
          bg="bg-gradient-to-br from-amber-50 to-rose-100 text-rose-600"
          value={kpi.criticalCount + kpi.reorderCount}
          tone={kpi.criticalCount > 0 ? "text-rose-600" : kpi.reorderCount > 0 ? "text-amber-700" : "text-slate-900"}
          label={kpi.criticalCount === 0 && kpi.reorderCount === 0 ? "All sizes healthy" : undefined}
          sub={
            kpi.criticalCount + kpi.reorderCount > 0 && (
              <>
                {kpi.criticalCount > 0 && <span className="font-semibold text-rose-600">{kpi.criticalCount} critical</span>}
                {kpi.criticalCount > 0 && kpi.reorderCount > 0 && " · "}
                {kpi.reorderCount > 0 && <span className="font-semibold text-amber-700">{kpi.reorderCount} reorder</span>}
              </>
            )
          }
        />
      </div>

      {/* PRODUCTION LOG */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0a1e3f] text-white"><Package size={14} /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">Daily Production Log</p>
              <p className="truncate text-[10px] text-slate-400">Tap any entry to see that day's full production details</p>
            </div>
          </div>
          <div className="flex w-full justify-end sm:w-auto">
            <DateFilter from={filters.from} to={filters.to} accent="#0a1e3f" onChange={({ from, to }) => patchFilters({ from, to, page: 1 })} />
          </div>
        </div>

        {entriesLoading ? (
          <div className="flex min-h-[200px] items-center justify-center"><RefreshCw size={24} className="animate-spin text-slate-400" /></div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              {entries.length === 0 ? <Package size={18} /> : <CalendarRange size={18} />}
            </div>
            <h4 className="mt-3 text-sm font-semibold text-slate-800">
              {entries.length === 0 ? "No production entries yet" : "No entries in this date range"}
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              {entries.length === 0 ? `Click "Add Today's Stock" to record the first day's output.` : "Try a wider range or clear the filter."}
            </p>
            {entries.length > 0 && (filters.from || filters.to) && (
              <button type="button" onClick={() => patchFilters({ from: "", to: "", page: 1 })} className={`${CHIP_BTN} mt-3`}><X size={12} /> Clear filter</button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">{paginated.map(renderEntryCard)}</div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] table-fixed text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="w-[120px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                    {SIZES.map((s) => <th key={s} className="w-[70px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">{s.replace("kg", " kg")}</th>)}
                    <th className="w-[100px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Wt (no reel)</th>
                    <th className="w-[100px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Wt (reel)</th>
                    <th className="w-[80px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Scrap</th>
                    <th className="w-[90px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Steel</th>
                    <th className="w-[80px] px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">{paginated.map(renderEntryRow)}</tbody>
              </table>
            </div>
          </>
        )}

        <Pagination page={safePage} totalPages={totalPages} onPage={(p) => patchFilters({ page: p })} totalRecords={filteredEntries.length} perPage={PER_PAGE} />
      </section>

      {/* PRODUCT STOCK */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0a1e3f] text-white"><Boxes size={14} /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">Current Product Stock</p>
              <p className="text-[10px] text-slate-400">Finished goods by reel size — reserve, adjust, or scrap</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">{stock.length} sizes</span>
        </div>

        {stockLoading ? (
          <div className="flex min-h-[180px] items-center justify-center"><RefreshCw size={24} className="animate-spin text-slate-400" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">{stock.map(renderStockCard)}</div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] table-fixed text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    {["Product Name", "Total", "Reserved", "Available", "Status", "Last Movement", ""].map((h, i) => (
                      <th key={i} className={`px-${i === 0 || i === 6 ? 4 : 3} py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 ${i === 4 ? "text-center" : i === 0 || i === 6 ? "text-left" : "text-right"} ${i === 6 ? "w-0" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">{stock.map(renderStockRow)}</tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ============ PRODUCTION DETAIL MODAL ============ */}
      {selectedEntry && (() => {
        const m = getEntryMetrics(selectedEntry);
        const totalEarnings = (selectedEntry.workers || []).reduce((s, w) => s + getWorkerEarnings(w).totalEarnings, 0);
        return (
          <Modal onClose={() => setDetailId(null)} width="sm:max-w-3xl">
            <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f2a52] to-[#0a1e3f] text-white shadow-md"><Package size={18} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Production Details</p>
                  <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">{fmtDateLong(selectedEntry.date)}</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">{fmtNum(m.totalReels)} reels · {fmtNum(m.totalWtWithReel)} kg total</p>
                </div>
              </div>
              <button type="button" onClick={() => setDetailId(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700"><Boxes size={13} /></div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">Reel Breakdown</p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[340px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        {["Size", "Reels", "Steel", "Spool", "Gross"].map((h, i) => (
                          <th key={h} className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {m.rows.map((r) => (
                        <tr key={r.size} className={r.qty === 0 ? "opacity-45" : ""}>
                          <td className="px-3 py-2.5"><span className="text-xs font-semibold text-slate-800">{r.size}</span></td>
                          <td className="px-3 py-2.5 text-right"><span className="text-xs font-semibold tabular-nums text-slate-900">{fmtNum(r.qty)}</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right"><span className="text-xs tabular-nums text-slate-700">{fmtNum(r.steel)}</span><span className="ml-0.5 text-[9px] text-slate-400">kg</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right"><span className="text-xs tabular-nums text-slate-700">{fmtNum(r.spool)}</span><span className="ml-0.5 text-[9px] text-slate-400">kg</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right"><span className="text-xs font-semibold tabular-nums text-slate-900">{fmtNum(r.withReel)}</span><span className="ml-0.5 text-[9px] text-slate-400">kg</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">Total</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">{fmtNum(m.totalReels)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">{fmtNum(m.totalWtNoReel)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">{fmtNum(m.totalWtWithReel - m.totalWtNoReel)}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">{fmtNum(m.totalWtWithReel)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Reels" value={fmtNum(m.totalReels)} />
                <MiniStat label="Net weight" value={`${fmtNum(m.totalWtNoReel)} kg`} />
                <MiniStat label="Tape" value={`${fmtNum(m.tape)} box`} tone="amber" />
                <MiniStat label="Scrap" value={`${fmtNum(m.scrap)} kg`} tone="rose" />
              </div>

              {selectedEntry.workers?.length > 0 && (
                <section className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50/60 px-4 py-3">
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800">Worker Production & Earnings</p>
                      <p className="mt-0.5 text-[10px] text-emerald-600">Daily production completed by each worker</p>
                    </div>
                    <div className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-right">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600">Total Earnings</p>
                      <p className="text-sm font-bold tabular-nums text-emerald-800">₹{fmtMoney(totalEarnings)}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedEntry.workers.map((workerEntry, i) => {
                      const w = workerEntry.worker;
                      const { rows, totalGrossKg, totalEarnings: earned } = getWorkerEarnings(workerEntry);
                      return (
                        <div key={workerEntry._id || i} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                                {w?.name ? w.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "W"}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{w?.name || "Unknown Worker"}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">{fmtNum(totalGrossKg)} kg gross production</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Earned Today</p>
                              <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-600">₹{fmtMoney(earned)}</p>
                            </div>
                          </div>
                          {rows.length > 0 ? (
                            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                              <div className="grid grid-cols-4 bg-slate-50 px-3 py-2">
                                {["Reel", "Qty", "Rate / KG", "Earned"].map((h, idx) => (
                                  <span key={h} className={`text-[9px] font-bold uppercase tracking-wider text-slate-400 ${idx === 0 ? "" : "text-right"}`}>{h}</span>
                                ))}
                              </div>
                              {rows.map((r) => (
                                <div key={r.size} className="grid grid-cols-4 border-t border-slate-100 px-3 py-2.5">
                                  <span className="text-xs font-semibold text-slate-800">{r.size}</span>
                                  <span className="text-right text-xs tabular-nums text-slate-700">{fmtNum(r.reels)}</span>
                                  <span className="text-right text-xs tabular-nums text-slate-600">₹{fmtMoney(r.rate)}</span>
                                  <span className="text-right text-xs font-semibold tabular-nums text-slate-900">₹{fmtMoney(r.earned)}</span>
                                </div>
                              ))}
                              <div className="grid grid-cols-4 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Total</span>
                                <span className="text-right text-xs font-bold tabular-nums text-slate-900">{fmtNum(rows.reduce((s, r) => s + r.reels, 0))}</span>
                                <span />
                                <span className="text-right text-xs font-bold tabular-nums text-emerald-700">₹{fmtMoney(earned)}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-400">No production assigned to this worker.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-50/40">
                <div className="flex items-center gap-2 border-b border-sky-200/70 px-4 py-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-200/60 text-sky-800"><Layers size={13} /></div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-sky-800">Raw Material Consumed</p>
                </div>
                <div className="space-y-2 px-4 py-3 text-xs">
                  <div className="flex items-center justify-between gap-3"><span className="text-sky-900">Steel (in reels)</span><span className="font-bold tabular-nums text-sky-900">{fmtNum(m.totalWtNoReel)} kg</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-sky-900">Scrap</span><span className="font-bold tabular-nums text-sky-900">{fmtNum(m.scrap)} kg</span></div>
                  <div className="mt-1 flex items-center justify-between gap-3 border-t border-sky-200/70 pt-2">
                    <span className="font-semibold text-sky-900">Total steel consumed</span>
                    <span className="font-bold tabular-nums text-sky-900">{fmtNum(m.steelConsumed)} kg</span>
                  </div>
                </div>
              </section>

              <div>
                <p className={LABEL}>Notes</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                    {selectedEntry.notes?.trim() ? selectedEntry.notes : "No notes recorded for this day."}
                  </p>
                </div>
              </div>
            </div>

            <div className={FOOTER}>
              <button type="button" onClick={() => setDetailId(null)} className={BTN_SECONDARY}>Close</button>
              <button type="button" onClick={() => { const e = selectedEntry; setDetailId(null); openEdit(e); }} className={BTN_PRIMARY}><Pencil size={14} /> Edit Entry</button>
            </div>
          </Modal>
        );
      })()}

      {/* ============ ADD / EDIT PRODUCTION MODAL ============ */}
      {prodModal && (
        <Modal onClose={closeProdModal} busy={saving} width="sm:max-w-3xl">
          <ModalHeader icon={Package} title={prodModal.editing ? "Edit Production Entry" : "Add Today's Stock"} subtitle={prodModal.editing ? "Update the reel counts produced for this date." : "Record reel counts produced. Raw materials auto-deduct on save."} onClose={closeProdModal} busy={saving} />
          <form onSubmit={submitProduction} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              <Field label="Date" required>
                <input type="date" value={prodModal.form.date} onChange={(e) => setFormField({ date: e.target.value })} required className={INPUT} />
              </Field>

              {/* REEL PRODUCTION */}
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel icon={Boxes} label="Reel Production" tint="sky" />
                  <span className="text-[10px] font-medium text-slate-400">Enter quantity in reels</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="grid grid-cols-[1fr_1.4fr] items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reel Size</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">No. of Reels</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {SIZE_META.map(({ size, key }) => {
                      const kg = parseFloat(size);
                      const color = kg === 2 ? "bg-sky-50 text-sky-700 border-sky-200"
                        : kg === 5 ? "bg-violet-50 text-violet-700 border-violet-200"
                        : kg === 8 ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200";
                      return (
                        <div key={size} className="grid grid-cols-[1fr_1.4fr] items-center gap-3 bg-white px-3 py-3 transition-colors hover:bg-slate-50/60 sm:px-4">
                          <div className="relative">
                            <input type="text" value={kg} readOnly tabIndex={-1} className={`h-10 w-full rounded-lg border pl-3 pr-10 text-base font-bold tabular-nums outline-none sm:pr-12 sm:text-sm ${color} cursor-default`} />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider">kg</span>
                          </div>
                          <div className="relative">
                            <input type="number" inputMode="numeric" min="0" step="1" value={prodModal.form[key]} onChange={(e) => setFormField({ [key]: e.target.value })} placeholder="0" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-14 text-base font-semibold tabular-nums text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10 sm:pr-16 sm:text-sm" />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">reels</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[1fr_1.4fr] items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total</p>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-base font-bold tabular-nums text-slate-900">{fmtNum(preview.totalReels)}</span>
                      <span className="text-[10px] font-medium text-slate-500">reels</span>
                      {preview.totalReels > 0 && <span className="text-[11px] font-semibold tabular-nums text-slate-500 sm:ml-auto">≈ {fmtNum(preview.totalKg)} kg</span>}
                    </div>
                  </div>
                </div>
              </section>

              {/* WORKER PRODUCTION */}
              <section className="border-t border-slate-200 pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionLabel icon={Layers} label="Worker Production" tint="violet" />
                    <p className="mt-1 text-[10px] text-slate-400">Assign today's reel production to workers.</p>
                  </div>
                  <button type="button" onClick={addWorkerRow} className={CHIP_BTN}><Plus size={14} /> Add Worker</button>
                </div>

                {prodModal.workerRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <p className="text-xs text-slate-500">No workers assigned yet.</p>
                    <button type="button" onClick={addWorkerRow} className="mt-2 text-xs font-semibold text-[#0a1e3f] hover:text-[#06142b]">+ Assign Worker</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prodModal.workerRows.map((row, index) => (
                      <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <div className="mb-3 flex items-end gap-3">
                          <div className="min-w-0 flex-1">
                            <label className={LABEL}>Worker</label>
                            <select value={row.worker} onChange={(e) => updateWorkerRow(index, e.target.value)} className={INPUT} disabled={workersLoading || attendanceLoading}>
                              <option value="">{workersLoading ? "Loading workers..." : attendanceLoading ? "Loading attendance..." : "Select worker"}</option>
                              {workers.map((w) => {
                                const isAbsent = absentIds.has(String(w._id));
                                return <option key={w._id} value={w._id} disabled={isAbsent}>{w.name}{isAbsent ? " — absent today" : ""}</option>;
                              })}
                            </select>
                            {row.worker && absentIds.has(String(row.worker)) && (
                              <p className="mt-1 text-[10px] font-semibold text-red-600">This worker is marked absent on {prodModal.form.date}. Pick someone else.</p>
                            )}
                          </div>
                          <button type="button" onClick={() => removeWorkerRow(index)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50" title="Remove worker"><Trash2 size={15} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {SIZES.map((size) => (
                            <Field key={size} label={`${size} Reels`}>
                              <input type="number" min="0" step="1" inputMode="numeric" value={row.production[size]} onChange={(e) => updateWorkerProd(index, size, e.target.value)} placeholder="0" className={INPUT} />
                            </Field>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <span className="text-[10px] font-medium text-slate-500">Worker total</span>
                          <span className="text-xs font-bold tabular-nums text-slate-800">{SIZES.reduce((t, s) => t + Number(row.production[s] || 0), 0)} reels</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {prodModal.workerRows.length > 0 && (
                  <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-700">Assigned Production</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SIZES.map((size) => {
                        const key = `qty${size}`;
                        const assigned = prodModal.workerRows.reduce((s, r) => s + Number(r.production[size] || 0), 0);
                        const total = Number(prodModal.form[key] || 0);
                        const complete = assigned === total;
                        const over = assigned > total;
                        return (
                          <div key={size} className={`rounded-lg border bg-white px-3 py-2 ${over ? "border-red-200" : complete ? "border-emerald-200" : "border-slate-200"}`}>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{size}</p>
                            <p className={`mt-1 text-sm font-bold tabular-nums ${over ? "text-red-600" : complete ? "text-emerald-600" : "text-slate-800"}`}>{assigned} / {total}</p>
                            <p className="text-[9px] text-slate-400">reels assigned</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* CONSUMED / SCRAPPED */}
              <section>
                <div className="mb-3"><SectionLabel icon={PackageX} label="Consumed / Scrapped" tint="rose" /></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <UnitInput label="Tape Used" name="tapeUsedBox" value={prodModal.form.tapeUsedBox} onChange={(v) => setFormField({ tapeUsedBox: v })} unit="box" step="1" />
                  <UnitInput label="Scrap" name="scrapKg" value={prodModal.form.scrapKg} onChange={(v) => setFormField({ scrapKg: v })} unit="kg" step="0.01" />
                </div>
              </section>

              {/* SUMMARY */}
              {(preview.totalReels > 0 || Number(prodModal.form.tapeUsedBox) > 0 || Number(prodModal.form.scrapKg) > 0) && (
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:grid-cols-4">
                  <MiniStat label="Reels" value={fmtNum(preview.totalReels)} />
                  <MiniStat label="Weight" value={`${fmtNum(preview.totalKg)} kg`} />
                  <MiniStat label="Tape" value={`${fmtNum(prodModal.form.tapeUsedBox || 0)} box`} tone="amber" />
                  <MiniStat label="Scrap" value={`${fmtNum(prodModal.form.scrapKg || 0)} kg`} tone="rose" />
                </div>
              )}

              {/* RAW MATERIAL PREVIEW */}
              {preview.steelNeeded > 0 && (
                <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-50/40">
                  <div className="flex items-center gap-2 border-b border-amber-200/70 px-4 py-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-200/60 text-amber-800"><AlertTriangle size={13} /></div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800">Raw Materials to be Consumed</p>
                  </div>
                  <div className="space-y-2 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between gap-3"><span className="text-amber-900">Steel Wire</span><span className="font-bold tabular-nums text-amber-900">{fmtNum(preview.steelNeeded)} kg</span></div>
                    {Object.entries(preview.reelsBySize).map(([size, qty]) => (
                      <div key={size} className="flex items-center justify-between gap-3"><span className="text-amber-900">Reel {size}</span><span className="font-bold tabular-nums text-amber-900">{fmtNum(qty)} pcs</span></div>
                    ))}
                  </div>
                  <div className="border-t border-amber-200/70 bg-amber-100/40 px-4 py-2">
                    <p className="text-[10px] font-medium text-amber-700">Stock will be deducted automatically on save.</p>
                  </div>
                </div>
              )}

              <Field label="Notes">
                <textarea value={prodModal.form.notes} onChange={(e) => setFormField({ notes: e.target.value })} rows={2} placeholder="Optional remarks" className={TEXTAREA} />
              </Field>
            </div>

            <ModalFooter formId="prod-form" onCancel={closeProdModal} busy={saving} saveLabel={prodModal.editing ? "Save Changes" : "Add Entry"} />
          </form>
        </Modal>
      )}

      {/* ============ RESERVE MODAL ============ */}
      {stockModal?.kind === "reserve" && (
        <Modal onClose={closeStockModal} busy={saving}>
          <ModalHeader icon={Layers} title="Stock Settings" subtitle={`${stockModal.item.name} — reserved stock and alert levels`} onClose={closeStockModal} busy={saving} />
          <form id="res-form" onSubmit={submitReserve} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              <StockStrip item={stockModal.item} size="lg" />
              <Field label="Reserved Quantity" required hint="Cannot exceed total stock. Set to 0 to release all.">
                <input type="number" inputMode="numeric" min="0" step="1" max={stockModal.item.quantity} value={stockModal.form.reservedQty} onChange={(e) => setStockField({ reservedQty: e.target.value })} required className={INPUT} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reorder Level" required hint="Warn when available drops below this.">
                  <input type="number" inputMode="numeric" min="0" step="1" value={stockModal.form.reorderLevel} onChange={(e) => setStockField({ reorderLevel: e.target.value })} required className={INPUT} />
                </Field>
                <Field label="Critical Level" required hint="Alert when available drops below this.">
                  <input type="number" inputMode="numeric" min="0" step="1" value={stockModal.form.criticalLevel} onChange={(e) => setStockField({ criticalLevel: e.target.value })} required className={INPUT} />
                </Field>
              </div>
              {Number(stockModal.form.criticalLevel) > Number(stockModal.form.reorderLevel) && (
                <p className="text-[10px] font-semibold text-red-600">Critical level should not exceed reorder level.</p>
              )}
            </div>
            <ModalFooter formId="res-form" onCancel={closeStockModal} busy={saving} />
          </form>
        </Modal>
      )}

      {/* ============ ADJUST MODAL ============ */}
      {stockModal?.kind === "adjust" && (
        <Modal onClose={closeStockModal} busy={saving}>
          <ModalHeader icon={Package} title="Adjust Stock" subtitle={stockModal.item.name} onClose={closeStockModal} busy={saving} />
          <form id="adj-form" onSubmit={submitAdjust} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              <StockStrip item={stockModal.item} thirdLabel="Free" />
              <Field label="Type">
                <select value={stockModal.form.type} onChange={(e) => setStockField({ type: e.target.value })} className={INPUT}>
                  <option value="in">Stock In (add)</option>
                  <option value="out">Dispatch (remove)</option>
                  <option value="adjustment">Set Level (override)</option>
                </select>
              </Field>
              <UnitInput
                label={stockModal.form.type === "adjustment" ? "New Stock Level" : "Quantity"}
                value={stockModal.form.quantity}
                onChange={(v) => setStockField({ quantity: v })}
                unit={stockModal.item.unit}
                step="1"
                required
                max={stockModal.form.type === "out" ? stockModal.item.quantity : undefined}
              />
              <Field label="Reason">
                <input type="text" value={stockModal.form.reason} onChange={(e) => setStockField({ reason: e.target.value })} placeholder="e.g. Order #123, Found extra, Cycle count" className={INPUT} />
              </Field>
              <Field label="Notes">
                <textarea value={stockModal.form.notes} onChange={(e) => setStockField({ notes: e.target.value })} rows={2} placeholder="Optional" className={TEXTAREA} />
              </Field>
            </div>
            <ModalFooter formId="adj-form" onCancel={closeStockModal} busy={saving} />
          </form>
        </Modal>
      )}

      {/* ============ SCRAP MODAL ============ */}
      {stockModal?.kind === "scrap" && (
        <Modal onClose={closeStockModal} busy={saving}>
          <ModalHeader icon={PackageX} title="Record Scrap" subtitle={`${stockModal.item.name} — mark as scrap (kg)`} onClose={closeStockModal} busy={saving} />
          <form id="scrap-form" onSubmit={submitScrap} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Current Stock</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{fmtNum(stockModal.item.quantity)} <span className="text-xs font-medium text-slate-500">{stockModal.item.unit}</span></p>
              </div>
              <UnitInput
                label="Quantity Scrapped (kg)"
                value={stockModal.form.quantity}
                onChange={(v) => setStockField({ quantity: v })}
                unit="kg"
                step="0.01"
                required
                hint={`Will be converted to reels based on ${stockModal.item.size} weight and deducted from stock.`}
              />
              <Field label="Reason">
                <input type="text" value={stockModal.form.reason} onChange={(e) => setStockField({ reason: e.target.value })} placeholder="e.g. Damaged, Production defect" className={INPUT} />
              </Field>
              <Field label="Notes">
                <textarea value={stockModal.form.notes} onChange={(e) => setStockField({ notes: e.target.value })} rows={2} placeholder="Optional" className={TEXTAREA} />
              </Field>
            </div>
            <div className={FOOTER}>
              <button type="button" onClick={closeStockModal} disabled={saving} className={BTN_SECONDARY}>Cancel</button>
              <button type="submit" form="scrap-form" disabled={saving} className={BTN_DANGER}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <PackageX size={14} />}
                Record Scrap
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ RESERVED CONFIRM MODAL ============ */}
      {conflict && (
        <Modal onClose={() => setConflict(null)} busy={saving} z="z-[60]" width="sm:max-w-md">
          <ModalHeader
            icon={AlertTriangle}
            title="Reserved stock will be used"
            subtitle={conflict.pending.kind === "adjust" ? "This dispatch exceeds the available (free) stock." : "This production exceeds the available (free) stock."}
            onClose={() => setConflict(null)}
            busy={saving}
            tone="warn"
          />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{conflict.info.name}</p>
            <Strip>
              <StripStat label="Free" value={fmtNum(conflict.info.freeQty)} unit={conflict.info.unit} tone="text-emerald-700" />
              <StripStat label="Reserved" value={fmtNum(conflict.info.reservedQty)} unit={conflict.info.unit} tone="text-indigo-600" />
              <StripStat label="Requested" value={fmtNum(conflict.info.requested)} unit={conflict.info.unit} tone="text-amber-700" />
            </Strip>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-900">
                <span className="font-semibold">{fmtNum(conflict.info.usedFromReserved)} {conflict.info.unit}</span> will be taken from stock reserved for other orders. This will reduce the reserved quantity.
              </p>
            </div>
            <p className="text-xs text-slate-600">Do you grant permission to proceed?</p>
          </div>
          <div className={FOOTER}>
            <button type="button" onClick={() => setConflict(null)} disabled={saving} className={BTN_SECONDARY}>No, Cancel</button>
            <button type="button" onClick={confirmReserved} disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60 sm:h-9 sm:w-auto">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Yes, Use Reserved
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================================================================
 *  SECONDARY PRIMITIVES
 * ================================================================ */
function MiniStat({ label, value, tone }) {
  const toneCls = tone === "amber" ? "border-amber-100 bg-amber-50/60 text-amber-700 [&_p:last-child]:text-amber-800"
    : tone === "rose" ? "border-rose-100 bg-rose-50/60 text-rose-700 [&_p:last-child]:text-rose-800"
    : "border-slate-200 bg-white text-slate-400 [&_p:last-child]:text-slate-900";
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${toneCls}`}>
      <p className="text-[9.5px] font-bold uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function UnitInput({ label, name, value, onChange, unit, step = "1", required, max, hint }) {
  return (
    <Field label={label} required={required} hint={hint}>
      <div className="rounded-xl border border-slate-200 bg-white p-0">
        <div className="relative">
          <input
            type="number"
            inputMode={step.includes(".") ? "decimal" : "numeric"}
            min="0"
            step={step}
            max={max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            required={required}
            name={name}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-14 text-base font-semibold tabular-nums text-slate-800 outline-none transition-all placeholder:font-normal placeholder:text-slate-300 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10 sm:text-sm"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{unit}</span>
        </div>
      </div>
    </Field>
  );
}

export default Products;