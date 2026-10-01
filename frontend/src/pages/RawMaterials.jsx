import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import {
  Warehouse,
  Package,
  AlertTriangle,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  RefreshCw,
  Save,
  Factory,
  ShoppingCart,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Layers,
  Boxes,
  CircleEqual,DatabasePlus, 
  Pencil,Eye
} from "lucide-react";

import {
  getRawStock,
  createRawStock,
  updateRawStock,
  adjustRawStock,
  getRawPurchases,
  createRawPurchase,
  updateRawPurchase,
  receiveRawPurchase,
  cancelRawPurchase,
  getContacts,
} from "../api/api";

import DateFilter, { isWithinRange } from "../components/DateFilter";

const CATEGORIES = ["Steel", "Tape", "Reel"];
const UNIT_BY_CATEGORY = { Steel: "Kg", Tape: "Box", Reel: "Piece" };
const PER_PAGE = 10;

function DetailItem({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function RawMaterials() {
  /* ---------------- STATE ---------------- */
  const [stock, setStock] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [contacts, setContacts] = useState([]);

  const [stockLoading, setStockLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [purchaseFilter, setPurchaseFilter] = useState("All");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchasePage, setPurchasePage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* ---------------- MODAL STATE ---------------- */
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [reserveForm, setReserveForm] = useState({ reservedQty: "", });
  const [saving, setSaving] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);

  const [isReservedConfirmOpen, setIsReservedConfirmOpen] = useState(false);
  const [reservedConflict, setReservedConflict] = useState(null);
  const [pendingAdjustPayload, setPendingAdjustPayload] = useState(null);

        useEffect(() => {
        if (!viewingPurchase) return;
        const onKey = (e) => e.key === "Escape" && setViewingPurchase(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        }, [viewingPurchase]); 

  /* Material form (add new reel size / material) */
  const [materialForm, setMaterialForm] = useState({
    category: "Reel",
    name: "",
    sizeKg: "",
    reorderLevel: "",
    criticalLevel: "",
    notes: "",
  });

  const [purchaseForm, setPurchaseForm] = useState({
  material: "",
  supplier: "",
  supplierName: "",
  supplierPhone: "",
  quantity: "",
  unitPrice: "",
  orderedAt: "",
  expectedAt: "",
  notes: "",
});

  /* Adjust form */
  const [adjustForm, setAdjustForm] = useState({
    type: "in",
    quantity: "",
    reason: "",
    notes: "",
  });

  /* ---------------- FETCH ---------------- */
  const fetchStock = useCallback(async () => {
    try {
      setStockLoading(true);
      const res = await getRawStock();
      setStock(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load raw stock");
    } finally {
      setStockLoading(false);
    }
  }, []);

    const fetchPurchases = useCallback(async () => {
        try {
        setPurchasesLoading(true);
        const res = await getRawPurchases({ limit: 200 });
        setPurchases(res.data?.data || []);
        } catch (err) {
        setError(err.response?.data?.message || "Failed to load purchases");
        } finally {
        setPurchasesLoading(false);
        }
    }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await getContacts({ limit: 200 });
      setContacts(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load contacts", err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStock(), fetchPurchases()]);
  }, [fetchStock, fetchPurchases]);

    useEffect(() => {
    refreshAll();
    fetchContacts();
  }, [refreshAll, fetchContacts]);

  /* ---------------- HELPERS ---------------- */
  const formatNumber = (v) =>
    Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

    const formatRelative = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    const secs = Math.floor((Date.now() - dt.getTime()) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  const formatShortDate = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(v) || 0);

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

  const isOverdue = (expectedAt, status) => {
    if (status !== "Pending" || !expectedAt) return false;
    const d = new Date(expectedAt);
    if (isNaN(d.getTime())) return false;
    // Compare end of today so a purchase expected today isn't flagged.
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return d < endOfToday;
  };

  const getStockStatus = (item) => {
    const qty = Number(item.quantity || 0);
    const reserved = Number(item.reservedQty || 0);
    const free = Math.max(qty - reserved, 0);
    const r = Number(item.reorderLevel || 0);
    const c = Number(item.criticalLevel || 0);

    if (qty === 0) return { label: "Out of Stock", type: "danger" };
    if (free === 0) return { label: "No Stock", type: "critical" };
    if (c > 0 && free <= c) return { label: "Critical", type: "critical" };
    if (r > 0 && free <= r) return { label: "Low", type: "warning" };
    return { label: "In Stock", type: "success" };
  };

  const getStatusClasses = (status) => {
    if (status.type === "danger") return "bg-red-50 text-red-700 border-red-100";
    if (status.type === "critical") return "bg-rose-100 text-rose-800 border-rose-200";
    if (status.type === "warning") return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  const getPurchaseStatusBadge = (status) => {
    if (status === "Received")
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "Cancelled")
      return "bg-slate-100 text-slate-600 border-slate-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  const getMaterial = (id) => stock.find((s) => s._id === id);

  /* ---------------- GROUPED STOCK ---------------- */
  const stockByCategory = useMemo(() => {
    const map = { Steel: [], Tape: [], Reel: [] };
    for (const item of stock) {
      if (map[item.category]) map[item.category].push(item);
    }
    // Reels: sort by sizeKg ascending
    map.Reel.sort((a, b) => Number(a.sizeKg || 0) - Number(b.sizeKg || 0));
    return map;
  }, [stock]);

  /* ---------------- FILTERED PURCHASES ---------------- */
    const filteredPurchases = useMemo(() => {
    const q = purchaseSearch.trim().toLowerCase();
    return purchases.filter((p) => {
      if (purchaseFilter !== "All" && p.status !== purchaseFilter) return false;
      if (!isWithinRange(p.orderedAt, dateFrom, dateTo)) return false;
      if (!q) return true;
      const mat = p.material?.name || "";
      const sup = p.supplier?.name || p.supplier?.company || "";
      return (
        mat.toLowerCase().includes(q) ||
        sup.toLowerCase().includes(q) ||
        (p.notes || "").toLowerCase().includes(q)
      );
    });
  }, [purchases, purchaseFilter, purchaseSearch, dateFrom, dateTo]);

  const purchaseTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / PER_PAGE));
  const paginatedPurchases = useMemo(
    () =>
      filteredPurchases.slice(
        (purchasePage - 1) * PER_PAGE,
        purchasePage * PER_PAGE
      ),
    [filteredPurchases, purchasePage]
  );

    useEffect(() => {
    setPurchasePage(1);
  }, [purchaseFilter, purchaseSearch, dateFrom, dateTo]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(t);
  }, [success]);

  /* ---------------- INCOMING (on-order) ---------------- */
  // Map: materialId → { qty, earliestExpected }
  const incomingByMaterial = useMemo(() => {
    const map = {};
    for (const p of purchases) {
      if (p.status !== "Pending") continue;
      const id = p.material?._id || p.material;
      if (!id) continue;
      if (!map[id]) map[id] = { qty: 0, earliestExpected: null };
      map[id].qty += Number(p.quantity || 0);
      if (p.expectedAt) {
        const d = new Date(p.expectedAt);
        if (!isNaN(d.getTime())) {
          if (!map[id].earliestExpected || d < map[id].earliestExpected) {
            map[id].earliestExpected = d;
          }
        }
      }
    }
    return map;
  }, [purchases]);

  /* ---------------- KPI ---------------- */
    const kpi = useMemo(() => {
    const lowStock = stock.filter((s) =>
      ["Low", "Critical", "Out of Stock", "Fully Allocated"].includes(
        getStockStatus(s).label
      )
    ).length;

    const pending = purchases.filter((p) => p.status === "Pending").length;
    const received = purchases.filter((p) => p.status === "Received").length;

    return { total: stock.length, lowStock, pending, received };
  }, [stock, purchases]);

  /* ---------------- HANDLERS ---------------- */
  const openMaterialModal = () => {
    setMaterialForm({
      category: "Reel",
      name: "",
      sizeKg: "",
      reorderLevel: "",
      criticalLevel: "",
      notes: "",
    });
    setIsMaterialModalOpen(true);
  };

  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        category: materialForm.category,
        name: materialForm.name.trim(),
        unit: UNIT_BY_CATEGORY[materialForm.category],
        reorderLevel: Number(materialForm.reorderLevel) || 0,
        criticalLevel: Number(materialForm.criticalLevel) || 0,
        notes: materialForm.notes.trim() || undefined,
      };
      if (materialForm.category === "Reel") {
        payload.sizeKg = Number(materialForm.sizeKg);
        if (!payload.name) payload.name = `Reel ${payload.sizeKg}kg`;
      }
      await createRawStock(payload);
      setSuccess("Material added");
      setIsMaterialModalOpen(false);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add material");
    } finally {
      setSaving(false);
    }
  };

  const openAdjustModal = (item, type = "in") => {
    setSelectedStock(item);
    setAdjustForm({ type, quantity: "", reason: "", notes: "" });
    setIsAdjustModalOpen(true);
  };

  const openReserveModal = (item) => {
    setSelectedStock(item);
    setReserveForm({ reservedQty: item.reservedQty ?? 0 });
    setIsReserveModalOpen(true);
  };

   const handleReserveSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        if (!selectedStock) return;
        setSaving(true);
        setError("");
        setSuccess("");
        try {
        await updateRawStock(selectedStock._id, {
            reservedQty: Number(reserveForm.reservedQty) || 0,
        });
        setSuccess("Reserved quantity updated");
        setIsReserveModalOpen(false);
        await refreshAll();
        } catch (err) {
        setError(err.response?.data?.message || "Failed to update reserved quantity");
        } finally {
        setSaving(false);
        }
    };

  const handleAdjustSubmit = async (e) => {
  e.preventDefault();
  if (saving) return;
  if (!selectedStock) return;
  setSaving(true);
  setError("");
  setSuccess("");
  try {
    const payload = {
      type: adjustForm.type,
      quantity: Number(adjustForm.quantity) || 0,
      reason: adjustForm.reason.trim() || undefined,
      notes: adjustForm.notes.trim() || undefined,
    };

    await adjustRawStock(selectedStock._id, payload);
    setSuccess("Stock adjusted");
    setIsAdjustModalOpen(false);
    await refreshAll();
  } catch (err) {
  const body = err?.response?.data ?? err;
  const conflict = body?.data ?? null;

  if (body?.code === "RESERVED_CONFLICT" && conflict) {
    setReservedConflict(conflict);
    setPendingAdjustPayload({
      type: adjustForm.type,
      quantity: Number(adjustForm.quantity) || 0,
      reason: adjustForm.reason.trim() || undefined,
      notes: adjustForm.notes.trim() || undefined,
    });
    setIsReservedConfirmOpen(true);
    return;
  }

  setError(body?.message || err?.message || "Failed to adjust stock");
} finally {
    setSaving(false);
  }
};

