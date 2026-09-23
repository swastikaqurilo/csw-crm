  import { useEffect, useMemo, useState } from "react";
  import {
    Warehouse,
    Package,
    AlertTriangle,
    IndianRupee,
    Search,
    Plus,
    ArrowDownToLine,
    ArrowUpFromLine,
    History,
    Pencil,
    Trash2,
    X,
    RefreshCw,
    Save,
  } from "lucide-react";

  import {
    getInventory,
    createInventory,
    updateInventory,
    adjustStock,
    deleteInventory,
    getProducts,
  } from "../api/api";

  function Inventory() {
    const [inventory, setInventory] = useState([]);
    const [products, setProducts] = useState([]);

    const [loading, setLoading] = useState(true);
    const [productsLoading, setProductsLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [search, setSearch] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("All");
    const [stockFilter, setStockFilter] = useState("All");

    const [currentPage, setCurrentPage] = useState(1);
    const INVENTORY_PER_PAGE = 8;

    const [isMovementModalOpen, setIsMovementModalOpen] =
      useState(false);

    const [isInventoryModalOpen, setIsInventoryModalOpen] =
      useState(false);

    const [editingInventory, setEditingInventory] =
      useState(null);

    const [movementType, setMovementType] = useState("in");
    const [selectedInventoryId, setSelectedInventoryId] =
      useState("");
    const [movementQuantity, setMovementQuantity] =
      useState("");
    const [movementReason, setMovementReason] =
      useState("");
    const [movementNotes, setMovementNotes] =
      useState("");

    const [formData, setFormData] = useState({
      product: "",
      warehouse: "Main",
      quantity: "",
      reorderLevel: "",
      batchNumber: "",
      unit: "kg",
      location: "",
      notes: "",
    });

    const fetchInventory = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await getInventory({
          limit: 100,
        });

        setInventory(response.data?.data || []);
      } catch (err) {
        console.error("Failed to fetch inventory:", err);

        setError(
          err.response?.data?.message ||
            "Failed to load inventory."
        );
      } finally {
        setLoading(false);
      }
    };

    const fetchProducts = async () => {
      try {
        setProductsLoading(true);

        const response = await getProducts({
          limit: 100,
        });

        setProducts(response.data?.data || []);
      } catch (err) {
        console.error("Failed to fetch products:", err);

        setError(
          err.response?.data?.message ||
            "Failed to load products."
        );
      } finally {
        setProductsLoading(false);
      }
    };

    useEffect(() => {
      fetchInventory();
      fetchProducts();
    }, []);

    const getProduct = (item) => {
      if (!item?.product) return null;

      if (typeof item.product === "object") {
        return item.product;
      }

      return products.find(
        (product) => product._id === item.product
      );
    };

    const getProductName = (item) => {
      const product = getProduct(item);
      return product?.name || "Unknown Product";
    };

    const getProductCode = (item) => {
      const product = getProduct(item);

      return (
        product?.productCode ||
        product?.code ||
        "—"
      );
    };

    const getProductPrice = (item) => {
      const product = getProduct(item);

      return Number(product?.price || 0);
    };

    const getProductUnit = (item) => {
      const product = getProduct(item);

      return (
        item?.unit ||
        product?.unit ||
        "kg"
      );
    };

    const formatCurrency = (value) => {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(Number(value) || 0);
    };

    const formatNumber = (value) => {
      return Number(value || 0).toLocaleString("en-IN");
    };

    const getStockStatus = (item) => {
      const quantity = Number(item.quantity || 0);
      const reorderLevel = Number(
        item.reorderLevel || 0
      );

      if (quantity === 0) {
        return {
          label: "Out of Stock",
          type: "danger",
        };
      }

      if (quantity <= reorderLevel) {
        return {
          label: "Low Stock",
          type: "warning",
        };
      }

      return {
        label: "In Stock",
        type: "success",
      };
    };

    const warehouses = useMemo(() => {
      return [
        ...new Set(
          inventory
            .map((item) => item.warehouse)
            .filter(Boolean)
        ),
      ];
    }, [inventory]);

    const filteredInventory = useMemo(() => {
      const query = search.toLowerCase().trim();

      return inventory.filter((item) => {
        const product = getProduct(item);

        const productName =
          product?.name?.toLowerCase() || "";

        const productCode =
          (
            product?.productCode ||
            product?.code ||
            ""
          ).toLowerCase();

        const batchNumber =
          item.batchNumber?.toLowerCase() || "";

        const location =
          item.location?.toLowerCase() || "";

        const warehouse =
          item.warehouse?.toLowerCase() || "";

        const matchesSearch =
          !query ||
          productName.includes(query) ||
          productCode.includes(query) ||
          batchNumber.includes(query) ||
          location.includes(query) ||
          warehouse.includes(query);

        const matchesWarehouse =
          warehouseFilter === "All" ||
          item.warehouse === warehouseFilter;

        const quantity = Number(item.quantity || 0);
        const reorderLevel = Number(
          item.reorderLevel || 0
        );

        const isLowStock =
          quantity <= reorderLevel;

        const matchesStock =
          stockFilter === "All" ||
          (stockFilter === "Low" && isLowStock) ||
          (stockFilter === "Healthy" && !isLowStock);

        return (
          matchesSearch &&
          matchesWarehouse &&
          matchesStock
        );
      });
    }, [
      inventory,
      products,
      search,
      warehouseFilter,
      stockFilter,
    ]);

    const totalPages = Math.ceil(
    filteredInventory.length / INVENTORY_PER_PAGE
  );

  const paginatedInventory = useMemo(() => {
    const startIndex =
      (currentPage - 1) * INVENTORY_PER_PAGE;

    return filteredInventory.slice(
      startIndex,
      startIndex + INVENTORY_PER_PAGE
    );
  }, [filteredInventory, currentPage]);

  const paginationStart =
    filteredInventory.length === 0
      ? 0
      : (currentPage - 1) * INVENTORY_PER_PAGE + 1;

  const paginationEnd = Math.min(
    currentPage * INVENTORY_PER_PAGE,
    filteredInventory.length
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, warehouseFilter, stockFilter]);

    const totalItems = inventory.reduce(
      (total, item) =>
        total + Number(item.quantity || 0),
      0
    );

    const lowStockItems = inventory.filter(
      (item) =>
        Number(item.quantity || 0) <=
        Number(item.reorderLevel || 0)
    );

    const totalStockValue = inventory.reduce(
      (total, item) => {
        const price = getProductPrice(item);

        return (
          total +
          Number(item.quantity || 0) * price
        );
      },
      0
    );

    const resetForm = () => {
      setFormData({
        product: "",
        warehouse: "Main",
        quantity: "",
        reorderLevel: "",
        batchNumber: "",
        unit: "kg",
        location: "",
        notes: "",
      });

      setEditingInventory(null);
    };

    const openAddInventoryModal = () => {
      resetForm();
      setIsInventoryModalOpen(true);
    };

    const openEditInventoryModal = (item) => {
      setEditingInventory(item);

      setFormData({
        product:
          typeof item.product === "object"
            ? item.product._id
            : item.product || "",

        warehouse: item.warehouse || "Main",
        quantity: item.quantity ?? "",
        reorderLevel: item.reorderLevel ?? "",
        batchNumber: item.batchNumber || "",
        unit: item.unit || "kg",
        location: item.location || "",
        notes: item.notes || "",
      });

      setIsInventoryModalOpen(true);
    };

    const closeInventoryModal = () => {
      setIsInventoryModalOpen(false);
      resetForm();
    };

    const handleFormChange = (event) => {
      const { name, value } = event.target;

      setFormData((previous) => ({
        ...previous,
        [name]: value,
      }));
    };

    const handleInventorySubmit = async (event) => {
      event.preventDefault();

      try {
        setError("");
        setSuccess("");

        const payload = {
          product: formData.product,
          warehouse: formData.warehouse,
          quantity: Number(formData.quantity || 0),
          reorderLevel: Number(
            formData.reorderLevel || 0
          ),
          batchNumber:
            formData.batchNumber.trim() || undefined,
          unit: formData.unit.trim() || "kg",
          location:
            formData.location.trim() || undefined,
          notes:
            formData.notes.trim() || undefined,
        };

        if (editingInventory) {
          await updateInventory(
            editingInventory._id,
            {
              warehouse: payload.warehouse,
              reorderLevel: payload.reorderLevel,
              batchNumber: payload.batchNumber,
              unit: payload.unit,
              location: payload.location,
              notes: payload.notes,
            }
          );

          setSuccess(
            "Inventory updated successfully."
          );
        } else {
          await createInventory(payload);

          setSuccess(
            "Inventory record created successfully."
          );
        }

        closeInventoryModal();
        await fetchInventory();
      } catch (err) {
        console.error(
          "Failed to save inventory:",
          err
        );

        setError(
          err.response?.data?.message ||
            "Failed to save inventory."
        );
      }
    };

    const openMovementModal = (
      type = "in",
      inventoryId = ""
    ) => {
      setMovementType(type);
      setSelectedInventoryId(inventoryId);
      setMovementQuantity("");
      setMovementReason("");
      setMovementNotes("");
      setIsMovementModalOpen(true);
    };

    const closeMovementModal = () => {
      setIsMovementModalOpen(false);
      setSelectedInventoryId("");
      setMovementQuantity("");
      setMovementReason("");
      setMovementNotes("");
    };

    const handleMovement = async (event) => {
      event.preventDefault();

      const quantity = Number(movementQuantity);

      if (
        !selectedInventoryId ||
        quantity <= 0
      ) {
        return;
      }

      try {
        setError("");
        setSuccess("");

        await adjustStock(
          selectedInventoryId,
          {
            type: movementType,
            quantity,
            reason:
              movementReason.trim() || undefined,
            notes:
              movementNotes.trim() || undefined,
          }
        );

        setSuccess(
          movementType === "in"
            ? "Stock added successfully."
            : movementType === "out"
            ? "Stock removed successfully."
            : "Stock adjusted successfully."
        );

        closeMovementModal();
        await fetchInventory();
      } catch (err) {
        console.error(
          "Failed to adjust stock:",
          err
        );

        setError(
          err.response?.data?.message ||
            "Failed to adjust stock."
        );
      }
    };

    const handleDelete = async (item) => {
      const productName = getProductName(item);

      const confirmed = window.confirm(
        `Delete inventory record for ${productName}?`
      );

      if (!confirmed) return;

      try {
        setError("");
        setSuccess("");

        await deleteInventory(item._id);

        setSuccess(
          "Inventory record deleted successfully."
        );

        await fetchInventory();
      } catch (err) {
        console.error(
          "Failed to delete inventory:",
          err
        );

        setError(
          err.response?.data?.message ||
            "Failed to delete inventory."
        );
      }
    };

    const selectedInventory =
      inventory.find(
        (item) =>
          item._id === selectedInventoryId
      );

    const inputClass =
      "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

    const labelClass =
      "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";

    return (
      <div className="w-full space-y-5 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
              Inventory
            </h1>

            <p className="mt-1 text-[13px] text-black">
              Track wire stock, warehouse quantities
              and inventory movements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                openMovementModal("out")
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowUpFromLine size={16} />
              Stock Out
            </button>

            <button
              type="button"
              onClick={() =>
                openMovementModal("in")
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0f172a] px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              <Plus size={16} />
              Stock In
            </button>

            <button
              type="button"
              onClick={fetchInventory}
              title="Refresh"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <RefreshCw
                size={15}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
            </button>
          </div>
        </div>
        
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">
                Something went wrong
              </p>

              <p className="mt-0.5 text-xs leading-5 text-red-600">
                {error}
              </p>
            </div>

            <button
              type="button"
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
              <p className="text-xs font-semibold">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="rounded-md p-1 text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* =========================================================
            KPI CARDS
        ========================================================= */}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a]">
                <Package size={18} />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[22px] font-semibold tracking-tight !text-black">
                {inventory.length}
              </p>

              <p className="mt-0.5 text-[11px] font-medium text-black">
                Inventory Records
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a]">
                <Warehouse size={18} />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[22px] font-semibold tracking-tight !text-black">
                {formatNumber(totalItems)}
              </p>

              <p className="mt-0.5 text-[11px] font-medium text-black">
                Total Stock Units
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle size={18} />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[22px] font-semibold tracking-tight !text-black">
                {lowStockItems.length}
              </p>

              <p className="mt-0.5 text-[11px] font-medium text-black">
                Low Stock Items
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a]">
                <IndianRupee size={18} />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[22px] font-semibold tracking-tight !text-black">
                {formatCurrency(totalStockValue)}
              </p>

              <p className="mt-0.5 text-[11px] font-medium text-black">
                Inventory Value
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================
            LOW STOCK ALERT
        ========================================================= */}

        {lowStockItems.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <AlertTriangle size={16} />
            </div>

            <div>
              <p className="text-xs font-semibold text-amber-900">
                {lowStockItems.length} inventory record
                {lowStockItems.length !== 1
                  ? "s"
                  : ""}{" "}
                need attention
              </p>

              <p className="mt-0.5 text-xs text-amber-700">
                Stock is at or below the configured
                reorder level.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================
            INVENTORY TABLE
        ========================================================= */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* TOOLBAR */}

          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 xl:flex-row xl:items-center xl:justify-between">

            <div className="relative w-full xl:max-w-[320px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                placeholder="Search inventory..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={warehouseFilter}
                onChange={(event) =>
                  setWarehouseFilter(
                    event.target.value
                  )
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition-all focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="All">
                  All Warehouses
                </option>

                {warehouses.map(
                  (warehouse) => (
                    <option
                      key={warehouse}
                      value={warehouse}
                    >
                      {warehouse}
                    </option>
                  )
                )}
              </select>

              <select
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(
                    event.target.value
                  )
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition-all focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="All">
                  All Stock
                </option>

                <option value="Healthy">
                  Healthy
                </option>

                <option value="Low">
                  Low Stock
                </option>
              </select>

              <button
                type="button"
                onClick={openAddInventoryModal}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-3.5 text-xs font-semibold text-white transition-all hover:bg-slate-800"
              >
                <Plus size={15} />
                Add Inventory
              </button>
            </div>
          </div>

          {/* TABLE CONTENT */}

          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <RefreshCw
                size={28}
                className="animate-spin text-slate-400"
              />

              <h4 className="mt-3 text-sm font-semibold text-slate-800">
                Loading inventory...
              </h4>

              <p className="mt-1 text-xs text-black">
                Fetching inventory records.
              </p>
            </div>
          ) : filteredInventory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                      Product
                    </th>

                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                      Warehouse
                    </th>

                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                      Available
                    </th>

                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                      Reorder Level
                    </th>

                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                      Stock Value
                    </th>

                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                      Status
                    </th>

                    <th className="w-[150px] px-4 py-3"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedInventory.map(
                    (item) => {
                      const productName =
                        getProductName(item);

                      const productCode =
                        getProductCode(item);

                      const product =
                        getProduct(item);

                      const stockStatus =
                        getStockStatus(item);

                      const price =
                        getProductPrice(item);

                      const unit =
                        getProductUnit(item);

                      return (
                        <tr
                          key={item._id}
                          className="group transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-[#0f172a]">
                                {productName
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-black">
                                  {productName}
                                </p>

                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {productCode}

                                  {product?.diameter
                                    ? ` · ${product.diameter} mm`
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-xs font-semibold text-slate-700">
                                {item.warehouse ||
                                  "Main"}
                              </p>

                              {item.location && (
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {item.location}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="text-xs font-semibold text-slate-800">
                              {formatNumber(
                                item.quantity
                              )}
                            </span>{" "}
                            <span className="text-[10px] text-slate-400">
                              {unit}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="text-xs text-black">
                              {formatNumber(
                                item.reorderLevel
                              )}
                            </span>{" "}
                            <span className="text-[10px] text-slate-400">
                              {unit}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="text-xs font-semibold text-slate-800">
                              {formatCurrency(
                                Number(
                                  item.quantity || 0
                                ) * price
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            {stockStatus.type ===
                            "danger" ? (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600">
                                {stockStatus.label}
                              </span>
                            ) : stockStatus.type ===
                              "warning" ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
                                {stockStatus.label}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
                                {stockStatus.label}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                title="Stock In"
                                onClick={() =>
                                  openMovementModal(
                                    "in",
                                    item._id
                                  )
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md text-black transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <ArrowDownToLine
                                  size={14}
                                />
                              </button>

                              <button
                                type="button"
                                title="Stock Out"
                                onClick={() =>
                                  openMovementModal(
                                    "out",
                                    item._id
                                  )
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md text-black transition-colors hover:bg-amber-50 hover:text-amber-600"
                              >
                                <ArrowUpFromLine
                                  size={14}
                                />
                              </button>

                              <button
                                type="button"
                                title="Edit"
                                onClick={() =>
                                  openEditInventoryModal(
                                    item
                                  )
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md text-black transition-colors hover:bg-slate-100 hover:text-[#0f172a]"
                              >
                                <Pencil
                                  size={14}
                                />
                              </button>

                              <button
                                type="button"
                                title="Delete"
                                onClick={() =>
                                  handleDelete(item)
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md text-black transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2
                                  size={14}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Warehouse size={25} />
              </div>

              <h4 className="mt-3 text-sm font-semibold text-slate-800">
                No inventory found
              </h4>

              <p className="mt-1 max-w-xs text-xs leading-5 text-black">
                Try changing your search or filter
                options.
              </p>
            </div>
          )}

          {totalPages > 1 && (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-black">
        Showing{" "}
        <span className="font-semibold text-slate-700">
          {paginationStart}
        </span>{" "}
        to{" "}
        <span className="font-semibold text-slate-700">
          {paginationEnd}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-slate-700">
          {filteredInventory.length}
        </span>{" "}
        records
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() =>
            setCurrentPage((page) =>
              Math.max(page - 1, 1)
            )
          }
          className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        {Array.from(
          { length: totalPages },
          (_, index) => index + 1
        ).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => setCurrentPage(page)}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition-colors ${
              currentPage === page
                ? "bg-[#0f172a] text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() =>
            setCurrentPage((page) =>
              Math.min(page + 1, totalPages)
            )
          }
          className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )}

          {/* TABLE FOOTER */}

          {filteredInventory.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-[11px] text-black sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing{" "}
                <strong className="font-semibold text-slate-700">
                  {filteredInventory.length}
                </strong>{" "}
                of{" "}
                <strong className="font-semibold text-slate-700">
                  {inventory.length}
                </strong>{" "}
                records
              </span>

              <span>
                Inventory value:{" "}
                <strong className="font-semibold text-slate-800">
                  {formatCurrency(
                    totalStockValue
                  )}
                </strong>
              </span>
            </div>
          )}
        </section>

        {/* =========================================================
            INVENTORY OVERVIEW
        ========================================================= */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
            <div>
              <h3 className="text-sm font-semibold text-black">
                Inventory Overview
              </h3>

              <p className="mt-0.5 text-[11px] text-black">
                Recently updated inventory records
              </p>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-black">
              <History size={16} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                    Product
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                    Batch
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                    Warehouse
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                    Quantity
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-black">
                    Updated
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {inventory
                  .slice(0, 5)
                  .map((item) => (
                    <tr
                      key={item._id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {getProductName(
                              item
                            )}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {getProductCode(
                              item
                            )}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-xs text-black">
                          {item.batchNumber ||
                            "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-xs text-black">
                          {item.warehouse ||
                            "Main"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <strong className="text-xs font-semibold text-slate-800">
                          {formatNumber(
                            item.quantity
                          )}
                        </strong>{" "}
                        <span className="text-[10px] text-slate-400">
                          {getProductUnit(
                            item
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-xs text-black">
                          {item.updatedAt
                            ? new Date(
                                item.updatedAt
                              ).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}

                {inventory.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <div className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center">
                        <History
                          size={28}
                          className="text-slate-300"
                        />

                        <h4 className="mt-3 text-sm font-semibold text-slate-700">
                          No inventory records
                        </h4>

                        <p className="mt-1 text-xs text-black">
                          Inventory records will
                          appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* =========================================================
            ADD / EDIT INVENTORY MODAL
        ========================================================= */}

        {isInventoryModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            onClick={closeInventoryModal}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* MODAL HEADER */}

              <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {editingInventory
                      ? "Edit Inventory"
                      : "Add Inventory"}
                  </h2>

                  <p className="mt-1 text-xs text-black">
                    {editingInventory
                      ? "Update inventory record details."
                      : "Create a new inventory record."}
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

              {/* MODAL FORM */}

              <form
                onSubmit={
                  handleInventorySubmit
                }
                className="max-h-[calc(90vh-130px)] overflow-y-auto"
              >
                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">

                  <div>
                    <label className={labelClass}>
                      Product <span className="text-red-500">*</span>
                    </label>

                    <select
                      name="product"
                      value={formData.product}
                      onChange={
                        handleFormChange
                      }
                      required
                      disabled={
                        !!editingInventory ||
                        productsLoading
                      }
                      className={inputClass}
                    >
                      <option value="">
                        {productsLoading
                          ? "Loading products..."
                          : "Select product"}
                      </option>

                      {products.map(
                        (product) => (
                          <option
                            key={
                              product._id
                            }
                            value={
                              product._id
                            }
                          >
                            {product.name} —{" "}
                            {product.productCode ||
                              product.code ||
                              "No code"}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Warehouse
                    </label>

                    <input
                      type="text"
                      name="warehouse"
                      placeholder="e.g. Main"
                      value={
                        formData.warehouse
                      }
                      onChange={
                        handleFormChange
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Quantity{" "}
                      {!editingInventory && (
                        <span className="text-red-500">
                          *
                        </span>
                      )}
                    </label>

                    <input
                      type="number"
                      name="quantity"
                      min="0"
                      placeholder="Enter quantity"
                      value={
                        formData.quantity
                      }
                      onChange={
                        handleFormChange
                      }
                      disabled={
                        !!editingInventory
                      }
                      required={
                        !editingInventory
                      }
                      className={inputClass}
                    />

                    {editingInventory && (
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        Use Stock In or Stock Out to
                        change the current quantity.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      Reorder Level
                    </label>

                    <input
                      type="number"
                      name="reorderLevel"
                      min="0"
                      placeholder="e.g. 100"
                      value={
                        formData.reorderLevel
                      }
                      onChange={
                        handleFormChange
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Unit
                    </label>

                    <input
                      type="text"
                      name="unit"
                      placeholder="e.g. kg"
                      value={
                        formData.unit
                      }
                      onChange={
                        handleFormChange
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Batch Number
                    </label>

                    <input
                      type="text"
                      name="batchNumber"
                      placeholder="e.g. BATCH-001"
                      value={
                        formData.batchNumber
                      }
                      onChange={
                        handleFormChange
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Location
                    </label>

                    <input
                      type="text"
                      name="location"
                      placeholder="e.g. Rack A-01"
                      value={
                        formData.location
                      }
                      onChange={
                        handleFormChange
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Notes
                    </label>

                    <textarea
                      name="notes"
                      rows="3"
                      placeholder="Add inventory notes..."
                      value={
                        formData.notes
                      }
                      onChange={
                        handleFormChange
                      }
                      className={`${inputClass} h-auto min-h-[84px] resize-none py-2.5`}
                    />
                  </div>
                </div>

                {/* MODAL FOOTER */}

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={
                      closeInventoryModal
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    <Save size={14} />

                    {editingInventory
                      ? "Save Changes"
                      : "Create Inventory"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            STOCK MOVEMENT MODAL
        ========================================================= */}

        {isMovementModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            onClick={closeMovementModal}
          >
            <div
              className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* MODAL HEADER */}

              <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        movementType === "in"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {movementType ===
                      "in" ? (
                        <ArrowDownToLine
                          size={16}
                        />
                      ) : (
                        <ArrowUpFromLine
                          size={16}
                        />
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-slate-900">
                      {movementType === "in"
                        ? "Stock In"
                        : movementType ===
                          "out"
                        ? "Stock Out"
                        : "Stock Adjustment"}
                    </h2>
                  </div>

                  <p className="mt-2 text-xs text-black">
                    Record a stock movement against
                    an inventory record.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeMovementModal
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={17} />
                </button>
              </div>

              {/* MOVEMENT FORM */}

              <form
                onSubmit={handleMovement}
                className="max-h-[calc(90vh-130px)] overflow-y-auto"
              >
                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">

                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Movement Type
                    </label>

                    <select
                      value={movementType}
                      onChange={(event) =>
                        setMovementType(
                          event.target.value
                        )
                      }
                      className={inputClass}
                    >
                      <option value="in">
                        Stock In
                      </option>

                      <option value="out">
                        Stock Out
                      </option>

                      <option value="adjustment">
                        Set Stock Level
                      </option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Inventory Record{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <select
                      value={
                        selectedInventoryId
                      }
                      onChange={(event) =>
                        setSelectedInventoryId(
                          event.target.value
                        )
                      }
                      required
                      className={inputClass}
                    >
                      <option value="">
                        Select inventory
                      </option>

                      {inventory.map(
                        (item) => (
                          <option
                            key={
                              item._id
                            }
                            value={
                              item._id
                            }
                          >
                            {getProductName(
                              item
                            )}{" "}
                            —{" "}
                            {formatNumber(
                              item.quantity
                            )}{" "}
                            {getProductUnit(
                              item
                            )}{" "}
                            available
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {selectedInventory && (
                    <div className="sm:col-span-2">
                      <label className={labelClass}>
                        Current Stock
                      </label>

                      <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
                        <span className="text-sm font-semibold text-[#0f172a]">
                          {formatNumber(
                            selectedInventory.quantity
                          )}
                        </span>

                        <span className="ml-1.5 text-xs text-black">
                          {getProductUnit(
                            selectedInventory
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      {movementType ===
                      "adjustment"
                        ? "New Stock Level"
                        : "Quantity"}{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      type="number"
                      min="0"
                      placeholder={
                        movementType ===
                        "adjustment"
                          ? "Enter new stock level"
                          : "Enter quantity"
                      }
                      value={
                        movementQuantity
                      }
                      onChange={(event) =>
                        setMovementQuantity(
                          event.target.value
                        )
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Reason
                    </label>

                    <input
                      type="text"
                      placeholder="e.g. Purchase order"
                      value={
                        movementReason
                      }
                      onChange={(event) =>
                        setMovementReason(
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Notes
                    </label>

                    <input
                      type="text"
                      placeholder="Optional notes"
                      value={
                        movementNotes
                      }
                      onChange={(event) =>
                        setMovementNotes(
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* MOVEMENT FOOTER */}

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={
                      closeMovementModal
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white transition-colors ${
                      movementType === "in"
                        ? "bg-[#0f172a] hover:bg-slate-800"
                        : "bg-[#0f172a] hover:bg-slate-800"
                    }`}
                  >
                    {movementType ===
                    "in" ? (
                      <ArrowDownToLine
                        size={14}
                      />
                    ) : (
                      <ArrowUpFromLine
                        size={14}
                      />
                    )}

                    Record Movement
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