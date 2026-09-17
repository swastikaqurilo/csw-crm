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
        className: "badge badge-danger",
      };
    }

    if (quantity <= reorderLevel) {
      return {
        label: "Low Stock",
        className: "badge badge-warning",
      };
    }

    return {
      label: "In Stock",
      className: "badge badge-success",
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

  return (
    <div className="inventory-page">
      {/* PAGE HEADING */}
      <div className="page-heading">
        <div>
          <h1>Inventory</h1>
          <p>
            Track wire stock, warehouse quantities
            and inventory movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              openMovementModal("out")
            }
          >
            <ArrowUpFromLine size={17} />
            Stock Out
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              openMovementModal("in")
            }
          >
            <Plus size={17} />
            Stock In
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchInventory}
            title="Refresh"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "products-spin"
                  : ""
              }
            />
          </button>
        </div>
      </div>

      {/* ALERTS */}

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />

          <div>
            <strong>
              Something went wrong
            </strong>

            <div>{error}</div>
          </div>

          <button
            type="button"
            className="table-action"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <div>
            <strong>{success}</strong>
          </div>

          <button
            type="button"
            className="table-action"
            onClick={() => setSuccess("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* INVENTORY STATS */}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <Package size={19} />
            </div>
          </div>

          <div className="stat-value">
            {inventory.length}
          </div>

          <div className="stat-title">
            Inventory Records
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <Warehouse size={19} />
            </div>
          </div>

          <div className="stat-value">
            {formatNumber(totalItems)}
          </div>

          <div className="stat-title">
            Total Stock Units
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <AlertTriangle size={19} />
            </div>
          </div>

          <div className="stat-value">
            {lowStockItems.length}
          </div>

          <div className="stat-title">
            Low Stock Items
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <IndianRupee size={19} />
            </div>
          </div>

          <div className="stat-value">
            {formatCurrency(totalStockValue)}
          </div>

          <div className="stat-title">
            Inventory Value
          </div>
        </div>
      </div>

      {/* LOW STOCK ALERT */}

      {lowStockItems.length > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={18} />

          <div>
            <strong>
              {lowStockItems.length} inventory
              record
              {lowStockItems.length !== 1
                ? "s"
                : ""}{" "}
              need attention
            </strong>

            <div>
              Stock is at or below the
              configured reorder level.
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY TABLE */}

      <div className="enquiries-card">
        <div className="enquiries-toolbar">
          <div className="enquiry-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search inventory..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="enquiry-filters">
            <select
              className="filter-select"
              value={warehouseFilter}
              onChange={(event) =>
                setWarehouseFilter(
                  event.target.value
                )
              }
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
              className="filter-select"
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(
                  event.target.value
                )
              }
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
              className="btn btn-primary"
              onClick={openAddInventoryModal}
            >
              <Plus size={16} />
              Add Inventory
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw
              size={32}
              className="products-spin"
            />

            <h4>
              Loading inventory...
            </h4>

            <p>
              Fetching inventory records.
            </p>
          </div>
        ) : filteredInventory.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>WAREHOUSE</th>
                  <th>AVAILABLE</th>
                  <th>REORDER LEVEL</th>
                  <th>STOCK VALUE</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredInventory.map(
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
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar avatar-md">
                              {productName
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="enquiry-person">
                              <strong>
                                {productName}
                              </strong>

                              <span>
                                {productCode}

                                {product?.diameter
                                  ? ` · ${product.diameter} mm`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="enquiry-person">
                            <strong>
                              {item.warehouse ||
                                "Main"}
                            </strong>

                            {item.location && (
                              <span>
                                {item.location}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <strong>
                            {formatNumber(
                              item.quantity
                            )}
                          </strong>{" "}
                          <span className="text-muted">
                            {unit}
                          </span>
                        </td>

                        <td>
                          <span className="text-muted">
                            {formatNumber(
                              item.reorderLevel
                            )}{" "}
                            {unit}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {formatCurrency(
                              Number(
                                item.quantity || 0
                              ) * price
                            )}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              stockStatus.className
                            }
                          >
                            {stockStatus.label}
                          </span>
                        </td>

                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="table-action"
                              title="Stock In"
                              onClick={() =>
                                openMovementModal(
                                  "in",
                                  item._id
                                )
                              }
                            >
                              <ArrowDownToLine
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              className="table-action"
                              title="Stock Out"
                              onClick={() =>
                                openMovementModal(
                                  "out",
                                  item._id
                                )
                              }
                            >
                              <ArrowUpFromLine
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              className="table-action"
                              title="Edit"
                              onClick={() =>
                                openEditInventoryModal(
                                  item
                                )
                              }
                            >
                              <Pencil
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              className="table-action"
                              title="Delete"
                              onClick={() =>
                                handleDelete(item)
                              }
                            >
                              <Trash2
                                size={15}
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
          <div className="empty-state">
            <Warehouse size={38} />

            <h4>
              No inventory found
            </h4>

            <p>
              Try changing your search or
              filter options.
            </p>
          </div>
        )}

        {filteredInventory.length > 0 && (
          <div className="pagination">
            <span>
              Showing{" "}
              {filteredInventory.length} of{" "}
              {inventory.length} records
            </span>

            <span>
              Inventory value:{" "}
              <strong>
                {formatCurrency(
                  totalStockValue
                )}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* RECENT INVENTORY RECORDS */}

      <div className="card">
        <div className="card-header">
          <div>
            <h3>
              Inventory Overview
            </h3>
          </div>

          <History size={19} />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>BATCH</th>
                <th>WAREHOUSE</th>
                <th>QUANTITY</th>
                <th>UPDATED</th>
              </tr>
            </thead>

            <tbody>
              {inventory
                .slice(0, 5)
                .map((item) => (
                  <tr
                    key={item._id}
                  >
                    <td>
                      <div className="enquiry-person">
                        <strong>
                          {getProductName(
                            item
                          )}
                        </strong>

                        <span>
                          {getProductCode(
                            item
                          )}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="text-muted">
                        {item.batchNumber ||
                          "—"}
                      </span>
                    </td>

                    <td>
                      <span className="text-muted">
                        {item.warehouse ||
                          "Main"}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {formatNumber(
                          item.quantity
                        )}
                      </strong>{" "}
                      <span className="text-muted">
                        {getProductUnit(
                          item
                        )}
                      </span>
                    </td>

                    <td>
                      <span className="text-muted">
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
                    <div className="empty-state">
                      <History size={32} />

                      <h4>
                        No inventory records
                      </h4>

                      <p>
                        Inventory records
                        will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          ADD / EDIT INVENTORY MODAL
      ========================================================= */}

      {isInventoryModalOpen && (
        <div
          className="contact-modal-overlay"
          onClick={closeInventoryModal}
        >
          <div
            className="contact-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="contact-modal-header">
              <div>
                <h2>
                  {editingInventory
                    ? "Edit Inventory"
                    : "Add Inventory"}
                </h2>

                <p>
                  {editingInventory
                    ? "Update inventory record details."
                    : "Create a new inventory record."}
                </p>
              </div>

              <button
                type="button"
                className="contact-modal-close"
                onClick={closeInventoryModal}
              >
                <X size={17} />
              </button>
            </div>

            <form
              onSubmit={
                handleInventorySubmit
              }
            >
              <div className="contact-form-grid">
                <div className="contact-form-group">
                  <label>
                    Product <span>*</span>
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

                <div className="contact-form-group">
                  <label>
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
                  />
                </div>

                <div className="contact-form-group">
                  <label>
                    Quantity{" "}
                    {!editingInventory && (
                      <span>*</span>
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
                  />
                </div>

                <div className="contact-form-group">
                  <label>
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
                  />
                </div>

                <div className="contact-form-group">
                  <label>
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
                  />
                </div>

                <div className="contact-form-group">
                  <label>
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
                  />
                </div>

                <div className="contact-form-group">
                  <label>
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
                  />
                </div>

                <div className="contact-form-group full-width">
                  <label>
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    placeholder="Add inventory notes..."
                    value={
                      formData.notes
                    }
                    onChange={
                      handleFormChange
                    }
                  />
                </div>
              </div>

              <div className="contact-modal-footer">
                <button
                  type="button"
                  className="contact-cancel-btn"
                  onClick={
                    closeInventoryModal
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="contact-save-btn"
                >
                  <Save size={15} />

                  <p>{editingInventory
                    ? "Save Changes"
                    : "Create Inventory"}</p>
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
          className="contact-modal-overlay"
          onClick={closeMovementModal}
        >
          <div
            className="contact-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="contact-modal-header">
              <div>
                <h2>
                  {movementType === "in"
                    ? "Stock In"
                    : movementType ===
                      "out"
                    ? "Stock Out"
                    : "Stock Adjustment"}
                </h2>

                <p>
                  Record a stock movement
                  against an inventory
                  record.
                </p>
              </div>

              <button
                type="button"
                className="contact-modal-close"
                onClick={
                  closeMovementModal
                }
              >
                <X size={17} />
              </button>
            </div>

            <form
              onSubmit={handleMovement}
            >
              <div className="contact-form-grid">
                <div className="contact-form-group full-width">
                  <label>
                    Movement Type
                  </label>

                  <select
                    value={movementType}
                    onChange={(event) =>
                      setMovementType(
                        event.target.value
                      )
                    }
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

                <div className="contact-form-group full-width">
                  <label>
                    Inventory Record{" "}
                    <span>*</span>
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
                  <div className="contact-form-group full-width">
                    <label>
                      Current Stock
                    </label>

                    <input
                      type="text"
                      value={`${formatNumber(
                        selectedInventory.quantity
                      )} ${getProductUnit(
                        selectedInventory
                      )}`}
                      disabled
                    />
                  </div>
                )}

                <div className="contact-form-group full-width">
                  <label>
                    {movementType ===
                    "adjustment"
                      ? "New Stock Level"
                      : "Quantity"}{" "}
                    <span>*</span>
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
                  />
                </div>

                <div className="contact-form-group">
                  <label>
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
                  />
                </div>

                <div className="contact-form-group">
                  <label>
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
                  />
                </div>
              </div>

              <div className="contact-modal-footer">
                <button
                  type="button"
                  className="contact-cancel-btn"
                  onClick={
                    closeMovementModal
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="contact-save-btn"
                >
                  {movementType ===
                  "in" ? (
                    <ArrowDownToLine
                      size={15}
                    />
                  ) : (
                    <ArrowUpFromLine
                      size={15}
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