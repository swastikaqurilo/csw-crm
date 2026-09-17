import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Package,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  ChevronRight,
  Tag,
  CircleDollarSign,
  Layers3,
  AlertCircle,
} from "lucide-react";

import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../api/api";

const EMPTY_FORM = {
  name: "",
  productCode: "",
  category: "",
  description: "",
  material: "Steel",
  diameter: "",
  diameterUnit: "mm",
  unit: "Kg",
  price: "",
  currency: "INR",
  status: "Active",
};

const getId = (product) => product?._id || product?.id;

const formatCurrency = (value, currency = "INR") => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toLocaleString("en-IN")}`;
  }
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [status, setStatus] = useState("All Status");

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getProducts();
      const data = response?.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Invalid products response.");
      }

      setProducts(data);

      setSelectedProduct((current) => {
        if (!current) return data[0] || null;

        const updated = data.find(
          (item) => getId(item) === getId(current)
        );

        return updated || data[0] || null;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load products."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [success]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name?.toLowerCase().includes(query) ||
        product.productCode?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.material?.toLowerCase().includes(query);

      const matchesCategory =
        category === "All Categories" ||
        product.category === category;

      const matchesStatus =
        status === "All Status" ||
        product.status === status;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, category, status]);

  const categories = useMemo(() => {
    const unique = [
      ...new Set(
        products
          .map((product) => product.category)
          .filter(Boolean)
      ),
    ];

    return ["All Categories", ...unique];
  }, [products]);

  const activeProducts = products.filter(
    (product) => product.status === "Active"
  ).length;

  const inactiveProducts = products.filter(
    (product) => product.status === "Inactive"
  ).length;

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);

    setForm({
      name: product.name || "",
      productCode: product.productCode || "",
      category: product.category || "",
      description: product.description || "",
      material: product.material || "Steel",
      diameter:
        product.diameter !== null &&
        product.diameter !== undefined
          ? String(product.diameter)
          : "",
      diameterUnit: product.diameterUnit || "mm",
      unit: product.unit || "Kg",
      price:
        product.price !== null &&
        product.price !== undefined
          ? String(product.price)
          : "",
      currency: product.currency || "INR",
      status: product.status || "Active",
    });

    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!form.productCode.trim()) {
      setError("Product code is required.");
      return;
    }

    if (!form.category.trim()) {
      setError("Category is required.");
      return;
    }

    if (form.price === "" || Number(form.price) < 0) {
      setError("Please enter a valid price.");
      return;
    }

    if (
      form.diameter !== "" &&
      (Number.isNaN(Number(form.diameter)) ||
        Number(form.diameter) < 0)
    ) {
      setError("Please enter a valid diameter.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      productCode: form.productCode.trim().toUpperCase(),
      category: form.category.trim(),
      description: form.description.trim(),
      material: form.material.trim() || "Steel",
      diameter:
        form.diameter === "" ? null : Number(form.diameter),
      diameterUnit: form.diameterUnit,
      unit: form.unit,
      price: Number(form.price),
      currency: form.currency.trim().toUpperCase() || "INR",
      status: form.status,
    };

    try {
      setSaving(true);

      let response;

      if (editingProduct) {
        response = await updateProduct(
          getId(editingProduct),
          payload
        );
      } else {
        response = await createProduct(payload);
      }

      const savedProduct = response?.data?.data;

      if (!savedProduct) {
        throw new Error("Invalid response from server.");
      }

      if (editingProduct) {
        setProducts((current) =>
          current.map((product) =>
            getId(product) === getId(savedProduct)
              ? savedProduct
              : product
          )
        );

        setSelectedProduct(savedProduct);
        setSuccess("Product updated successfully.");
      } else {
        setProducts((current) => [
          savedProduct,
          ...current,
        ]);

        setSelectedProduct(savedProduct);
        setSuccess("Product created successfully.");
      }

      closeModal();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save product."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    const productId = getId(product);

    if (!productId) {
      setError("Unable to delete this product.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${product.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      await deleteProduct(productId);

      const remaining = products.filter(
        (item) => getId(item) !== productId
      );

      setProducts(remaining);

      if (getId(selectedProduct) === productId) {
        setSelectedProduct(remaining[0] || null);
      }

      setSuccess("Product deleted successfully.");
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to delete product.")
      );
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    if (!filteredProducts.length) {
      setError("No products available to export.");
      return;
    }

    const headers = [
      "Product Name",
      "Product Code",
      "Category",
      "Material",
      "Diameter",
      "Diameter Unit",
      "Unit",
      "Price",
      "Currency",
      "Status",
      "Description",
    ];

    const escapeCSV = (value) => {
      const stringValue = String(value ?? "");

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const rows = filteredProducts.map((product) => [
      product.name,
      product.productCode,
      product.category,
      product.material,
      product.diameter ?? "",
      product.diameterUnit,
      product.unit,
      product.price,
      product.currency,
      product.status,
      product.description,
    ]);

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        row.map(escapeCSV).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "csw-products.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="products-page">
      {/* HEADER */}
      <div className="products-heading">
        <div>
          <div className="products-eyebrow">
            PRODUCT CATALOGUE
          </div>

          <h1>Products</h1>

          <p>
            Manage product specifications, pricing and availability.
          </p>
        </div>

        <div className="products-header-actions">
          <button
            type="button"
            className="products-icon-action"
            onClick={loadProducts}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={17} />
          </button>

          <button
            type="button"
            className="products-secondary-btn"
            onClick={exportCSV}
            disabled={!filteredProducts.length}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="products-primary-btn"
            onClick={openCreateModal}
          >
            <Plus size={17} />
            Add Product
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {error && (
        <div className="products-alert products-alert-error">
          <AlertCircleIcon />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="products-alert products-alert-success">
          <CheckCircle2 size={17} />
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* KPI ROW */}
      <div className="products-kpi-grid">
        <div className="products-kpi">
          <div className="products-kpi-icon">
            <Package size={18} />
          </div>

          <div>
            <span>Total Products</span>
            <strong>{products.length}</strong>
          </div>
        </div>

        <div className="products-kpi">
          <div className="products-kpi-icon">
            <CheckCircle2 size={18} />
          </div>

          <div>
            <span>Active</span>
            <strong>{activeProducts}</strong>
          </div>
        </div>

        <div className="products-kpi">
          <div className="products-kpi-icon">
            <XCircle size={18} />
          </div>

          <div>
            <span>Inactive</span>
            <strong>{inactiveProducts}</strong>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="products-workspace">
        {/* LEFT */}
        <section className="products-catalogue">
          {/* FILTER BAR */}
          <div className="products-toolbar">
            <div className="products-search">
              <Search size={17} />

              <input
                type="text"
                placeholder="Search by product, code or category..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* TABLE HEADER */}
          <div className="products-table-title">
            <div>
              <h2>Product Catalogue</h2>
              <span>
                {filteredProducts.length} result
                {filteredProducts.length !== 1
                  ? "s"
                  : ""}
              </span>
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <div className="products-empty">
              <RefreshCw
                size={22}
                className="products-spin"
              />
              <span>Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="products-empty">
              <Package size={28} />

              <strong>No products found</strong>

              <span>
                {products.length === 0
                  ? "Create your first product to get started."
                  : "Try adjusting your search or filters."}
              </span>

              {products.length === 0 && (
                <button
                  type="button"
                  className="products-primary-btn"
                  onClick={openCreateModal}
                >
                  <Plus size={16} />
                  Add Product
                </button>
              )}
            </div>
          ) : (
            <div className="products-table-wrap">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Code</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const selected =
                      getId(selectedProduct) ===
                      getId(product);

                    return (
                      <tr
                        key={getId(product)}
                        className={
                          selected
                            ? "product-row-selected"
                            : ""
                        }
                        onClick={() =>
                          setSelectedProduct(product)
                        }
                      >
                        <td>
                          <div className="product-name-cell">
                            <div className="product-mini-icon">
                              <Package size={16} />
                            </div>

                            <div>
                              <strong>
                                {product.name}
                              </strong>

                              <span>
                                {product.material ||
                                  "Steel"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="product-code">
                            {product.productCode}
                          </span>
                        </td>

                        <td>
                          {product.category || "—"}
                        </td>

                        <td>
                          {product.unit || "—"}
                        </td>

                        <td>
                          <strong className="product-price">
                            {formatCurrency(
                              product.price,
                              product.currency
                            )}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`product-status ${
                              product.status === "Active"
                                ? "active"
                                : "inactive"
                            }`}
                          >
                            <span />
                            {product.status}
                          </span>
                        </td>

                        <td>
                          <div
                            className="product-row-actions"
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            <button
                              type="button"
                              title="Edit"
                              onClick={() =>
                                openEditModal(product)
                              }
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              className="delete"
                              title="Delete"
                              disabled={deleting}
                              onClick={() =>
                                handleDelete(product)
                              }
                            >
                              <Trash2 size={15} />
                            </button>

                            <ChevronRight
                              size={16}
                              className="row-arrow"
                            />
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

        {/* RIGHT DETAIL PANEL */}
        <aside className="products-detail">
          {!selectedProduct ? (
            <div className="products-detail-empty">
              <Package size={30} />
              <strong>Select a product</strong>
              <span>
                Choose a product from the catalogue to
                view its details.
              </span>
            </div>
          ) : (
            <>
              <div className="products-detail-top">
                <div className="products-detail-icon">
                  <Package size={22} />
                </div>

                <div className="products-detail-heading">
                  <span>PRODUCT</span>
                  <h2>{selectedProduct.name}</h2>
                  <p>
                    {selectedProduct.productCode}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditModal(selectedProduct)
                  }
                  title="Edit product"
                >
                  <Pencil size={16} />
                </button>
              </div>

              <div className="products-detail-status">
                <span
                  className={
                    selectedProduct.status === "Active"
                      ? "active"
                      : "inactive"
                  }
                >
                  <span />
                  {selectedProduct.status}
                </span>

                <small>
                  Updated{" "}
                  {formatDate(
                    selectedProduct.updatedAt
                  )}
                </small>
              </div>

              {/* PRICE */}
              <div className="products-price-card">
                <div>
                  <span>Unit Price</span>
                  <strong>
                    {formatCurrency(
                      selectedProduct.price,
                      selectedProduct.currency
                    )}
                  </strong>
                </div>

                <CircleDollarSign size={22} />
              </div>

              {/* SPECIFICATIONS */}
              <div className="products-detail-section">
                <div className="products-section-heading">
                  <Layers3 size={16} />
                  <span>Specifications</span>
                </div>

                <div className="products-specs">
                  <div>
                    <span>Category</span>
                    <strong>
                      {selectedProduct.category ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Material</span>
                    <strong>
                      {selectedProduct.material ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Unit</span>
                    <strong>
                      {selectedProduct.unit || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Diameter</span>
                    <strong>
                      {selectedProduct.diameter !==
                        null &&
                      selectedProduct.diameter !==
                        undefined
                        ? `${selectedProduct.diameter} ${
                            selectedProduct.diameterUnit ||
                            "mm"
                          }`
                        : "Not specified"}
                    </strong>
                  </div>

                  <div>
                    <span>Currency</span>
                    <strong>
                      {selectedProduct.currency ||
                        "INR"}
                    </strong>
                  </div>

                  <div>
                    <span>Added</span>
                    <strong>
                      {formatDate(
                        selectedProduct.createdAt
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div className="products-detail-section">
                <div className="products-section-heading">
                  <Tag size={16} />
                  <span>Description</span>
                </div>

                <p className="products-description">
                  {selectedProduct.description ||
                    "No description has been added for this product."}
                </p>
              </div>

              {/* PRODUCT ID */}
              <div className="products-detail-footer">
                <span>Product ID</span>
                <strong>
                  {getId(selectedProduct)}
                </strong>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* MODAL */}
      {showModal && (
        <div
          className="contact-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="contact-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="contact-modal-header">
              <div>
                <h2>
                  {editingProduct
                    ? "Edit Product"
                    : "Add Product"}
                </h2>

                <p>
                  {editingProduct
                    ? "Update the product information."
                    : "Add a new product to the catalogue."}
                </p>
              </div>

              <button
                type="button"
                className="contact-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="contact-form-grid">
                <div className="contact-form-group">
                  <label>
                    Product Name <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. GI Wire"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label>
                    Product Code <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="productCode"
                    value={form.productCode}
                    onChange={handleChange}
                    placeholder="e.g. GI-001"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label>
                    Category <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="e.g. GI Wire"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label>Material</label>

                  <input
                    type="text"
                    name="material"
                    value={form.material}
                    onChange={handleChange}
                    placeholder="Steel"
                  />
                </div>

                <div className="contact-form-group">
                  <label>Diameter</label>

                  <input
                    type="number"
                    name="diameter"
                    value={form.diameter}
                    onChange={handleChange}
                    placeholder="e.g. 2.5"
                    min="0"
                    step="any"
                  />
                </div>

                <div className="contact-form-group">
                  <label>Diameter Unit</label>

                  <select
                    name="diameterUnit"
                    value={form.diameterUnit}
                    onChange={handleChange}
                  >
                    <option value="mm">mm</option>
                    <option value="inch">inch</option>
                  </select>
                </div>

                <div className="contact-form-group">
                  <label>Unit</label>

                  <select
                    name="unit"
                    value={form.unit}
                    onChange={handleChange}
                  >
                    <option value="Kg">Kg</option>
                    <option value="Ton">Ton</option>
                    <option value="Meter">Meter</option>
                    <option value="Piece">Piece</option>
                    <option value="Coil">Coil</option>
                  </select>
                </div>

                <div className="contact-form-group">
                  <label>
                    Price <span>*</span>
                  </label>

                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="e.g. 85"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label>Currency</label>

                  <input
                    type="text"
                    name="currency"
                    value={form.currency}
                    onChange={handleChange}
                    placeholder="INR"
                    maxLength="3"
                  />
                </div>

                <div className="contact-form-group">
                  <label>Status</label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="Active">
                      Active
                    </option>
                    <option value="Inactive">
                      Inactive
                    </option>
                  </select>
                </div>

                <div className="contact-form-group full-width">
                  <label>Description</label>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Add a short description of the product..."
                  />
                </div>
              </div>

              <div className="contact-modal-footer">
                <button
                  type="button"
                  className="contact-cancel-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="contact-save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                    ? "Update Product"
                    : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCircleIcon() {
  return <AlertCircle size={17} />;
}