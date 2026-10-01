import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import DateFilter from "../components/DateFilter";
import {
  Package,
  Plus,
  X,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CalendarRange,
  Pencil,
  Trash2,
  Layers,
  ArrowUpFromLine,
  ArrowDownToLine,
  Boxes,
  PackageX,
  Eye,
} from "lucide-react";

import {
  getProductProductions,
  createProductProduction,
  updateProductProduction,
  deleteProductProduction,
  getProductStock,
  updateProductStockReserved,
  adjustProductStock,
  recordProductScrap,
} from "../api/api";

const SIZES = ["2kg", "5kg", "8kg", "10kg"];
const PER_PAGE = 15;

const toLocalDateString = (d) => {
  const dt = new Date(d);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const REEL_COMPOSITION = {
  "2kg":  { spoolKg: 0.2, steelKg: 1.8 },
  "5kg":  { spoolKg: 0.6, steelKg: 4.4 },
  "8kg":  { spoolKg: 0.7, steelKg: 7.3 },
  "10kg": { spoolKg: 0.7, steelKg: 9.3 },
};

const SIZE_META = [
  { key: "qty2kg",  size: "2kg",  weight: 2 },
  { key: "qty5kg",  size: "5kg",  weight: 5 },
  { key: "qty8kg",  size: "8kg",  weight: 8 },
  { key: "qty10kg", size: "10kg", weight: 10 },
];

const getEntryMetrics = (entry) => {
  let totalReels = 0;
  let totalWtNoReel = 0;
  let totalWtWithReel = 0;

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

  return {
    rows,
    totalReels,
    totalWtNoReel,
    totalWtWithReel,
    scrap,
    tape,
    steelConsumed: totalWtNoReel + scrap,
  };
};

const emptyForm = (date) => ({
  date: date || toLocalDateString(new Date()),
  qty2kg: "",
  qty5kg: "",
  qty8kg: "",
  qty10kg: "",
  tapeUsedBox: "",
  scrapKg: "",
  notes: "",
});

function Products() {
  /* ---------------- STATE ---------------- */
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);

  /* ---------------- DATE FILTER ---------------- */
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ---------------- DETAIL VIEW ---------------- */
  const [detailId, setDetailId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(emptyForm());

  /* ---------------- PRODUCTION RESERVED CONFLICT ---------------- */
  const [isReservedConfirmOpen, setIsReservedConfirmOpen] = useState(false);
  const [reservedConflict, setReservedConflict] = useState(null);
  const [pendingProductionPayload, setPendingProductionPayload] = useState(null);
  const [pendingAdjustPayload, setPendingAdjustPayload] = useState(null);

  /* ---------------- PRODUCT STOCK STATE ---------------- */
  const [stock, setStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);

  const [isReserveOpen, setIsReserveOpen] = useState(false);
  const [reserveForm, setReserveForm] = useState({ reservedQty: "" });

  /* ✅ ONE adjust modal — matches Raw Materials (in / out / adjustment) */
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    type: "in",
    quantity: "",
    reason: "",
    notes: "",
  });

  /* Scrap is product-specific (measured in kg) — kept as its own modal */
  const [isScrapOpen, setIsScrapOpen] = useState(false);
  const [scrapForm, setScrapForm] = useState({ quantity: "", reason: "", notes: "" });

  /* ---------------- FETCH ---------------- */
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getProductProductions({ limit: 500 });
      setEntries(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load production entries");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStock = useCallback(async () => {
    try {
      setStockLoading(true);
      const res = await getProductStock();
      setStock(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load product stock");
    } finally {
      setStockLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchEntries(), fetchStock()]);
  }, [fetchEntries, fetchStock]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(t);
  }, [success]);

  /* ---------------- HELPERS ---------------- */
  const formatNumber = (v) =>
    Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const formatDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateShort = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  };

  const formatDateLong = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const clearFilter = () => {
    setFromDate("");
    setToDate("");
  };

  /* Product stock has no reorderLevel / criticalLevel — status is qty-based only */
  const getStockStatus = (item) => {
    const qty = Number(item.quantity || 0);
    const reserved = Number(item.reservedQty || 0);
    const free = Math.max(qty - reserved, 0);
    if (qty === 0) return { label: "Out of Stock", type: "danger" };
    if (free === 0) return { label: "No Stock", type: "critical" };
    return { label: "In Stock", type: "success" };
  };

  const getStatusClasses = (status) => {
    if (status.type === "danger") return "bg-red-50 text-red-700 border-red-100";
    if (status.type === "critical") return "bg-rose-100 text-rose-800 border-rose-200";
    if (status.type === "warning") return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  /* ---------------- KPI ---------------- */
  const kpi = useMemo(() => {
    let totalReels = 0;
    let totalKg = 0;
    let totalScrap = 0;
    for (const e of entries) {
      totalReels +=
        Number(e.qty2kg || 0) +
        Number(e.qty5kg || 0) +
        Number(e.qty8kg || 0) +
        Number(e.qty10kg || 0);
      totalKg +=
        Number(e.qty2kg || 0) * 2 +
        Number(e.qty5kg || 0) * 5 +
        Number(e.qty8kg || 0) * 8 +
        Number(e.qty10kg || 0) * 10;
      totalScrap += Number(e.scrapKg || 0);
    }

    let stockTotal = 0;
    let stockReserved = 0;
    let stockScrap = 0;
    for (const s of stock) {
      stockTotal += Number(s.quantity || 0);
      stockReserved += Number(s.reservedQty || 0);
      stockScrap += Number(s.scrapQty || 0);
    }

    return {
      entries: entries.length,
      totalReels,
      totalKg,
      totalScrap,
      stockTotal,
      stockReserved,
      stockScrap,
    };
  }, [entries, stock]);

  /* ---------------- DATE FILTERED ENTRIES ---------------- */
  const filteredEntries = useMemo(() => {
    if (!fromDate && !toDate) return entries;
    return entries.filter((e) => {
      const d = toLocalDateString(e.date);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [entries, fromDate, toDate]);

  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PER_PAGE));
  const paginated = useMemo(
    () => filteredEntries.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filteredEntries, page]
  );

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  /* ---------------- DETAIL ---------------- */
  const selectedEntry = useMemo(
    () => entries.find((e) => e._id === detailId) || null,
    [entries, detailId]
  );

  const openDetail = (entry) => setDetailId(entry._id);
  const closeDetail = () => setDetailId(null);

  /* ---------------- PRODUCTION MODAL HANDLERS ---------------- */
  const openAddModal = () => {
    setEditingEntry(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setForm({
      date: toLocalDateString(entry.date),
      qty2kg: entry.qty2kg ?? "",
      qty5kg: entry.qty5kg ?? "",
      qty8kg: entry.qty8kg ?? "",
      qty10kg: entry.qty10kg ?? "",
      tapeUsedBox: entry.tapeUsedBox ?? "",
      scrapKg: entry.scrapKg ?? "",
      notes: entry.notes || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setForm(emptyForm());
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  /* ---------------- PRODUCTION SUBMIT ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      date: form.date,
      qty2kg: Number(form.qty2kg) || 0,
      qty5kg: Number(form.qty5kg) || 0,
      qty8kg: Number(form.qty8kg) || 0,
      qty10kg: Number(form.qty10kg) || 0,
      tapeUsedBox: Number(form.tapeUsedBox) || 0,
      scrapKg: Number(form.scrapKg) || 0,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (editingEntry) {
        await updateProductProduction(editingEntry._id, payload);
        setSuccess("Production entry updated");
      } else {
        await createProductProduction(payload);
        setSuccess("Production entry added");
      }
      closeModal();
      await refreshAll();
    } catch (err) {
      const body = err?.response?.data ?? err;
      const conflict = body?.data ?? null;

      if (body?.code === "RESERVED_CONFLICT" && conflict) {
        setReservedConflict(conflict);
        setPendingProductionPayload({
          ...payload,
          __isEdit: !!editingEntry,
          __id: editingEntry?._id || null,
        });
        setPendingAdjustPayload(null);
        setIsReservedConfirmOpen(true);
        return;
      }

      setError(body?.message || err?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- PRODUCT STOCK MODAL OPENERS ---------------- */
  const openReserveModal = (item) => {
    setSelectedStock(item);
    setReserveForm({ reservedQty: item.reservedQty ?? 0 });
    setIsReserveOpen(true);
  };

  const openAdjustModal = (item, type = "in") => {
    setSelectedStock(item);
    setAdjustForm({ type, quantity: "", reason: "", notes: "" });
    setIsAdjustOpen(true);
  };

  const openScrapModal = (item) => {
    setSelectedStock(item);
    setScrapForm({ quantity: "", reason: "", notes: "" });
    setIsScrapOpen(true);
  };

  /* ---- RESERVE SUBMIT ---- */
  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (saving || !selectedStock) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateProductStockReserved(selectedStock._id, {
        reservedQty: Number(reserveForm.reservedQty) || 0,
      });
      setSuccess("Reserved quantity updated");
      setIsReserveOpen(false);
      setSelectedStock(null);
      await refreshAll();
    } catch (err) {
      const body = err?.response?.data ?? err;
      setError(body?.message || err?.message || "Failed to update reserved");
    } finally {
      setSaving(false);
    }
  };

  /* ---- ADJUST SUBMIT (Stock In / Dispatch / Set Level) ---- */
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (saving || !selectedStock) return;
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      type: adjustForm.type,
      quantity: Number(adjustForm.quantity) || 0,
      reason: adjustForm.reason.trim() || undefined,
      notes: adjustForm.notes.trim() || undefined,
    };

    try {
      await adjustProductStock(selectedStock._id, payload);
      setSuccess(
        adjustForm.type === "in"
          ? "Stock in recorded"
          : adjustForm.type === "out"
          ? "Dispatch recorded"
          : "Stock level updated"
      );
      setIsAdjustOpen(false);
      setSelectedStock(null);
      setAdjustForm({ type: "in", quantity: "", reason: "", notes: "" });
      await refreshAll();
    } catch (err) {
      const body = err?.response?.data ?? err;
      const conflict = body?.data ?? null;

      if (body?.code === "RESERVED_CONFLICT" && conflict) {
        setReservedConflict(conflict);
        setPendingAdjustPayload({ ...payload, __id: selectedStock._id });
        setPendingProductionPayload(null);
        setIsReservedConfirmOpen(true);
        return;
      }

      setError(body?.message || err?.message || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  /* ---- SCRAP SUBMIT (kg) ---- */
  const handleScrapSubmit = async (e) => {
    e.preventDefault();
    if (saving || !selectedStock) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await recordProductScrap(selectedStock._id, {
        quantity: Number(scrapForm.quantity) || 0,
        reason: scrapForm.reason.trim() || undefined,
        notes: scrapForm.notes.trim() || undefined,
      });
      setSuccess("Scrap recorded");
      setIsScrapOpen(false);
      setSelectedStock(null);
      setScrapForm({ quantity: "", reason: "", notes: "" });
      await refreshAll();
    } catch (err) {
      const body = err?.response?.data ?? err;
      setError(body?.message || err?.message || "Failed to record scrap");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- RESERVED CONFIRM (SHARED) ---------------- */
  const handleReservedConfirm = async () => {
    setSaving(true);
    setError("");
    try {
      if (pendingAdjustPayload) {
        const { __id, ...payload } = pendingAdjustPayload;
        await adjustProductStock(__id, { ...payload, allowReserved: true });
        setSuccess("Dispatch recorded — reserved stock was used");
        setIsAdjustOpen(false);
        setSelectedStock(null);
        setAdjustForm({ type: "in", quantity: "", reason: "", notes: "" });
      } else if (pendingProductionPayload) {
        const { __isEdit, __id, ...payload } = pendingProductionPayload;
        if (__isEdit) {
          await updateProductProduction(__id, { ...payload, allowReserved: true });
          setSuccess("Production entry updated — reserved stock was used");
        } else {
          await createProductProduction({ ...payload, allowReserved: true });
          setSuccess("Production entry added — reserved stock was used");
        }
        closeModal();
      }

      setIsReservedConfirmOpen(false);
      setReservedConflict(null);
      setPendingAdjustPayload(null);
      setPendingProductionPayload(null);
      await refreshAll();
    } catch (err) {
      const body = err?.response?.data ?? err;
      setError(body?.message || err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReservedCancel = () => {
    setIsReservedConfirmOpen(false);
    setReservedConflict(null);
    setPendingAdjustPayload(null);
    setPendingProductionPayload(null);
  };

  /* ---------------- PRODUCTION DELETE ---------------- */
  const handleDelete = async (entry) => {
    if (
      !window.confirm(
        `Delete production entry for ${formatDate(entry.date)}? This cannot be undone.`
      )
    )
      return;
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await deleteProductProduction(entry._id);
      setSuccess("Entry deleted");
      if (detailId === entry._id) setDetailId(null);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete entry");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- LIVE PREVIEW ---------------- */
  const preview = useMemo(() => {
    const qty2 = Number(form.qty2kg) || 0;
    const qty5 = Number(form.qty5kg) || 0;
    const qty8 = Number(form.qty8kg) || 0;
    const qty10 = Number(form.qty10kg) || 0;

    const totalReels = qty2 + qty5 + qty8 + qty10;
    const totalKg = qty2 * 2 + qty5 * 5 + qty8 * 8 + qty10 * 10;

    let steelNeeded = 0;
    const reelsBySize = {};
    const quantities = { "2kg": qty2, "5kg": qty5, "8kg": qty8, "10kg": qty10 };
    for (const [size, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue;
      const comp = REEL_COMPOSITION[size];
      steelNeeded += qty * comp.steelKg;
      reelsBySize[size] = (reelsBySize[size] || 0) + qty;
    }
    steelNeeded = Math.round(steelNeeded * 1000) / 1000;

    return { totalReels, totalKg, steelNeeded, reelsBySize };
  }, [form]);

  /* ---------------- STYLING ---------------- */
  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
  const labelClass =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";

  /* ---------------- RENDER ---------------- */
  return (
    <div className="w-full space-y-5 pb-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-md ring-1 ring-slate-900/10">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
              Product Inventory
            </h1>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Finished goods stock and daily production
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
          >
            <Plus size={15} /> Add Today's Stock
          </button>
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCw
              size={15}
              className={loading || stockLoading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* BANNERS */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Something went wrong</p>
            <p className="mt-0.5 text-xs leading-5 text-red-600">{error}</p>
          </div>
          <button
            onClick={() => setError("")}
            className="rounded-md p-1 text-red-500 hover:bg-red-100"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          <p className="min-w-0 flex-1 text-xs font-semibold">{success}</p>
          <button
            onClick={() => setSuccess("")}
            className="rounded-md p-1 text-emerald-500 hover:bg-emerald-100"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 to-blue-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 text-blue-700">
            <Package size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {formatNumber(kpi.stockTotal)}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Total Stock (all sizes)
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-rose-400 to-red-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-50 to-red-100 text-rose-700">
            <PackageX size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {formatNumber(kpi.stockScrap)}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Scrapped (kg)
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-400 to-violet-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-violet-700">
            <Layers size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {formatNumber(kpi.stockReserved)}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Reserved
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 to-teal-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700">
            <Boxes size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {formatNumber(kpi.totalKg)}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Total Kg Produced
            </p>
          </div>
        </div>
      </div>

      {/* ============ PRODUCTION LOG (unchanged) ============ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Package size={14} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">
                  Daily Production Log
                </p>
                <p className="text-[10px] text-slate-400">
                  Click any row to see that day's full production details
                </p>
              </div>
            </div>
            <div className="mt-3">
              <DateFilter
                from={fromDate}
                to={toDate}
                accent="#0f172a"
                onChange={({ from, to }) => {
                  setFromDate(from);
                  setToDate(to);
                }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              {entries.length === 0 ? <Package size={18} /> : <CalendarRange size={18} />}
            </div>
            <h4 className="mt-3 text-sm font-semibold text-slate-800">
              {entries.length === 0
                ? "No production entries yet"
                : "No entries in this date range"}
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              {entries.length === 0
                ? `Click "Add Today's Stock" to record the first day's output.`
                : "Try a wider range or clear the filter."}
            </p>
            {entries.length > 0 && (fromDate || toDate) && (
              <button
                type="button"
                onClick={clearFilter}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X size={12} /> Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="w-[110px] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Date
                  </th>
                  <th className="w-[60px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    2 kg
                  </th>
                  <th className="w-[60px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    5 kg
                  </th>
                  <th className="w-[60px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    8 kg
                  </th>
                  <th className="w-[60px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    10 kg
                  </th>
                  <th className="w-[95px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Wt (no reel)
                  </th>
                  <th className="w-[100px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Wt (reel)
                  </th>
                  <th className="w-[65px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Scrap
                  </th>
                  <th className="w-[95px] px-2 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Steel
                  </th>
                  <th className="w-[70px] px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((entry) => {
                  const m = getEntryMetrics(entry);

                  return (
                    <tr
                      key={entry._id}
                      onClick={() => openDetail(entry)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(entry);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View production for ${formatDate(entry.date)}`}
                      className="group cursor-pointer transition-colors hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/20"
                    >
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-900">
                          {formatDateShort(entry.date)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {formatDate(entry.date)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold tabular-nums text-slate-800">
                          {formatNumber(entry.qty2kg)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">reel</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold tabular-nums text-slate-800">
                          {formatNumber(entry.qty5kg)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">reel</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold tabular-nums text-slate-800">
                          {formatNumber(entry.qty8kg)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">reel</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold tabular-nums text-slate-800">
                          {formatNumber(entry.qty10kg)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">reel</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold tabular-nums text-slate-700">
                          {formatNumber(m.totalWtNoReel)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">kg</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-semibold tabular-nums text-slate-800">
                          {formatNumber(m.totalWtWithReel)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">kg</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {m.scrap > 0 ? (
                          <>
                            <span className="text-xs font-semibold tabular-nums text-rose-600">
                              {formatNumber(m.scrap)}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-400">kg</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {m.steelConsumed > 0 ? (
                          <>
                            <span className="text-xs font-semibold tabular-nums text-sky-700">
                              {formatNumber(m.steelConsumed)}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-400">kg</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                          <button
                            type="button"
                            title="Edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(entry);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(entry);
                            }}
                            disabled={saving}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          totalRecords={filteredEntries.length}
          perPage={PER_PAGE}
        />
      </section>

      {/* ============ PRODUCT STOCK TABLE (reworked) ============ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Boxes size={14} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">
                Current Product Stock
              </p>
              <p className="text-[10px] text-slate-400">
                Finished goods by reel size — reserve, adjust, or scrap
              </p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">
            {stock.length} sizes
          </span>
        </div>

        {stockLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="w-[200px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Product Name
                  </th>
                  <th className="w-[100px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Total
                  </th>
                  <th className="w-[110px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Reserved
                  </th>
                  <th className="w-[120px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Available
                  </th>
                  <th className="w-[110px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Scrap (kg)
                  </th>
                  <th className="w-[110px] px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Status
                  </th>
                  <th className="w-[130px] px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Last Movement
                  </th>
                  <th className="w-[200px] px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stock.map((item) => {
                  const status = getStockStatus(item);
                  const reserved = Number(item.reservedQty || 0);
                  const free = Math.max(Number(item.quantity || 0) - reserved, 0);
                  const scrapQty = Number(item.scrapQty || 0);

                  const lastMovementAt =
                    item.movementLog && item.movementLog.length > 0
                      ? item.movementLog[item.movementLog.length - 1].at
                      : null;
                  const lastStamp =
                    item.lastReceivedAt ||
                    item.lastScrapAt ||
                    item.lastIssuedAt ||
                    lastMovementAt;

                  return (
                    <tr key={item._id} className="group hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {item.size} reel
                        </p>
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {formatNumber(item.quantity)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">
                          {item.unit}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {reserved > 0 ? (
                          <>
                            <span className="text-sm font-semibold tabular-nums text-indigo-600">
                              {formatNumber(reserved)}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-400">
                              {item.unit}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            free === 0 ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {formatNumber(free)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">
                          {item.unit}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {scrapQty > 0 ? (
                          <>
                            <span className="text-sm font-semibold tabular-nums text-rose-600">
                              {formatNumber(scrapQty)}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-400">kg</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(
                            status
                          )}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className="text-[11px] text-slate-500">
                          {formatDate(lastStamp)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                          <button
                            type="button"
                            title="Reserve / Edit reserved"
                            onClick={() => openReserveModal(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-indigo-500 hover:bg-indigo-50"
                          >
                            <Layers size={14} />
                          </button>
                          <button
                            type="button"
                            title="Stock In"
                            onClick={() => openAdjustModal(item, "in")}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
                          >
                            <ArrowDownToLine size={14} />
                          </button>
                          <button
                            type="button"
                            title="Dispatch (Stock Out)"
                            onClick={() => openAdjustModal(item, "out")}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-amber-600 hover:bg-amber-50"
                          >
                            <ArrowUpFromLine size={14} />
                          </button>
                          <button
                            type="button"
                            title="Record Scrap"
                            onClick={() => openScrapModal(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                          >
                            <PackageX size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============ PRODUCTION DETAIL MODAL (unchanged) ============ */}
      {selectedEntry &&
        (() => {
          const m = getEntryMetrics(selectedEntry);
          const hasAnyReel = m.totalReels > 0;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[3px]"
              onClick={closeDetail}
            >
              <div
                className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-md">
                        <Package size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                          Production Details
                        </p>
                        <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">
                          {formatDateLong(selectedEntry.date)}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatNumber(m.totalReels)} reels ·{" "}
                          {formatNumber(m.totalWtWithReel)} kg total
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeDetail}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={17} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                        <Boxes size={13} />
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
                        Reel Breakdown
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70">
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Size
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Reels
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Steel
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Spool
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Gross
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {m.rows.map((r) => (
                            <tr
                              key={r.size}
                              className={r.qty === 0 ? "opacity-45" : ""}
                            >
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-semibold text-slate-800">
                                  {r.size}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="text-xs font-semibold tabular-nums text-slate-900">
                                  {formatNumber(r.qty)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="text-xs tabular-nums text-slate-700">
                                  {formatNumber(r.steel)}
                                </span>
                                <span className="ml-0.5 text-[9px] text-slate-400">
                                  kg
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="text-xs tabular-nums text-slate-700">
                                  {formatNumber(r.spool)}
                                </span>
                                <span className="ml-0.5 text-[9px] text-slate-400">
                                  kg
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="text-xs font-semibold tabular-nums text-slate-900">
                                  {formatNumber(r.withReel)}
                                </span>
                                <span className="ml-0.5 text-[9px] text-slate-400">
                                  kg
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-50">
                            <td className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                              Total
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">
                              {formatNumber(m.totalReels)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">
                              {formatNumber(m.totalWtNoReel)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">
                              {formatNumber(m.totalWtWithReel - m.totalWtNoReel)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">
                              {formatNumber(m.totalWtWithReel)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {!hasAnyReel && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        No reels recorded for this day.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                        Reels
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                        {formatNumber(m.totalReels)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                        Net weight
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                        {formatNumber(m.totalWtNoReel)}
                        <span className="ml-1 text-[10px] font-medium text-slate-400">
                          kg
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700">
                        Tape
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-amber-800">
                        {formatNumber(m.tape)}
                        <span className="ml-1 text-[10px] font-medium text-amber-600">
                          box
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-rose-700">
                        Scrap
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-rose-800">
                        {formatNumber(m.scrap)}
                        <span className="ml-1 text-[10px] font-medium text-rose-600">
                          kg
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-50/40">
                    <div className="flex items-center gap-2 border-b border-sky-200/70 px-4 py-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-200/60 text-sky-800">
                        <Layers size={13} />
                      </div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-sky-800">
                        Raw Material Consumed
                      </p>
                    </div>
                    <div className="space-y-2 px-4 py-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-sky-900">Steel (in reels)</span>
                        <span className="font-bold tabular-nums text-sky-900">
                          {formatNumber(m.totalWtNoReel)} kg
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sky-900">Scrap</span>
                        <span className="font-bold tabular-nums text-sky-900">
                          {formatNumber(m.scrap)} kg
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between border-t border-sky-200/70 pt-2">
                        <span className="font-semibold text-sky-900">
                          Total steel consumed
                        </span>
                        <span className="font-bold tabular-nums text-sky-900">
                          {formatNumber(m.steelConsumed)} kg
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600">
                      Notes
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">
                        {selectedEntry.notes?.trim()
                          ? selectedEntry.notes
                          : "No notes recorded for this day."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3.5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:w-auto"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const e = selectedEntry;
                      closeDetail();
                      openEditModal(e);
                    }}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md sm:w-auto"
                  >
                    <Pencil size={14} /> Edit Entry
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ============ ADD / EDIT PRODUCTION MODAL (unchanged) ============ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[3px]">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="relative flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-md ring-1 ring-slate-900/10">
                  <Package size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                    {editingEntry ? "Edit Production Entry" : "Add Today's Stock"}
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">
                    {editingEntry
                      ? "Update the reel counts produced for this date."
                      : "Record reel counts produced. Raw materials auto-deduct on save."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-5">
                <div>
                  <label className={labelClass}>
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleFormChange}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                        <Boxes size={13} />
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
                        Reel Production
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">
                      Enter quantity in reels
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="grid grid-cols-[1fr_1.4fr] items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Reel Size
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        No. of Reels
                      </p>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {SIZES.map((size) => {
                        const key = `qty${size}`;
                        const num = Number(size.replace("kg", ""));
                        const sizeColor =
                          num === 2
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : num === 5
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : num === 8
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200";

                        return (
                          <div
                            key={size}
                            className="grid grid-cols-[1fr_1.4fr] items-center gap-3 bg-white px-4 py-3 transition-colors hover:bg-slate-50/60"
                          >
                            <div className="relative">
                              <input
                                type="text"
                                value={size.replace("kg", "")}
                                readOnly
                                className={`h-10 w-full rounded-lg border pl-3 pr-12 text-sm font-bold tabular-nums outline-none ${sizeColor} cursor-default`}
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider">
                                kg
                              </span>
                            </div>

                            <div className="relative">
                              <input
                                type="number"
                                name={key}
                                min="0"
                                step="1"
                                value={form[key]}
                                onChange={handleFormChange}
                                placeholder="0"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-16 text-sm font-semibold tabular-nums text-slate-800 outline-none transition-all placeholder:font-normal placeholder:text-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                reels
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-[1fr_1.4fr] items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Total
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold tabular-nums text-slate-900">
                          {formatNumber(preview.totalReels)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
                          reels
                        </span>
                        {preview.totalReels > 0 && (
                          <span className="ml-auto text-[11px] font-semibold tabular-nums text-slate-500">
                            ≈ {formatNumber(preview.totalKg)} kg
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-100 text-rose-700">
                      <PackageX size={13} />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
                      Consumed / Scrapped
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <label className={labelClass}>Tape Used</label>
                      <div className="relative">
                        <input
                          type="number"
                          name="tapeUsedBox"
                          min="0"
                          step="1"
                          value={form.tapeUsedBox}
                          onChange={handleFormChange}
                          placeholder="0"
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-14 text-sm font-semibold tabular-nums text-slate-800 outline-none transition-all placeholder:font-normal placeholder:text-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          box
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <label className={labelClass}>Scrap</label>
                      <div className="relative">
                        <input
                          type="number"
                          name="scrapKg"
                          min="0"
                          step="0.01"
                          value={form.scrapKg}
                          onChange={handleFormChange}
                          placeholder="0"
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-12 text-sm font-semibold tabular-nums text-slate-800 outline-none transition-all placeholder:font-normal placeholder:text-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          kg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {(preview.totalReels > 0 ||
                  Number(form.tapeUsedBox) > 0 ||
                  Number(form.scrapKg) > 0) && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                        Reels
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                        {formatNumber(preview.totalReels)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                        Weight
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-900">
                        {formatNumber(preview.totalKg)}
                        <span className="ml-1 text-[10px] font-medium text-slate-400">
                          kg
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700">
                        Tape
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-amber-800">
                        {formatNumber(form.tapeUsedBox || 0)}
                        <span className="ml-1 text-[10px] font-medium text-amber-600">
                          box
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-rose-700">
                        Scrap
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-rose-800">
                        {formatNumber(form.scrapKg || 0)}
                        <span className="ml-1 text-[10px] font-medium text-rose-600">
                          kg
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {preview.steelNeeded > 0 && (
                  <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-50/40">
                    <div className="flex items-center gap-2 border-b border-amber-200/70 px-4 py-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-200/60 text-amber-800">
                        <AlertTriangle size={13} />
                      </div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
                        Raw Materials to be Consumed
                      </p>
                    </div>

                    <div className="space-y-2 px-4 py-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-900">Steel Wire</span>
                        <span className="font-bold tabular-nums text-amber-900">
                          {preview.steelNeeded.toLocaleString("en-IN")} kg
                        </span>
                      </div>
                      {Object.entries(preview.reelsBySize).map(([size, qty]) => (
                        <div key={size} className="flex items-center justify-between">
                          <span className="text-amber-900">Reel {size}</span>
                          <span className="font-bold tabular-nums text-amber-900">
                            {qty.toLocaleString("en-IN")} pcs
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-amber-200/70 bg-amber-100/40 px-4 py-2">
                      <p className="text-[10px] font-medium text-amber-700">
                        Stock will be deducted automatically on save.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    rows={2}
                    placeholder="Optional remarks"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-3.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm sm:w-auto"
                >
                  {saving ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {editingEntry ? "Save Changes" : "Add Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ RESERVE MODAL (unchanged) ============ */}
      {isReserveOpen && selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Reserve Stock
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {selectedStock.name} — commit stock to orders
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReserveOpen(false);
                  setSelectedStock(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleReserveSubmit}>
              <div className="space-y-4 px-5 py-5">
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Total
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {formatNumber(selectedStock.quantity)}{" "}
                      <span className="text-[10px] font-medium text-slate-500">
                        {selectedStock.unit}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Reserved
                    </p>
                    <p className="mt-1 text-base font-semibold text-indigo-600">
                      {formatNumber(selectedStock.reservedQty || 0)}{" "}
                      <span className="text-[10px] font-medium text-slate-500">
                        {selectedStock.unit}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Available
                    </p>
                    <p className="mt-1 text-base font-semibold text-emerald-700">
                      {formatNumber(
                        Math.max(
                          Number(selectedStock.quantity || 0) -
                            Number(selectedStock.reservedQty || 0),
                          0
                        )
                      )}{" "}
                      <span className="text-[10px] font-medium text-slate-500">
                        {selectedStock.unit}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Reserved Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    max={selectedStock.quantity}
                    value={reserveForm.reservedQty}
                    onChange={(e) =>
                      setReserveForm((f) => ({ ...f, reservedQty: e.target.value }))
                    }
                    required
                    className={inputClass}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Cannot exceed total stock. Set to 0 to release all.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsReserveOpen(false);
                    setSelectedStock(null);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                >
                  <Save size={14} /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ ADJUST STOCK MODAL (NEW — replaces Dispatch + Stock In) ============ */}
      {isAdjustOpen && selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Adjust Stock
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {selectedStock.name}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setIsAdjustOpen(false);
                  setSelectedStock(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-60"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit}>
              <div className="space-y-4 px-5 py-5">
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Total
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatNumber(selectedStock.quantity)}{" "}
                      <span className="text-[10px] font-medium text-slate-500">
                        {selectedStock.unit}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Reserved
                    </p>
                    <p className="mt-1 text-sm font-semibold text-indigo-600">
                      {formatNumber(selectedStock.reservedQty || 0)}{" "}
                      <span className="text-[10px] font-medium text-slate-500">
                        {selectedStock.unit}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Free
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">
                      {formatNumber(
                        Math.max(
                          Number(selectedStock.quantity || 0) -
                            Number(selectedStock.reservedQty || 0),
                          0
                        )
                      )}{" "}
                      <span className="text-[10px] font-medium text-slate-500">
                        {selectedStock.unit}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) =>
                      setAdjustForm((f) => ({ ...f, type: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="in">Stock In (add)</option>
                    <option value="out">Dispatch (remove)</option>
                    <option value="adjustment">Set Level (override)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    {adjustForm.type === "adjustment"
                      ? "New Stock Level"
                      : "Quantity"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      max={
                        adjustForm.type === "out"
                          ? selectedStock.quantity
                          : undefined
                      }
                      value={adjustForm.quantity}
                      onChange={(e) =>
                        setAdjustForm((f) => ({ ...f, quantity: e.target.value }))
                      }
                      required
                      placeholder="0"
                      className={inputClass + " pr-14"}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                      {selectedStock.unit}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Reason</label>
                  <input
                    type="text"
                    value={adjustForm.reason}
                    onChange={(e) =>
                      setAdjustForm((f) => ({ ...f, reason: e.target.value }))
                    }
                    placeholder="e.g. Order #123, Found extra, Cycle count"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={adjustForm.notes}
                    onChange={(e) =>
                      setAdjustForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    placeholder="Optional"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustOpen(false);
                    setSelectedStock(null);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                >
                  {saving ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ SCRAP MODAL (kept — product scrap is measured in kg) ============ */}
      {isScrapOpen && selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Record Scrap
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {selectedStock.name} — mark as scrap (kg)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScrapOpen(false);
                  setSelectedStock(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleScrapSubmit}>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Current Stock
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatNumber(selectedStock.quantity)}{" "}
                    <span className="text-xs font-medium text-slate-500">
                      {selectedStock.unit}
                    </span>
                  </p>
                </div>

                <div>
                  <label className={labelClass}>
                    Quantity Scrapped (kg) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={scrapForm.quantity}
                      onChange={(e) =>
                        setScrapForm((f) => ({ ...f, quantity: e.target.value }))
                      }
                      required
                      placeholder="0"
                      className={inputClass + " pr-14"}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                      kg
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Will be converted to reels based on {selectedStock.size} weight
                    and deducted from stock.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Reason</label>
                  <input
                    type="text"
                    value={scrapForm.reason}
                    onChange={(e) =>
                      setScrapForm((f) => ({ ...f, reason: e.target.value }))
                    }
                    placeholder="e.g. Damaged, Production defect"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={scrapForm.notes}
                    onChange={(e) =>
                      setScrapForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    placeholder="Optional"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsScrapOpen(false);
                    setSelectedStock(null);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 sm:w-auto"
                >
                  <PackageX size={14} /> Record Scrap
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ RESERVED CONFIRM MODAL (SHARED) ============ */}
      {isReservedConfirmOpen && reservedConflict && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50/60 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Reserved stock will be used
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  {pendingAdjustPayload
                    ? "This dispatch exceeds the available (free) stock."
                    : "This production exceeds the available (free) stock."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleReservedCancel}
                disabled={saving}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-60"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-3 px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {reservedConflict.name}
              </p>
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Free
                  </p>
                  <p className="mt-1 text-base font-semibold text-emerald-700">
                    {formatNumber(reservedConflict.freeQty)}{" "}
                    <span className="text-[10px] font-medium text-slate-500">
                      {reservedConflict.unit}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Reserved
                  </p>
                  <p className="mt-1 text-base font-semibold text-indigo-600">
                    {formatNumber(reservedConflict.reservedQty)}{" "}
                    <span className="text-[10px] font-medium text-slate-500">
                      {reservedConflict.unit}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Requested
                  </p>
                  <p className="mt-1 text-base font-semibold text-amber-700">
                    {formatNumber(reservedConflict.requested)}{" "}
                    <span className="text-[10px] font-medium text-slate-500">
                      {reservedConflict.unit}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">
                    {formatNumber(reservedConflict.usedFromReserved)}{" "}
                    {reservedConflict.unit}
                  </span>{" "}
                  will be taken from stock reserved for other orders. This will
                  reduce the reserved quantity.
                </p>
              </div>

              <p className="text-xs text-slate-600">
                Do you grant permission to proceed?
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleReservedCancel}
                disabled={saving}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={handleReservedConfirm}
                disabled={saving}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Yes, Use Reserved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;