/* ✅ NEW — user granted permission */
const handleReservedConfirm = async () => {
  if (!selectedStock || !pendingAdjustPayload) return;
  setSaving(true);
  setError("");
  try {
    await adjustRawStock(selectedStock._id, {
      ...pendingAdjustPayload,
      allowReserved: true,
    });
    setSuccess("Stock adjusted — reserved stock was used");
    setIsReservedConfirmOpen(false);
    setIsAdjustModalOpen(false);
    setReservedConflict(null);
    setPendingAdjustPayload(null);
    await refreshAll();
  } catch (err) {
    setError(err.response?.data?.message || "Failed to adjust stock");
  } finally {
    setSaving(false);
  }
};

/* ❌ NEW — user denied permission */
const handleReservedCancel = () => {
  setIsReservedConfirmOpen(false);
  setReservedConflict(null);
  setPendingAdjustPayload(null);
};


  const openPurchaseModal = () => {
  setEditingPurchase(null);
  setPurchaseForm({
    material: "",
    supplier: "",
    supplierName: "",
    supplierPhone: "",
    quantity: "",
    unitPrice: "",
    orderedAt: new Date().toISOString().slice(0, 10),
    expectedAt: "",
    notes: "",
  });
  setIsPurchaseModalOpen(true);
};

  const openEditPurchaseModal = (p) => {
  setEditingPurchase(p);
  setPurchaseForm({
    material: p.material?._id || p.material || "",
    supplier: p.supplier?._id || p.supplier || "",
    supplierName: p.supplierName || "",
    supplierPhone: p.supplierPhone || "",
    quantity: p.quantity ?? "",
    unitPrice: p.unitPrice ?? "",
    orderedAt: p.orderedAt ? new Date(p.orderedAt).toISOString().slice(0, 10) : "",
    expectedAt: p.expectedAt ? new Date(p.expectedAt).toISOString().slice(0, 10) : "",
    notes: p.notes || "",
  });
  setIsPurchaseModalOpen(true);
};

    const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editingPurchase) {
        // Edit: material and unit are locked, only send editable fields.
        await updateRawPurchase(editingPurchase._id, {
          quantity: Number(purchaseForm.quantity) || 0,
          unitPrice: Number(purchaseForm.unitPrice) || 0,
          supplier: purchaseForm.supplier || null,
          supplierName: purchaseForm.supplierName.trim() || null,
          supplierPhone: purchaseForm.supplierPhone.trim() || null,
          orderedAt: purchaseForm.orderedAt || undefined,
          expectedAt: purchaseForm.expectedAt || null,
          notes: purchaseForm.notes.trim() || undefined,
        });
        setSuccess("Purchase updated");
      } else {
        await createRawPurchase({
          material: purchaseForm.material,
          supplier: purchaseForm.supplier || null,
          supplierName: purchaseForm.supplierName.trim() || null,
          supplierPhone: purchaseForm.supplierPhone.trim() || null,
          quantity: Number(purchaseForm.quantity) || 0,
          unitPrice: Number(purchaseForm.unitPrice) || 0,
          orderedAt: purchaseForm.orderedAt || undefined,
          expectedAt: purchaseForm.expectedAt || undefined,
          notes: purchaseForm.notes.trim() || undefined,
        }); 
        setSuccess("Purchase order created (pending receipt)");
      }
      setIsPurchaseModalOpen(false);
      setEditingPurchase(null);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save purchase");
    } finally {
      setSaving(false);
    }
  };

    const handleReceive = async (purchase) => {
    if (saving) return;
    if (
      !window.confirm(
        `Mark "${purchase.material?.name}" (${formatNumber(purchase.quantity)} ${purchase.unit}) as received? Stock will increase.`
      )
    )
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await receiveRawPurchase(purchase._id);
      setSuccess("Purchase received — stock updated");
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to receive purchase");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPurchase = async (purchase) => {
    if (saving) return;
    if (!window.confirm(`Cancel this purchase order?`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await cancelRawPurchase(purchase._id);
      setSuccess("Purchase cancelled");
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel purchase");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- STYLING ---------------- */
  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
  const labelClass =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";

    const renderStockRow = (item) => {
    const status = getStockStatus(item);
    const incoming = incomingByMaterial[item._id];
    const lastMovement =
      item.movementLog && item.movementLog.length > 0
        ? item.movementLog[item.movementLog.length - 1].at
        : null;
    const lastReceived = item.lastReceivedAt || null;

    const reserved = Number(item.reservedQty || 0);
    const free = Math.max(Number(item.quantity || 0) - reserved, 0);

    return (
      <tr key={item._id} className="group hover:bg-slate-50/70">
        <td className="px-4 py-3">
            <p className="text-xs font-semibold text-slate-900">{item.name}</p>
            {item.category === "Reel" && item.sizeKg && (
                <p className="mt-0.5 text-[10px] text-slate-400">
                {item.sizeKg} kg reel
                </p>
            )}
        </td>

        <td className="px-3 py-3 text-right whitespace-nowrap">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {formatNumber(item.quantity)}
          </span>
          <span className="ml-1 text-[10px] text-slate-400">{item.unit}</span>
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
          <span className="ml-1 text-[10px] text-slate-400">{item.unit}</span>
        </td>

        <td className="px-3 py-3 text-right whitespace-nowrap">
        {incoming && incoming.qty > 0 ? (
          <>
            <span className="text-xs font-semibold tabular-nums text-sky-700">
              +{formatNumber(incoming.qty)}
            </span>
            {incoming.earliestExpected && (
              <span className="ml-1 text-[10px] text-slate-600">
                · {formatShortDate(incoming.earliestExpected)}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-600">-- --</span>
        )}
      </td>

        <td className="px-3 py-3 text-right whitespace-nowrap">
          <span className="text-xs tabular-nums text-slate-500">
            {formatNumber(item.reorderLevel)}
          </span>
        </td>

        <td className="px-3 py-3 text-center">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(status)}`}
          >
            {status.label}
          </span>
        </td>

        <td className="px-3 py-3 text-right whitespace-nowrap">
          <span className="text-[11px] text-slate-500">
            {formatDate(lastReceived || lastMovement)}
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
              title="Stock Out"
              onClick={() => openAdjustModal(item, "out")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-amber-600 hover:bg-amber-50"
            >
              <ArrowUpFromLine size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderStockSection = (category, items) => {
    const Icon = category === "Steel" ? Factory : category === "Tape" ? CircleEqual : DatabasePlus;
    const tint =
      category === "Steel"
        ? "from-sky-50/60"
        : category === "Tape"
        ? "from-violet-50/60"
        : "from-amber-50/60";
    const iconBg =
      category === "Steel"
        ? "from-sky-100 to-sky-200 text-sky-700"
        : category === "Tape"
        ? "from-violet-100 to-violet-200 text-violet-700"
        : "from-amber-100 to-amber-200 text-amber-700";

    return (
      <div key={category} className="border-b border-slate-100 last:border-b-0">
        <div
          className={`flex items-center justify-between border-b border-slate-100 bg-gradient-to-r ${tint} to-transparent px-4 py-2.5`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${iconBg}`}
            >
              <Icon size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-tight text-slate-900">
                {category === "Reel" ? "Empty Reels" : category}
              </h3>
              <p className="text-[10px] text-slate-500">
                {items.length} {items.length === 1 ? "item" : "items"}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            Unit: {UNIT_BY_CATEGORY[category]}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-400">
              No {category.toLowerCase()} stock records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left">
              <thead>
                <tr className="border-b border-slate-100">
                    <th className="w-[220px] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {category === "Reel" ? "Size" : "Material"}
                    </th>
                    <th className="w-[100px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Total
                    </th>
                    <th className="w-[100px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Reserved
                    </th>
                    <th className="w-[110px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Available
                    </th>
                    <th className="w-[120px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Incoming
                    </th>
                    <th className="w-[90px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Reorder
                    </th>
                    <th className="w-[110px] px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Status
                    </th>
                    <th className="w-[100px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Last Received
                    </th>
                    <th className="w-[120px] px-4 py-2.5"></th>
                </tr>
                </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(renderStockRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderPurchaseRow = (p) => {
    return (
        <tr
        key={p._id}
        onClick={() => setViewingPurchase(p)}
        onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setViewingPurchase(p);
            }
        }}
        tabIndex={0}
        role="button"
        aria-label={`View purchase details for ${p.material?.name || "material"}`}
        className="cursor-pointer transition-colors hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none"
        >
        <td className="px-4 py-3 text-xs text-slate-700">
            {formatDate(p.orderedAt)}
        </td>
        <td className="px-4 py-3">
            <p className="text-xs font-semibold text-slate-900">
            {p.material?.name || "—"}
            </p>
            {p.material?.category === "Reel" && p.material?.sizeKg && (
            <p className="mt-0.5 text-[10px] text-slate-400">
                {p.material.sizeKg} kg each
            </p>
            )}
        </td>
        <td className="px-4 py-3 text-right">
            <span className="text-xs font-semibold tabular-nums text-slate-900">
            {formatNumber(p.quantity)}
            </span>
            <span className="ml-1 text-[10px] text-slate-400">{p.unit}</span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-600">
          {p.supplier?.company || p.supplier?.name || p.supplierName || "—"}
        </td>
        <td className="px-4 py-3">
            <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPurchaseStatusBadge(p.status)}`}
            >
            {p.status === "Received" && <CheckCircle2 size={10} />}
            {p.status === "Pending" && <Clock size={10} />}
            {p.status === "Cancelled" && <XCircle size={10} />}
            {p.status}
            </span>
        </td>
        <td className="px-4 py-3 text-xs">
            {p.status === "Received" && p.receivedAt && (
            <span className="text-slate-500">{formatDate(p.receivedAt)}</span>
            )}

            {p.status === "Pending" && p.expectedAt && (
            <span
                className={
                isOverdue(p.expectedAt, p.status)
                    ? "font-medium text-red-600"
                    : "text-sky-600"
                }
                title={isOverdue(p.expectedAt, p.status) ? "Past expected date" : "Expected"}
            >
                by {formatDate(p.expectedAt)}
            </span>
            )}

            {p.status === "Pending" && !p.expectedAt && (
            <span className="text-slate-400">—</span>
            )}

            {p.status === "Cancelled" && <span className="text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1">
            {p.status === "Pending" && (
                <>
                <button
                    type="button"
                    onClick={() => openEditPurchaseModal(p)}
                    title="Edit"
                    aria-label="Edit purchase"
                    disabled={saving}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Pencil size={13} />
                </button>
                <button
                    type="button"
                    onClick={() => handleReceive(p)}
                    disabled={saving}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Truck size={11} /> Receive
                </button>
                <button
                    type="button"
                    onClick={() => handleCancelPurchase(p)}
                    title="Cancel"
                    aria-label="Cancel purchase"
                    disabled={saving}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <X size={13} />
                </button>
                </>
            )}
            </div>
        </td>
        </tr>
    );
  };

  /* ---------------- RENDER ---------------- */
  return (
    <div className="w-full space-y-5 pb-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-md ring-1 ring-slate-900/10">
            <Warehouse size={20} />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
              Raw Materials
            </h1>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Steel, tape, and empty reels — stock levels & purchase orders
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPurchaseModal}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
          >
            <ShoppingCart size={15} /> Add Purchase
          </button>
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCw
              size={15}
              className={stockLoading || purchasesLoading ? "animate-spin" : ""}
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
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-slate-400 to-slate-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700">
            <Package size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {kpi.total}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Materials Tracked
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-700">
            <AlertTriangle size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {kpi.lowStock}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Low Stock
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 to-blue-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 text-blue-700">
            <Clock size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {kpi.pending}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Pending Purchases
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 to-teal-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700">
            <CheckCircle2 size={18} />
          </div>
          <div className="mt-4">
            <p className="text-[26px] font-semibold tracking-tight text-slate-900">
              {kpi.received}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Received Purchases
            </p>
          </div>
        </div>
      </div>

      {/* STOCK SECTION */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Boxes size={14} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">
                Current Raw Stock
              </p>
              <p className="text-[10px] text-slate-400">
                Live stock levels by category
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openMaterialModal}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
            <Plus size={12} /> Add Material
          </button>
        </div>

        {stockLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {CATEGORIES.map((cat) => renderStockSection(cat, stockByCategory[cat]))}
          </>
        )}
      </section>

      {/* PURCHASES SECTION */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ShoppingCart size={14} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">
                Purchase Orders
              </p>
              <p className="text-[10px] text-slate-400">
                Mark as received to increase stock
              </p>
            </div>
          </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search material or supplier..."
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0f172a] focus:bg-white focus:ring-2 focus:ring-slate-900/10 sm:w-64"
              />
            </div>
            <select
              value={purchaseFilter}
              onChange={(e) => setPurchaseFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none focus:border-[#0f172a]"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Received">Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <DateFilter
              from={dateFrom}
              to={dateTo}
              onChange={({ from, to }) => {
                setDateFrom(from);
                setDateTo(to);
              }}
              accent="#0f172a"
            />
          </div>
        </div>

        {purchasesLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <ShoppingCart size={18} />
            </div>
            <h4 className="mt-3 text-sm font-semibold text-slate-800">
              No purchase orders
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              {purchaseSearch || purchaseFilter !== "All"
                ? "No purchases match the current filters."
                : "Add your first purchase order to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Material
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Received/Expected
                  </th>
                  <th className="w-[180px] px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPurchases.map(renderPurchaseRow)}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={purchasePage}
          totalPages={purchaseTotalPages}
          onPage={setPurchasePage}
          totalRecords={filteredPurchases.length}
          perPage={PER_PAGE}
        />
      </section>

      {/* ============ ADD MATERIAL MODAL ============ */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Add Material
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Create a new raw material or reel size
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleMaterialSubmit}>
              <div className="space-y-4 px-5 py-5">
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={materialForm.category}
                    onChange={(e) =>
                      setMaterialForm((f) => ({
                        ...f,
                        category: e.target.value,
                        name: "",
                        sizeKg: "",
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="Reel">Reel (empty spool)</option>
                    <option value="Steel">Steel</option>
                    <option value="Tape">Tape</option>
                  </select>
                </div>

                {materialForm.category === "Reel" && (
                <div>
                    <label className={labelClass}>
                    Size (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={materialForm.sizeKg}
                    onChange={(e) =>
                        setMaterialForm((f) => ({ ...f, sizeKg: e.target.value }))
                    }
                    placeholder="e.g. 8"
                    required
                    className={inputClass}
                    />
                </div>
                )}

                <div>
                <label className={labelClass}>
                    Name{materialForm.category !== "Reel" && <span className="text-red-500"> *</span>}
                </label>
                <input
                    type="text"
                    value={materialForm.name}
                    onChange={(e) =>
                    setMaterialForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder={
                    materialForm.category === "Reel"
                        ? `e.g. Heavy Duty Reel ${materialForm.sizeKg || ""}kg`
                        : materialForm.category === "Steel"
                        ? "Steel"
                        : "Tape"
                    }
                    required={materialForm.category !== "Reel"}
                    className={inputClass}
                />
                {materialForm.category === "Reel" && (
                    <p className="mt-1 text-[10px] text-slate-400">
                    Optional. If left empty, defaults to "Reel {materialForm.sizeKg || "X"}kg".
                    </p>
                )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Reorder Level</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={materialForm.reorderLevel}
                      onChange={(e) =>
                        setMaterialForm((f) => ({
                          ...f,
                          reorderLevel: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Critical Level</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={materialForm.criticalLevel}
                      onChange={(e) =>
                        setMaterialForm((f) => ({
                          ...f,
                          criticalLevel: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={materialForm.notes}
                    onChange={(e) =>
                      setMaterialForm((f) => ({ ...f, notes: e.target.value }))
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
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                    <Save size={14} /> Add Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ ADD PURCHASE MODAL ============ */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingPurchase ? "Edit Purchase Order" : "Add Purchase Order"}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {editingPurchase
                    ? "Update quantity, price, expected date or supplier"
                    : "Stock increases when marked as received"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit}>
              <div className="space-y-4 px-5 py-5">
                <div>
                  <label className={labelClass}>
                    Material <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={purchaseForm.material}
                    onChange={(e) =>
                      setPurchaseForm((f) => ({ ...f, material: e.target.value }))
                    }
                    required
                    className={inputClass}
                  >
                    <option value="">Select material</option>
                    {stock.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} — {s.unit}
                      </option>
                    ))}
                  </select>
                </div>

               <div>
                <label className={labelClass}>Supplier (from contacts)</label>
                <select
                  value={purchaseForm.supplier}
                  onChange={(e) => {
                    const id = e.target.value;
                    const c = contacts.find((x) => x._id === id);
                    // When a contact is picked, auto-fill the text fields too (nice UX)
                    setPurchaseForm((f) => ({
                      ...f,
                      supplier: id,
                      supplierName: c ? (c.company ? `${c.company} — ${c.name}` : c.name) : f.supplierName,
                      supplierPhone: c?.phone || f.supplierPhone,
                    }));
                  }}
                  className={inputClass}
                >
                  <option value="">None / Type manually below</option>
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.company ? `${c.company} — ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Optional — pick from saved contacts, or type a new one below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Supplier Name</label>
                  <input
                    type="text"
                    value={purchaseForm.supplierName}
                    onChange={(e) =>
                      setPurchaseForm((f) => ({ ...f, supplierName: e.target.value }))
                    }
                    placeholder="e.g. ABC Traders"
                    maxLength={100}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Supplier Phone No.</label>
                  <input
                    type="tel"
                    value={purchaseForm.supplierPhone}
                    onChange={(e) =>
                      setPurchaseForm((f) => ({ ...f, supplierPhone: e.target.value }))
                    }
                    placeholder="e.g. +91 98765 43210"
                    maxLength={20}
                    className={inputClass}
                  />
                </div>
              </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={purchaseForm.quantity}
                      onChange={(e) =>
                        setPurchaseForm((f) => ({
                          ...f,
                          quantity: e.target.value,
                        }))
                      }
                      placeholder="0"
                      required
                      className={inputClass}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      In {getMaterial(purchaseForm.material)?.unit || "material's unit"}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Unit Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseForm.unitPrice}
                      onChange={(e) =>
                        setPurchaseForm((f) => ({
                          ...f,
                          unitPrice: e.target.value,
                        }))
                      }
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Ordered On</label>
                    <input
                      type="date"
                      value={purchaseForm.orderedAt}
                      onChange={(e) =>
                        setPurchaseForm((f) => ({
                          ...f,
                          orderedAt: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Expected On</label>
                    <input
                      type="date"
                      value={purchaseForm.expectedAt}
                      onChange={(e) =>
                        setPurchaseForm((f) => ({
                          ...f,
                          expectedAt: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={purchaseForm.notes}
                    onChange={(e) =>
                      setPurchaseForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    placeholder="PO number, remarks, etc."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Save size={14} />
                  {editingPurchase ? "Save Changes" : "Create Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ ADJUST STOCK MODAL ============ */}
      {isAdjustModalOpen && selectedStock && (
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
                onClick={() => setIsAdjustModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
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
                    <option value="out">Stock Out (remove)</option>
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
                      step="0.001"
                      max={
                        adjustForm.type === "out"
                          ? selectedStock.quantity
                          : undefined
                      }
                      value={adjustForm.quantity}
                      onChange={(e) =>
                        setAdjustForm((f) => ({
                          ...f,
                          quantity: e.target.value,
                        }))
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
                    placeholder="e.g. Damaged, Found extra, Cycle count"
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
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white hover:bg-slate-800 sm:w-auto"
                >
                  <Save size={14} /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

            {/* ============ RESERVE MODAL ============ */}
      {isReserveModalOpen && selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Reserve Stock
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {selectedStock.name} — commit stock to production
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReserveModalOpen(false)}
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
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      max={selectedStock.quantity}
                      value={reserveForm.reservedQty}
                      onChange={(e) =>
                        setReserveForm((f) => ({
                          ...f,
                          reservedQty: e.target.value,
                        }))
                      }
                      required
                      className={inputClass + " pr-14"}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                      {selectedStock.unit}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Cannot exceed available stock. Set to 0 to release all.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsReserveModalOpen(false)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white hover:bg-slate-800 sm:w-auto"
                >
                  <Save size={14} /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

            {/* ============ VIEW PURCHASE MODAL ============ */}
      {viewingPurchase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]"
          onClick={() => setViewingPurchase(null)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Purchase Order Details
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Ordered on {formatDate(viewingPurchase.orderedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPurchaseStatusBadge(viewingPurchase.status)}`}
                >
                  {viewingPurchase.status === "Received" && <CheckCircle2 size={10} />}
                  {viewingPurchase.status === "Pending" && <Clock size={10} />}
                  {viewingPurchase.status === "Cancelled" && <XCircle size={10} />}
                  {viewingPurchase.status}
                </span>
                <button
                  type="button"
                  onClick={() => setViewingPurchase(null)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Material">
                  <p className="font-semibold">{viewingPurchase.material?.name || "—"}</p>
                  {viewingPurchase.material?.category === "Reel" &&
                    viewingPurchase.material?.sizeKg && (
                      <p className="text-[11px] text-slate-400">
                        {viewingPurchase.material.sizeKg} kg each
                      </p>
                    )}
                </DetailItem>

                <DetailItem label="Supplier">
                  {(() => {
                    const name =
                      viewingPurchase.supplier?.company ||
                      viewingPurchase.supplier?.name ||
                      viewingPurchase.supplierName ||
                      "—";
                    const phone =
                      viewingPurchase.supplier?.phone || viewingPurchase.supplierPhone || null;
                    return (
                      <>
                        <p className="font-semibold">{name}</p>
                        {viewingPurchase.supplier?.company && viewingPurchase.supplier?.name && (
                          <p className="text-[11px] text-slate-400">
                            {viewingPurchase.supplier.name}
                          </p>
                        )}
                        {phone && <p className="text-[11px] text-slate-400">{phone}</p>}
                      </>
                    );
                  })()}
                </DetailItem>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <DetailItem label="Quantity">
                  <span className="font-semibold tabular-nums">
                    {formatNumber(viewingPurchase.quantity)}
                  </span>{" "}
                  <span className="text-[11px] text-slate-500">
                    {viewingPurchase.unit}
                  </span>
                </DetailItem>
                <DetailItem label="Unit Price">
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(viewingPurchase.unitPrice)}
                  </span>
                </DetailItem>
                <DetailItem label="Total">
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(
                      Number(viewingPurchase.quantity || 0) *
                        Number(viewingPurchase.unitPrice || 0)
                    )}
                  </span>
                </DetailItem>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <DetailItem label="Ordered On">
                  {formatDate(viewingPurchase.orderedAt)}
                </DetailItem>
                <DetailItem label="Expected On">
                  <span
                    className={
                      isOverdue(viewingPurchase.expectedAt, viewingPurchase.status)
                        ? "font-medium text-red-600"
                        : ""
                    }
                  >
                    {formatDate(viewingPurchase.expectedAt)}
                  </span>
                  {isOverdue(viewingPurchase.expectedAt, viewingPurchase.status) && (
                    <p className="text-[11px] text-red-500">Overdue</p>
                  )}
                </DetailItem>
                <DetailItem label="Received On">
                  {viewingPurchase.status === "Received"
                    ? formatDate(viewingPurchase.receivedAt)
                    : "—"}
                </DetailItem>
              </div>

              <DetailItem label="Notes">
                {viewingPurchase.notes ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {viewingPurchase.notes}
                  </p>
                ) : (
                  <span className="text-slate-400">No notes</span>
                )}
              </DetailItem>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
              >
                Close
              </button>
              {viewingPurchase.status === "Pending" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const p = viewingPurchase;
                      setViewingPurchase(null);
                      openEditPurchaseModal(p);
                    }}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const p = viewingPurchase;
                      setViewingPurchase(null);
                      handleReceive(p);
                    }}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <Truck size={13} /> Receive
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ RESERVED STOCK CONFIRM MODAL ============ */}
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
            This issue exceeds the available (free) stock.
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
            will be taken from stock reserved for other orders. This will reduce
            the reserved quantity.
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

export default RawMaterials;