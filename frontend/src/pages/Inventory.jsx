import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import {
  Warehouse, Package, AlertTriangle, IndianRupee, Search, Plus,
  ArrowDownToLine, ArrowUpFromLine, History, Pencil, Trash2, X,
  RefreshCw, Save, Boxes, Factory, Recycle, Layers,
} from "lucide-react";

import {
  getInventory,
  createInventory,
  updateInventory,
  adjustStock,
  deleteInventory,
  getProducts,
  getInventorySummary,
  getLowStock,
  getInventoryFamilies,
} from "../api/api";

const SESSION_ALERT_KEY = "lowStockAlertShown";
const SESSION_ALERT_FINGERPRINT = "lowStockAlertFingerprint";

const REEL_PACKAGING_FORMS = ["Reel", "Coil", "Spool", "Bobbin"];

const isReelPackaging = (packaging) =>
  REEL_PACKAGING_FORMS.includes(packaging);

const packagingFromName = (name) => {
  const n = (name || "").trim().toLowerCase();
  if (!n) return "None";
  const forms = { reel: "Reel", coil: "Coil", spool: "Spool", bobbin: "Bobbin" };
  for (const [key, form] of Object.entries(forms)) {
    if (n === key || n.startsWith(`${key} `) || n.endsWith(` ${key}`)) {
      return form;
    }
  }
  return "None";
};

// Allowed units. Must stay in sync with backend utils/units.js.
// Note: "Reel" is intentionally absent — it is a packaging form, not a unit.
const UNIT_OPTIONS = ["Ton", "Kg", "Box", "Piece", "Coil", "Meter"];

const buildLowStockFingerprint = (items) =>
  items
    .map((it) => {
      const qty = Number(it.quantity || 0);
      const critical = Number(it.criticalLevel || 0);
      const severity =
        qty === 0
          ? "out"
          : critical > 0 && qty <= critical
          ? "critical"
          : "low";
      return `${it._id}:${severity}`;
    })
    .sort()
    .join("|");

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [showLowStockPopup, setShowLowStockPopup] = useState(false);

  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");

  const [rawPage, setRawPage] = useState(1);
  const [prodPage, setProdPage] = useState(1);
  const PER_PAGE = 8;

  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState(null);

  const [movementType, setMovementType] = useState("in");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [movementReelCount, setMovementReelCount] = useState("");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

    const [formData, setFormData] = useState({
    inventoryType: "Product",
    product: "",
    materialName: "",
    packaging: "None",
    warehouse: "Main",
    quantity: "",
    unit: "Ton",
    reorderLevel: "",
    criticalLevel: "",
    ratePerKg: "",
    batchNumber: "",
    location: "",
    notes: "",
    reelSize: "",
    scrapPerReel: "",
    reelCount: "",
  });

  /* ============ FETCH ============ */

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await getInventory({ limit: 200 });
      setInventory(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const res = await getProducts({ limit: 200 });
      setProducts(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load products.");
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await getInventoryFamilies();
      setFamilies(res.data?.data || []);
    } catch (err) {
      console.error("Families error:", err);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await getInventorySummary();
      setSummary(res.data?.data || null);
    } catch (err) {
      console.error("Summary error:", err);
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const fetchLowStock = useCallback(async () => {
    try {
      const res = await getLowStock();
      const items = res.data?.data || [];
      setLowStockAlerts(items);

      if (items.length === 0) {
        // Nothing to warn about — clear the fingerprint so next time it
        // dips below reorder, the popup fires again.
        window.sessionStorage.removeItem(SESSION_ALERT_FINGERPRINT);
        window.sessionStorage.removeItem(SESSION_ALERT_KEY);
        return;
      }

      const newFingerprint = buildLowStockFingerprint(items);
      const lastFingerprint = window.sessionStorage.getItem(
        SESSION_ALERT_FINGERPRINT
      );
      const alreadyShownThisSession =
        window.sessionStorage.getItem(SESSION_ALERT_KEY) === "1";

      // Show when:
      //   1. It's the first alert this session, OR
      //   2. The low-stock set has changed since we last showed it
      const shouldShow =
        !alreadyShownThisSession || newFingerprint !== lastFingerprint;

      if (shouldShow) {
        setShowLowStockPopup(true);
        window.sessionStorage.setItem(SESSION_ALERT_KEY, "1");
        window.sessionStorage.setItem(SESSION_ALERT_FINGERPRINT, newFingerprint);
      }
    } catch (err) {
      console.error("Low stock error:", err);
    }
  }, []);

    const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchInventory(),
      fetchFamilies(),
      fetchSummary(),
      fetchLowStock(),
    ]);
  }, [fetchInventory, fetchFamilies, fetchSummary, fetchLowStock]);

    useEffect(() => {
    fetchInventory();
    fetchProducts();
    fetchFamilies();
    fetchSummary();
    fetchLowStock();
  }, [fetchInventory, fetchProducts, fetchFamilies, fetchSummary, fetchLowStock]);

  /* ============ HELPERS ============ */

  const getProduct = (item) => {
    if (!item?.product) return null;
    if (typeof item.product === "object") return item.product;
    return products.find((p) => p._id === item.product);
  };
  const getProductName = (item) => getProduct(item)?.name || "Unknown Product";
  const getProductCode = (item) =>
    getProduct(item)?.productCode || getProduct(item)?.code || "—";
  const getInventoryName = (item) =>
    item?.inventoryType === "Raw Material"
      ? item.materialName || "Unknown Material"
      : getProductName(item);
  const getInventoryCode = (item) =>
    item?.inventoryType === "Raw Material" ? "RAW" : getProductCode(item);

    const getStockStatus = (item) => {
    const q = Number(item.quantity || 0);
    const r = Number(item.reorderLevel || 0);
    const c = Number(item.criticalLevel || 0);
    if (q === 0) return { label: "Out of Stock", type: "danger" };
    if (c > 0 && q <= c) return { label: "Critical", type: "critical" };
    if (r > 0 && q <= r) return { label: "Low Stock", type: "warning" };
    return { label: "In Stock", type: "success" };
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(v) || 0);

    const formatNumber = (v) =>
    Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

  const toTons = (item) => {
    const q = Number(item?.quantity || 0);
    if (item?.unit === "Kg") return q / 1000;
    if (item?.unit === "Ton" || !item?.unit) return q;
    return null;
  };

  const reelCountOf = (item) => {
    if (item?.reelCount != null) return Number(item.reelCount);
    if (
      item?.inventoryType !== "Raw Material" ||
      !isReelPackaging(item.packaging) ||
      !item.reelSize
    ) {
      return 0;
    }
    const qty = Number(item.quantity || 0);
    const kgPerUnit = item.unit === "Kg" ? 1 : 1000;
    return (qty * kgPerUnit) / Number(item.reelSize);
  };

  const scrapKgOf = (item) => {
    if (item?.estimatedScrapKg != null) return Number(item.estimatedScrapKg);
    if (!item?.scrapPerReel) return 0;
    return reelCountOf(item) * Number(item.scrapPerReel);
  };

  const availableOf = (item) => Number(item?.quantity || 0);

  /** Kg per 1 unit of this record's unit — Ton→1000, Kg→1, others→null. */
  const kgPerUnitOf = (item) => {
    if (item?.unit === "Kg") return 1;
    if (item?.unit === "Ton" || !item?.unit) return 1000;
    return null; // Box / Piece / Coil / Meter — non-mass units
  };

  /* ============ FILTERS / PAGINATION ============ */

  const warehouses = useMemo(
    () => [...new Set(inventory.map((i) => i.warehouse).filter(Boolean))],
    [inventory]
  );

  const rawMaterialFamilies = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const f of families) {
      if (f.inventoryType !== "Raw Material") continue;
      const key = (f.materialName || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out.sort((a, b) =>
      (a.materialName || "").localeCompare(b.materialName || "")
    );
  }, [families]);

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((item) => {
      const haystack = [
        getInventoryName(item),
        getInventoryCode(item),
        item.materialName,
        item.batchNumber,
        item.location,
        item.warehouse,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());

      const matchesSearch = !q || haystack.some((s) => s.includes(q));
      const matchesWarehouse =
        warehouseFilter === "All" || item.warehouse === warehouseFilter;

      const qty = Number(item.quantity || 0);
      const reorder = Number(item.reorderLevel || 0);
      const isLow = qty <= reorder;
      const matchesStock =
        stockFilter === "All" ||
        (stockFilter === "Low" && isLow) ||
        (stockFilter === "Healthy" && !isLow);

      return matchesSearch && matchesWarehouse && matchesStock;
    });
  }, [inventory, search, warehouseFilter, stockFilter]);

  const rawMaterials = useMemo(
    () => filteredInventory.filter((i) => i.inventoryType === "Raw Material"),
    [filteredInventory]
  );
  const productInventory = useMemo(
    () => filteredInventory.filter((i) => i.inventoryType === "Product"),
    [filteredInventory]
  );

  const rawTotalPages = Math.max(1, Math.ceil(rawMaterials.length / PER_PAGE));
  const prodTotalPages = Math.max(1, Math.ceil(productInventory.length / PER_PAGE));

  const paginatedRawMaterials = useMemo(
    () => rawMaterials.slice((rawPage - 1) * PER_PAGE, rawPage * PER_PAGE),
    [rawMaterials, rawPage]
  );
  const paginatedProducts = useMemo(
    () => productInventory.slice((prodPage - 1) * PER_PAGE, prodPage * PER_PAGE),
    [productInventory, prodPage]
  );

  useEffect(() => {
    setRawPage(1);
    setProdPage(1);
  }, [search, warehouseFilter, stockFilter]);
  /* ============ KPI ============ */

  const kpi = useMemo(() => {
    if (summary) {
      return {
        records:
          (summary.rawMaterial?.count || 0) + (summary.product?.count || 0),
        totalWeight:
          (summary.rawMaterial?.totalWeight || 0) +
          (summary.product?.totalWeight || 0),
        lowStock: summary.alerts?.lowStockCount || 0,
        criticalStock: summary.alerts?.criticalStockCount || 0,
        rawWeight: summary.rawMaterial?.totalWeight || 0,
        rawScrap: summary.rawMaterial?.scrapWeight || 0,
        rawValue: summary.rawMaterial?.value || 0,
        productWeight: summary.product?.totalWeight || 0,
        productValue: summary.product?.value || 0,
        reserved: summary.reserve?.totalReserve || 0,
      };
    }
        const raw = inventory.filter((i) => i.inventoryType === "Raw Material");
    const prod = inventory.filter((i) => i.inventoryType === "Product");

    // Sum in tons, respecting each record's unit. Records with non-mass units
    // (Box / Piece / Coil / Meter) are excluded from weight totals.
    const sumTons = (list) =>
      list.reduce((sum, i) => {
        const t = toTons(i);
        return sum + (t == null ? 0 : t);
      }, 0);

    // Value uses the backend-computed stockValue virtual when present,
    // falling back to a unit-aware manual calc.
    const sumValue = (list) =>
      list.reduce((sum, i) => {
        if (i.stockValue != null) return sum + Number(i.stockValue);
        const kg = kgPerUnitOf(i);
        if (kg == null) {
          return (
            sum +
            Number(i.quantity || 0) * Number(i.ratePerUnit || 0)
          );
        }
        return sum + Number(i.quantity || 0) * kg * Number(i.ratePerKg || 0);
      }, 0);

    return {
      records: inventory.length,
      totalWeight: sumTons(inventory),
      lowStock: inventory.filter(
        (i) => Number(i.quantity) <= Number(i.reorderLevel)
      ).length,
      criticalStock: inventory.filter(
        (i) =>
          Number(i.criticalLevel) > 0 &&
          Number(i.quantity) <= Number(i.criticalLevel)
      ).length,
      rawWeight: sumTons(raw),
      rawScrap: raw.reduce((a, i) => a + scrapKgOf(i), 0),
      rawValue: sumValue(raw),
      productWeight: sumTons(prod),
      productValue: sumValue(prod),
      reserved: 0,
    };
  }, [summary, inventory]);

  const surplus = Math.max(kpi.totalWeight - kpi.reserved, 0);

  /* ============ FORM ============ */

    const resetForm = () => {
    setFormData({
      inventoryType: "Product",
      product: "",
      materialName: "",
      packaging: "None",
      warehouse: "Main",
      quantity: "",
      unit: "Ton",
      reorderLevel: "",
      criticalLevel: "",
      ratePerKg: "",
      batchNumber: "",
      location: "",
      notes: "",
      reelSize: "",
      scrapPerReel: "",
      reelCount: "",
    });
    setEditingInventory(null);
  };

  const openAddInventoryModal = () => {
    resetForm();
    setIsInventoryModalOpen(true);
  };

  const openEditInventoryModal = (item) => {
    setEditingInventory(item);

    const isReelItem = isReelPackaging(item.packaging);
    const reelSizeKg = Number(item.reelSize) || 0;
    const kgPerUnit = item.unit === "Kg" ? 1 : 1000;

    const unitToReelFactor =
      isReelItem && reelSizeKg > 0 ? kgPerUnit / reelSizeKg : 1;

    setFormData({
      inventoryType: item.inventoryType || "Product",
      product:
        typeof item.product === "object"
          ? item.product?._id || ""
          : item.product || "",
      materialName: item.materialName || "",
      packaging: item.packaging || "None",
      warehouse: item.warehouse || "Main",
      quantity: item.quantity ?? "",
      unit: item.unit || "Ton",
      reorderLevel: Number(
        ((Number(item.reorderLevel || 0) * unitToReelFactor)).toFixed(3)
      ),
      criticalLevel: Number(
        ((Number(item.criticalLevel || 0) * unitToReelFactor)).toFixed(3)
      ),
      ratePerKg: item.ratePerKg ?? "",
      batchNumber: item.batchNumber || "",
      location: item.location || "",
      notes: item.notes || "",
      reelSize: item.reelSize ?? "",
      scrapPerReel: item.scrapPerReel ?? "",
      reelCount: "",
    });
    setIsInventoryModalOpen(true);
  };

  const closeInventoryModal = () => {
    setIsInventoryModalOpen(false);
    resetForm();
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  // Lock reel fields when materialName === "Reel"
    /**
   * Matched family: if the typed material name matches an existing family
   * (case-insensitive), we inherit its unit / packaging / reel values.
   * This is what makes "unit locks once chosen" visible to the user —
   * the unit input becomes disabled and shows the family's unit.
   */
  const matchedFamily = useMemo(() => {
    if (formData.inventoryType !== "Raw Material") return null;
    const n = (formData.materialName || "").trim().toLowerCase();
    if (!n) return null;
    return (
      families.find(
        (f) =>
          f.inventoryType === "Raw Material" &&
          (f.materialName || "").trim().toLowerCase() === n
      ) || null
    );
  }, [families, formData.materialName, formData.inventoryType]);

  /** Unit is locked when editing, or when the name matches an existing family. */
  const unitIsLocked = !!editingInventory || !!matchedFamily;

  /**
   * Auto-derive packaging from the name (or from the matched family) and
   * inherit the locked fields. Runs on every material name change.
   * Editing never rewrites packaging — it's immutable server-side.
   */
  useEffect(() => {
    if (formData.inventoryType !== "Raw Material") return;
    if (editingInventory) return;

    const derivedPackaging =
      matchedFamily?.packaging || packagingFromName(formData.materialName);
    const reelForm = isReelPackaging(derivedPackaging);

    setFormData((p) => {
      const nextUnit = matchedFamily?.unit
        ? matchedFamily.unit
        : reelForm
        ? "Ton"
        : p.unit;

      const nextReelSize =
        reelForm && (p.reelSize === "" || p.reelSize == null)
          ? matchedFamily?.reelSize ?? ""
          : reelForm
          ? p.reelSize
          : "";

      const nextScrap =
        reelForm && (p.scrapPerReel === "" || p.scrapPerReel == null)
          ? matchedFamily?.scrapPerReel ?? ""
          : reelForm
          ? p.scrapPerReel
          : "";

      // No change needed? Return previous state to avoid render loops.
      if (
        p.packaging === derivedPackaging &&
        p.unit === nextUnit &&
        p.reelSize === nextReelSize &&
        p.scrapPerReel === nextScrap
      ) {
        return p;
      }

      return {
        ...p,
        packaging: derivedPackaging,
        unit: nextUnit,
        reelSize: nextReelSize,
        scrapPerReel: nextScrap,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.materialName,
    formData.inventoryType,
    matchedFamily,
    editingInventory,
  ]);

    const reelPreview = useMemo(() => {
    const count = Number(formData.reelCount) || 0;
    const size = Number(formData.reelSize) || 0;
    const scrap = Number(formData.scrapPerReel) || 0;
    const grossKg = count * size;
    const scrapKg = count * scrap;
    const netKg = Math.max(grossKg - scrapKg, 0);
    const kgPerUnit = formData.unit === "Kg" ? 1 : 1000;
    return {
      count,
      size,
      scrap,
      grossKg,
      scrapKg,
      netKg,
      quantityInUnit: grossKg / kgPerUnit,
    };
  }, [
    formData.reelCount,
    formData.reelSize,
    formData.scrapPerReel,
    formData.unit,
  ]);

    const handleInventorySubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");

      const isReel =
        formData.inventoryType === "Raw Material" &&
        isReelPackaging(formData.packaging);

      if (editingInventory) {
        const isReelEdit =
          formData.inventoryType === "Raw Material" &&
          isReelPackaging(formData.packaging);
        const reelSizeKg = Number(formData.reelSize) || 0;
        const kgPerUnit = formData.unit === "Kg" ? 1 : 1000;

        // Reel-packaged materials: user enters reel counts → convert to unit.
        const reelToUnit =
          isReelEdit && reelSizeKg > 0 ? reelSizeKg / kgPerUnit : 1;

        const reorderLevel = (Number(formData.reorderLevel) || 0) * reelToUnit;
        const criticalLevel = (Number(formData.criticalLevel) || 0) * reelToUnit;

        if (criticalLevel > reorderLevel) {
          return setError(
            "Critical level cannot be greater than reorder level."
          );
        }

        const payload = {
          warehouse: formData.warehouse.trim() || "Main",
          reorderLevel,
          criticalLevel,
          ratePerKg: Number(formData.ratePerKg) || 0,
          batchNumber: formData.batchNumber.trim() || undefined,
          location: formData.location.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        };

        if (isReelEdit) {
          payload.reelSize = Number(formData.reelSize) || 0;
          payload.scrapPerReel = Number(formData.scrapPerReel) || 0;
        }

        await updateInventory(editingInventory._id, payload);
        setSuccess("Inventory updated successfully.");
        closeInventoryModal();
        await refreshAll();
        return;
      }

      /* =========================================================
         CREATE — validations
      ========================================================= */
      if (formData.inventoryType === "Product" && !formData.product) {
        return setError("Please select a product.");
      }
      if (
        formData.inventoryType === "Raw Material" &&
        !formData.materialName.trim()
      ) {
        return setError("Please enter the raw material name.");
      }

      const kgPerUnit = formData.unit === "Kg" ? 1 : 1000;
      const reelSizeKg = Number(formData.reelSize) || 0;

      const rawReorder = Number(formData.reorderLevel) || 0;
      const rawCritical = Number(formData.criticalLevel) || 0;

      const reorderLevel =
        isReel && reelSizeKg > 0
          ? (rawReorder * reelSizeKg) / kgPerUnit
          : rawReorder;

      const criticalLevel =
        isReel && reelSizeKg > 0
          ? (rawCritical * reelSizeKg) / kgPerUnit
          : rawCritical;
      if (criticalLevel > reorderLevel) {
        return setError("Critical level cannot be greater than reorder level.");
      }

      const ratePerKg = Number(formData.ratePerKg) || 0;
      if (ratePerKg < 0) {
        return setError("Rate per Kg cannot be negative.");
      }

      if (isReel) {
        const reelSize = Number(formData.reelSize);
        const scrapPerReel = Number(formData.scrapPerReel);
        const reelCount = Number(formData.reelCount);

        if (!(reelSize > 0)) {
          return setError("Reel size must be greater than 0.");
        }
        if (!(scrapPerReel > 0)) {
          return setError("Scrap per reel must be greater than 0.");
        }
        if (scrapPerReel > reelSize) {
          return setError(
            "Scrap per reel cannot be greater than reel size."
          );
        }
        if (!(reelCount > 0)) {
          return setError("Number of reels must be greater than 0.");
        }
      }

      /* =========================================================
         CREATE — build payload
         unit comes from formData.unit (Ton or Kg for reels).
         packaging is derived from the name / family and sent so the
         backend does not default it to 'None'.
      ========================================================= */
      const payload = {
        inventoryType: formData.inventoryType,
        warehouse: formData.warehouse.trim() || "Main",
        reorderLevel,
        criticalLevel,
        ratePerKg,
        unit: formData.unit,
        batchNumber: formData.batchNumber.trim() || undefined,
        location: formData.location.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (formData.inventoryType === "Product") {
        payload.product = formData.product;
        payload.quantity = Number(formData.quantity) || 0;
      } else {
        // Raw Material
        payload.materialName = formData.materialName.trim();
        payload.packaging = formData.packaging;

        if (isReel) {
          // Send reel params (backend stores them as Kg, immutable).
          payload.reelSize = Number(formData.reelSize);
          payload.scrapPerReel = Number(formData.scrapPerReel);
          // Quantity is derived from reel count × reel size, expressed
          // in the material's own unit (Ton or Kg).
          payload.quantity = reelPreview.quantityInUnit;
        } else {
          payload.quantity = Number(formData.quantity) || 0;
        }
      }

      await createInventory(payload);
      setSuccess("Inventory record created successfully.");
      closeInventoryModal();
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save inventory.");
    }
  };

  /* ============ MOVEMENT ============ */

  const openMovementModal = (type = "in", inventoryId = "") => {
    setMovementType(type);
    setSelectedInventoryId(inventoryId);
    setMovementQuantity("");
    setMovementReelCount("");
    setMovementReason("");
    setMovementNotes("");
    setIsMovementModalOpen(true);
  };

  const closeMovementModal = () => {
    setIsMovementModalOpen(false);
    setSelectedInventoryId("");
    setMovementQuantity("");
    setMovementReelCount("");
    setMovementReason("");
    setMovementNotes("");
  };

  const selectedInventory = inventory.find((i) => i._id === selectedInventoryId);
  const selectedIsReel =
    selectedInventory && isReelPackaging(selectedInventory.packaging);
  const selectedUnit = selectedInventory?.unit || "Ton";

  useEffect(() => {
    if (!selectedIsReel || !selectedInventory) return;
    const count = Number(movementReelCount);
    if (!count || count <= 0) return;
    const sizeKg = Number(selectedInventory.reelSize) || 0;
    if (sizeKg <= 0) return;
    // Convert reel count → material's own unit (Ton or Kg).
    const kgPerUnit = selectedUnit === "Kg" ? 1 : 1000;
    const qty = (count * sizeKg) / kgPerUnit;
    setMovementQuantity(qty.toFixed(4));
  }, [movementReelCount, selectedInventory, selectedIsReel, selectedUnit]);

  const movementPreview = useMemo(() => {
    if (!selectedInventory) return null;
    const currentQty = Number(selectedInventory.quantity || 0);
    const delta = Number(movementQuantity || 0);
    let nextQty = currentQty;
    if (movementType === "in") nextQty = currentQty + delta;
    if (movementType === "out") nextQty = Math.max(currentQty - delta, 0);
    if (movementType === "adjustment") nextQty = delta;

    const sizeKg = Number(selectedInventory.reelSize) || 0;
    const kgPerUnit = selectedInventory.unit === "Kg" ? 1 : 1000;
    return {
      currentQty,
      nextQty,
      currentReels: sizeKg ? (currentQty * kgPerUnit) / sizeKg : 0,
      nextReels: sizeKg ? (nextQty * kgPerUnit) / sizeKg : 0,
      sizeKg,
    };
  }, [selectedInventory, movementQuantity, movementType]);

  const handleMovement = async (e) => {
    e.preventDefault();
    const quantity = Number(movementQuantity);
    if (!selectedInventoryId) return setError("Please select an inventory record.");
    if (quantity <= 0) return setError("Quantity must be greater than zero.");
    try {
      setError("");
      setSuccess("");
      await adjustStock(selectedInventoryId, {
        type: movementType,
        quantity,
        reason: movementReason.trim() || undefined,
        notes: movementNotes.trim() || undefined,
      });
      setSuccess(
        movementType === "in"
          ? "Stock added successfully."
          : movementType === "out"
          ? "Stock removed successfully."
          : "Stock adjusted successfully."
      );
      closeMovementModal();
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to adjust stock.");
    }
  };

  /* ============ DELETE ============ */

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete inventory record for ${getInventoryName(item)}?`))
      return;
    try {
      setError("");
      setSuccess("");
      await deleteInventory(item._id);
      setSuccess("Inventory record deleted successfully.");
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete inventory.");
    }
  };

  /* ============ STYLING ============ */

  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
  const labelClass =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";

  const getStatusClasses = (status) => {
    if (status.type === "danger") return "bg-red-50 text-red-700 border-red-100";
    if (status.type === "critical")
      return "bg-rose-100 text-rose-800 border-rose-200";
    if (status.type === "warning")
      return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  /* ============ ROW RENDERER ============ */

    const renderRawMaterialRow = (item) => {
    const status = getStockStatus(item);
    const reel = isReelPackaging(item.packaging);
    const reelCount = reelCountOf(item);
    const scrapKg = scrapKgOf(item);
    const available = availableOf(item);
    const unitLabel = item.unit || "Ton";

    return (
      <tr key={item._id} className="group transition-colors hover:bg-slate-50/70">
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Factory size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">
                {item.materialName}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {item.batchNumber ? `Batch: ${item.batchNumber}` : "RAW"}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
          </div>
        </td>

        <td className="px-4 py-3.5">
          {reel && item.reelSize ? (
            <div>
              <p className="text-xs font-semibold text-slate-800">
                {formatNumber(item.reelSize)} Kg
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {formatNumber(reelCount)} reels · Scrap {formatNumber(item.scrapPerReel)} Kg/reel
              </p>
            </div>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>

        <td className="px-4 py-3.5 text-right">
          <span className="text-[13px] font-semibold tabular-nums text-slate-900">
            {formatNumber(available)}
          </span>
          <span className="ml-1 text-[10px] text-slate-400">{unitLabel}</span>
          {reel && reelCount > 0 && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              ≈ {formatNumber(reelCount)} reels
            </p>
          )}
        </td>

        <td className="px-4 py-3.5">
          {reel ? (
            <span className="text-xs font-semibold text-rose-600">
              {formatNumber(scrapKg)}{" "}
              <span className="text-[10px] text-slate-400">kg</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>

        <td className="px-4 py-3.5 text-right">
          <span className="text-xs font-medium tabular-nums text-slate-600">
            {formatNumber(item.reorderLevel)}
          </span>{" "}
          <span className="text-[10px] text-slate-400">{unitLabel}</span>
        </td>

        <td className="px-4 py-3.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusClasses(
              status
            )}`}
          >
            {status.label}
          </span>
        </td>

        <td className="px-4 py-3.5">
          <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
            <button
              type="button"
              title="Stock In"
              onClick={() => openMovementModal("in", item._id)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50"
            >
              <ArrowDownToLine size={15} />
            </button>
            <button
              type="button"
              title="Stock Out"
              onClick={() => openMovementModal("out", item._id)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-50"
            >
              <ArrowUpFromLine size={15} />
            </button>
            <button
              type="button"
              title="Edit"
              onClick={() => openEditInventoryModal(item)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={() => handleDelete(item)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderProductRow = (item) => {
    const status = getStockStatus(item);
    const product = getProduct(item);
    const stockValue =
      item.stockValue != null
        ? Number(item.stockValue)
        : Number(item.quantity || 0) * 1000 * Number(item.ratePerKg || 0);

    return (
      <tr key={item._id} className="group transition-colors hover:bg-slate-50/70">
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a] text-xs font-semibold">
              {(product?.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">
                {getProductName(item)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {getProductCode(item)}
                {product?.diameter ? ` · ${product.diameter} mm` : ""}
                {item.batchNumber ? ` · ${item.batchNumber}` : ""}
              </p>
            </div>
          </div>
        </td>

        <td className="px-4 py-3.5">
          <p className="text-xs font-semibold text-slate-700">
            {item.warehouse || "Main"}
          </p>
          {item.location && (
            <p className="mt-0.5 text-[10px] text-slate-400">{item.location}</p>
          )}
        </td>

        <td className="px-4 py-3.5">
          <span className="text-xs font-semibold text-slate-800">
            {formatNumber(item.quantity)}
          </span>{" "}
          <span className="text-[10px] text-slate-400">
            {item.unit || "Ton"}
          </span>
        </td>

        <td className="px-4 py-3.5">
          <span className="text-xs text-slate-700">
            {formatNumber(item.reorderLevel)}
          </span>{" "}
          <span className="text-[10px] text-slate-400">
            {item.unit || "Ton"}
          </span>
        </td>

        <td className="px-4 py-3.5">
          <span className="text-xs font-semibold text-slate-800">
            {formatCurrency(stockValue)}
          </span>
        </td>

        <td className="px-4 py-3.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusClasses(
              status
            )}`}
          >
            {status.label}
          </span>
        </td>

        {/* ACTIONS */}
        <td className="px-4 py-3.5">
          <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
            <button
              type="button"
              title="Stock In"
              onClick={() => openMovementModal("in", item._id)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50"
            >
              <ArrowDownToLine size={15} />
            </button>

            <button
              type="button"
              title="Stock Out"
              onClick={() => openMovementModal("out", item._id)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-50"
            >
              <ArrowUpFromLine size={15} />
            </button>

            <button
              type="button"
              title="Edit"
              onClick={() => openEditInventoryModal(item)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Pencil size={14} />
            </button>

            <button
              type="button"
              title="Delete"
              onClick={() => handleDelete(item)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderEmptyState = (message) => (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Package size={18} />
      </div>
      <h4 className="mt-3 text-sm font-semibold text-slate-800">
        No inventory records
      </h4>
      <p className="mt-1 text-xs text-slate-500">{message}</p>
    </div>
  );

  const KpiSkeleton = ({ wide = false }) => (
    <div className="mt-4 space-y-2">
      <div className={`h-6 rounded-md shimmer ${wide ? "w-32" : "w-20"}`} />
      <div className="h-3 w-28 rounded-md shimmer" />
    </div>
  );

  /* ============ RENDER ============ */

  return (
    <div className="w-full space-y-5 pb-6">
      {/* LOW STOCK POPUP */}
      {/* LOW STOCK POPUP */}
{showLowStockPopup && lowStockAlerts.length > 0 && (
  <div
    role="alert"
    className="fixed right-4 top-4 z-[60] w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-xl border-2 border-rose-300 bg-white shadow-2xl ring-1 ring-black/5 sm:right-5 sm:top-5"
  >
    {/* HEADER */}
    <div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
          <AlertTriangle size={16} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-rose-900">
            Low Stock Warning
          </p>
          <p className="truncate text-[11px] text-rose-700">
            {lowStockAlerts.length} item
            {lowStockAlerts.length !== 1 ? "s" : ""} at or below reorder level
          </p>
        </div>
      </div>
      <button
        onClick={() => setShowLowStockPopup(false)}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-rose-500 transition-colors hover:bg-rose-200/60 hover:text-rose-700"
      >
        <X size={15} />
      </button>
    </div>

    {/* BODY */}
    {(() => {
      const rawAlerts = lowStockAlerts.filter(
        (i) => i.inventoryType === "Raw Material"
      );
      const prodAlerts = lowStockAlerts.filter(
        (i) => i.inventoryType === "Product"
      );

      const renderList = (list) => (
        <ul className="mt-1.5 space-y-1.5">
          {list.map((it) => {
            const qty = Number(it.quantity || 0);
            const reorder = Number(it.reorderLevel || 0);
            const critical =
              Number(it.criticalLevel || 0) > 0 &&
              qty <= Number(it.criticalLevel || 0);
            const percent =
              reorder > 0 ? Math.min((qty / reorder) * 100, 100) : 0;

            return (
              <li key={it._id} className="text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-slate-800">
                    {it.materialName || it.product?.name || "—"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      critical
                        ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                        : "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                    }`}
                  >
                    {critical ? "CRITICAL" : "LOW"}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        critical ? "bg-rose-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                    {formatNumber(qty)} / {formatNumber(reorder)}{" "}
                    {it.unit || "Ton"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      );

      return (
        <div className="thin-scroll max-h-72 overflow-y-auto">
          {rawAlerts.length > 0 && (
            <div className="border-l-4 border-rose-500 bg-rose-50/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-rose-700">
                Raw Materials · Production Critical
              </p>
              {renderList(rawAlerts)}
            </div>
          )}
          {prodAlerts.length > 0 && (
            <div className="border-l-4 border-amber-500 bg-amber-50/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">
                Products · Sales Impact
              </p>
              {renderList(prodAlerts)}
            </div>
          )}
        </div>
      );
    })()}

    {/* FOOTER */}
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
      <p className="text-[10px] text-slate-500">
        Review stock and raise purchase orders.
      </p>
      <button
        onClick={() => setShowLowStockPopup(false)}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800"
      >
        Got it
      </button>
        </div>
      </div>
    )}

      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-md ring-1 ring-slate-900/10">
            <Warehouse size={20} />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
              Inventory
            </h1>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Raw materials, finished products & warehouse movements
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openMovementModal("out")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowUpFromLine size={16} /> Stock Out
          </button>
          <button
            type="button"
            onClick={() => openMovementModal("in")}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
          >
            <Plus size={16} /> Stock In
          </button>
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>      

      {/* ERROR / SUCCESS */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Something went wrong</p>
            <p className="mt-0.5 text-xs leading-5 text-red-600">{error}</p>
          </div>
          <button
            onClick={() => setError("")}
            className="rounded-md p-1 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{success}</p>
          </div>
          <button
            onClick={() => setSuccess("")}
            className="rounded-md p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="card-elevated relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* subtle grid backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Layers size={13} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">
                Stock Overview
              </p>
              <p className="text-[10px] text-slate-400">
                Reserved = safety stock held for critical fallback
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="relative grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Current Stock
              </p>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
              {formatNumber(kpi.totalWeight)}
              <span className="ml-1.5 text-xs font-medium text-slate-400">ton</span>
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Reserved
              </p>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-700">
              {formatNumber(kpi.reserved)}
              <span className="ml-1.5 text-xs font-medium text-slate-400">ton</span>
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50/70 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                Surplus Available
              </p>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-emerald-700">
              {formatNumber(surplus)}
              <span className="ml-1.5 text-xs font-medium text-emerald-500">ton</span>
            </p>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Records */}
        <div className="card-elevated relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-slate-400 to-slate-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 shadow-inner">
            <Boxes size={18} />
          </div>
          {kpiLoading ? (
            <KpiSkeleton />
          ) : (
            <div className="mt-4">
              <p className="text-[26px] font-semibold tracking-tight text-slate-900">
                {kpi.records}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Inventory Records
              </p>
            </div>
          )}
        </div>

        {/* Total Stock */}
        <div className="card-elevated relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 to-blue-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 text-blue-700 shadow-inner">
            <Warehouse size={18} />
          </div>
          {kpiLoading ? (
            <KpiSkeleton />
          ) : (
            <div className="mt-4">
              <p className="text-[26px] font-semibold tracking-tight text-slate-900">
                {formatNumber(kpi.totalWeight)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Total Stock (ton)
              </p>
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="card-elevated relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-700 shadow-inner">
            <AlertTriangle size={18} />
          </div>
          {kpiLoading ? (
            <KpiSkeleton />
          ) : (
            <div className="mt-4">
              <p className="text-[26px] font-semibold tracking-tight text-slate-900">
                {kpi.lowStock}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Low Stock Items
                {kpi.criticalStock > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                    {kpi.criticalStock} critical
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Inventory Value */}
        <div className="card-elevated relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 to-teal-600" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 shadow-inner">
            <IndianRupee size={18} />
          </div>
          {kpiLoading ? (
            <KpiSkeleton wide />
          ) : (
            <div className="mt-4">
              <p className="text-[26px] font-semibold tracking-tight text-slate-900">
                {formatCurrency(kpi.rawValue + kpi.productValue)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Inventory Value (Cost)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RAW / PRODUCT SUMMARY */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Raw Material Stock
              </p>
              <p className="mt-1.5 text-xl font-semibold text-slate-900">
                {formatNumber(kpi.rawWeight)}{" "}
                <span className="text-xs font-medium text-slate-400">ton</span>
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Scrap {formatNumber(kpi.rawScrap)} Kg · Value{" "}
                {formatCurrency(kpi.rawValue)}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Factory size={17} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Product Stock
              </p>
              <p className="mt-1.5 text-xl font-semibold text-slate-900">
                {formatNumber(kpi.productWeight)}{" "}
                <span className="text-xs font-medium text-slate-400">ton</span>
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Value {formatCurrency(kpi.productValue)}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Package size={17} />
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-3.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-[360px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search products, materials, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="All">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="All">All Stock</option>
              <option value="Healthy">Healthy</option>
              <option value="Low">Low Stock</option>
            </select>
            <button
              type="button"
              onClick={openAddInventoryModal}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-3.5 text-xs font-semibold text-white transition-all hover:bg-slate-800"
            >
              <Plus size={15} /> Add Inventory
            </button>
          </div>
        </div>
      </section>

      {/* RAW MATERIALS TABLE */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-amber-50/60 to-transparent px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 shadow-inner">
              <Factory size={17} />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Raw Materials
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Reel stock, scrap yield & reorder tracking
              </p>
            </div>
          </div>
          <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-700">
            {rawMaterials.length} records
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <RefreshCw size={26} className="animate-spin text-slate-400" />
          </div>
        ) : rawMaterials.length === 0 ? (
          renderEmptyState(
            search || warehouseFilter !== "All"
              ? "No raw materials match the current filters."
              : "Add your first raw material inventory record."
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                    Material
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                    Reel Size
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                    Available 
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                    Scrap 
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                    Reorder Level
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                    Status
                  </th>
                  <th className="w-[150px] px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRawMaterials.map(renderRawMaterialRow)}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={rawPage}
          totalPages={rawTotalPages}
          onPage={setRawPage}
          totalRecords={rawMaterials.length}
          perPage={PER_PAGE}
        />
                
      </section>

        {/* PRODUCTS TABLE */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-transparent px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 shadow-inner">
                <Package size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                  Products
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Finished goods & sales inventory
                </p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              {productInventory.length} records
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <RefreshCw size={26} className="animate-spin text-slate-400" />
            </div>
          ) : productInventory.length === 0 ? (
            renderEmptyState(
              search || warehouseFilter !== "All"
                ? "No products match the current filters."
                : "Add your first product inventory record."
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                      Product
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                      Available
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                      Reorder Level
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                      Stock Value
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
                      Status
                    </th>
                    <th className="w-[150px] px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map(renderProductRow)}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={prodPage}
            totalPages={prodTotalPages}
            onPage={setProdPage}
            totalRecords={productInventory.length}
            perPage={PER_PAGE}
          />
          </section>

      {/* ================= ADD / EDIT MODAL ================= */}
      {isInventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingInventory ? "Edit Inventory" : "Add Inventory"}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {editingInventory
                    ? "Update inventory record details."
                    : "Create a new product or raw material inventory record."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInventoryModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleInventorySubmit}>
              <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* TYPE */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Inventory Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!!editingInventory}
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            inventoryType: "Product",
                            product: "",
                            materialName: "",
                          }))
                        }
                        className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-all ${
                          formData.inventoryType === "Product"
                            ? "border-[#0f172a] bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        } ${editingInventory ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <Package size={15} /> Product
                      </button>
                      <button
                        type="button"
                        disabled={!!editingInventory}
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            inventoryType: "Raw Material",
                            product: "",
                            materialName: "",
                          }))
                        }
                        className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-all ${
                          formData.inventoryType === "Raw Material"
                            ? "border-amber-600 bg-amber-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        } ${editingInventory ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <Factory size={15} /> Raw Material
                      </button>
                    </div>
                  </div>

                  {/* PRODUCT */}
                  {formData.inventoryType === "Product" && (
                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        Product <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="product"
                        value={formData.product}
                        onChange={handleFormChange}
                        required
                        disabled={!!editingInventory || productsLoading}
                        className={inputClass}
                      >
                        <option value="">
                          {productsLoading ? "Loading products..." : "Select product"}
                        </option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} — {p.productCode || p.code || "No Code"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* RAW MATERIAL NAME */}
                  {formData.inventoryType === "Raw Material" && (
                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        Material Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="materialName"
                        list="raw-material-families"
                        value={formData.materialName}
                        onChange={handleFormChange}
                        placeholder="Start typing or select existing…"
                        required
                        disabled={!!editingInventory}
                        autoComplete="off"
                        className={inputClass}
                      />
                      <datalist id="raw-material-families">
                        {rawMaterialFamilies.map((f) => (
                          <option
                            key={f.materialName}
                            value={f.materialName}
                          >
                            {`${f.unit}${f.packaging && f.packaging !== "None"
                              ? ` · ${f.packaging}`
                              : ""}`}
                          </option>
                        ))}
                      </datalist>

                      {/* Lock indicator */}
                      {matchedFamily && !editingInventory && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2">
                          <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <p className="text-[10px] leading-relaxed text-amber-800">
                            <span className="font-semibold">
                              Matches existing material.
                            </span>{" "}
                            Unit is locked to{" "}
                            <span className="font-semibold">
                              {matchedFamily.unit}
                            </span>
                            {matchedFamily.packaging &&
                              matchedFamily.packaging !== "None" && (
                                <>
                                  {" "}· packaging{" "}
                                  <span className="font-semibold">
                                    {matchedFamily.packaging}
                                  </span>
                                </>
                              )}
                            .
                          </p>
                        </div>
                      )}

                      {/* New-family hint */}
                      {!matchedFamily &&
                        !editingInventory &&
                        formData.materialName.trim() && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            New material — the unit you choose will be locked for
                            all future records of{" "}
                            <span className="font-medium text-slate-700">
                              {formData.materialName.trim()}
                            </span>
                            .
                          </p>
                        )}
                    </div>
                  )}

                  {/* REEL SPECIFICATION */}
                  {formData.inventoryType === "Raw Material" &&
                    isReelPackaging(formData.packaging) && (
                      <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-slate-900">
                            Reel Specification
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Enter reel size, scrap per reel, and number of reels.
                            Quantity in tons is calculated automatically.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelClass}>Reel Size (Kg) *</label>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              name="reelSize"
                              value={formData.reelSize}
                              onChange={handleFormChange}
                              placeholder="e.g. 8"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Scrap per Reel (Kg) *</label>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              name="scrapPerReel"
                              value={formData.scrapPerReel}
                              onChange={handleFormChange}
                              placeholder="e.g. 0.7"
                              className={inputClass}
                            />
                          </div>
                          {!editingInventory && (
                            <div className="sm:col-span-2">
                              <label className={labelClass}>Number of Reels *</label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                name="reelCount"
                                value={formData.reelCount}
                                onChange={handleFormChange}
                                placeholder="e.g. 50"
                                className={inputClass}
                              />
                            </div>
                          )}
                        </div>

                        {/* LIVE PREVIEW */}
                        {!editingInventory && reelPreview.count > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:grid-cols-4">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                Gross
                              </p>
                              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                                {formatNumber(reelPreview.grossKg)} kg
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                Scrap
                              </p>
                              <p className="mt-0.5 text-sm font-semibold text-rose-600">
                                {formatNumber(reelPreview.scrapKg)} kg
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                Available
                              </p>
                              <p className="mt-0.5 text-sm font-semibold text-emerald-600">
                                {formatNumber(reelPreview.netKg)} kg
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                Quantity ({formData.unit})
                              </p>
                              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                                {formatNumber(reelPreview.quantityInUnit)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {/* WAREHOUSE */}
                  <div>
                    <label className={labelClass}>Warehouse</label>
                    <input
                      type="text"
                      name="warehouse"
                      value={formData.warehouse}
                      onChange={handleFormChange}
                      placeholder="Main"
                      className={inputClass}
                    />
                  </div>

                  {/* QUANTITY (only for non-reel create) */}
                  {!(formData.inventoryType === "Raw Material" &&
                    isReelPackaging(formData.packaging) &&
                    !editingInventory) && (
                    <div>
                      <label className={labelClass}>
                        Quantity{" "}
                        {!editingInventory && <span className="text-red-500">*</span>}
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          name="quantity"
                          value={formData.quantity}
                          onChange={handleFormChange}
                          placeholder="Enter quantity"
                          disabled={!!editingInventory}
                          className="h-10 w-full rounded-l-lg border border-r-0 border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        <select
                          name="unit"
                          value={formData.unit}
                          onChange={handleFormChange}
                          disabled={unitIsLocked}
                          title={
                            unitIsLocked && matchedFamily
                              ? `Locked to ${matchedFamily.unit} because "${matchedFamily.materialName}" already exists.`
                              : undefined
                          }
                          className="h-10 rounded-r-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {UNIT_OPTIONS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editingInventory && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          Use Stock In/Out to change quantity.
                        </p>
                      )}
                    </div>
                  )}

                  {/* REORDER LEVEL */}
                  <div>
                    <label className={labelClass}>Reorder Level</label>
                    <input
                      type="number"
                      name="reorderLevel"
                      min="0"
                      step="0.001"
                      value={formData.reorderLevel}
                      onChange={handleFormChange}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>

                  {/* CRITICAL LEVEL */}
                  <div>
                    <label className={labelClass}>Critical Level</label>
                    <input
                      type="number"
                      name="criticalLevel"
                      min="0"
                      step="0.001"
                      value={formData.criticalLevel}
                      onChange={handleFormChange}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>

                  
                  {/* RATE PER KG */}
                  <div>
                    <label className={labelClass}>Rate per Kg (₹)</label>
                    <input
                      type="number"
                      name="ratePerKg"
                      min="0"
                      step="0.01"
                      value={formData.ratePerKg}
                      onChange={handleFormChange}
                      placeholder="0"
                      className={inputClass}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      {formData.inventoryType === "Product"
                        ? "Enter production cost per kg, not selling price."
                        : "Enter purchase cost per kg for this batch."}
                    </p>
                  </div>

                  {/* BATCH */}
                  <div>
                    <label className={labelClass}>Batch Number</label>
                    <input
                      type="text"
                      name="batchNumber"
                      value={formData.batchNumber}
                      onChange={handleFormChange}
                      placeholder="Optional"
                      className={inputClass}
                    />
                  </div>

                  {/* LOCATION */}
                  <div>
                    <label className={labelClass}>Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleFormChange}
                      placeholder="Rack / Section"
                      className={inputClass}
                    />
                  </div>

                  {/* NOTES */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleFormChange}
                      rows={3}
                      placeholder="Additional inventory notes..."
                      className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5 sm:py-3.5">
                <button
                  type="button"
                  onClick={closeInventoryModal}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:h-9 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:h-9 sm:w-auto"
                >
                  <Save size={14} />
                  {editingInventory ? "Save Changes" : "Create Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MOVEMENT MODAL ================= */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-0 py-0 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6">
          <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                  Stock Movement
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Add, remove or set inventory stock levels.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMovementModal}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleMovement} className="flex min-h-0 flex-1 flex-col">
                <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
                {/* MOVEMENT TYPE */}
                <div>
                  <label className={labelClass}>Movement Type</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="in">Stock In</option>
                    <option value="out">Stock Out</option>
                    <option value="adjustment">Set Stock Level</option>
                  </select>
                </div>

                {/* INVENTORY RECORD */}
                <div>
                  <label className={labelClass}>
                    Inventory Record <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedInventoryId}
                    onChange={(e) => setSelectedInventoryId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">Select inventory</option>
                    {inventory.map((item) => (
                      <option key={item._id} value={item._id}>
                        {getInventoryName(item)} — {formatNumber(item.quantity)}{" "}
                        {item.unit || "Ton"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CURRENT STOCK */}
                {selectedInventory && movementPreview && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                          Current Stock
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatNumber(movementPreview.currentQty)}{" "}
                          <span className="text-xs font-medium text-slate-400">
                            {selectedInventory.unit || "Ton"}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                          Type
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          {selectedInventory.inventoryType}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* REEL COUNT INPUT (only when reel item selected) */}
                                {selectedIsReel && (
                  <div>
                    <label className={labelClass}>
                      Number of Reels{" "}
                      {movementType !== "adjustment" && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={movementReelCount}
                      onChange={(e) => setMovementReelCount(e.target.value)}
                      placeholder="e.g. 50"
                      className={inputClass}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      Converts to {selectedUnit.toLowerCase()} automatically using
                      reel size {formatNumber(selectedInventory?.reelSize)} Kg.
                    </p>
                  </div>
                )}

                {/* QUANTITY */}
                <div>
                  <label className={labelClass}>
                    {movementType === "adjustment" ? "New Stock Level" : "Quantity"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={movementQuantity}
                      onChange={(e) => setMovementQuantity(e.target.value)}
                      required
                      placeholder="0"
                      className={inputClass + " pr-14"}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                      {selectedInventory?.unit || "Ton"}
                    </span>
                  </div>
                  {selectedIsReel &&
                    movementPreview &&
                    Number(movementQuantity) > 0 && (
                      <p className="mt-1 text-[10px] text-emerald-700">
                        New total: {formatNumber(movementPreview.nextQty)} ton ·{" "}
                        {formatNumber(movementPreview.nextReels)} reels
                      </p>
                    )}
                </div>

                {/* REASON */}
                <div>
                  <label className={labelClass}>Reason</label>
                  <input
                    type="text"
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    placeholder="e.g. Production, Purchase, Order dispatch"
                    className={inputClass}
                  />
                </div>

                {/* NOTES */}
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional notes..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5 sm:py-3.5">
                <button
                  type="button"
                  onClick={closeMovementModal}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 sm:h-9 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:h-9 sm:w-auto"
                >
                  <Save size={14} />
                  {movementType === "in"
                    ? "Add Stock"
                    : movementType === "out"
                    ? "Remove Stock"
                    : "Set Stock Level"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;