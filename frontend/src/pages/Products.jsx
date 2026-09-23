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

  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 8;

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

  const totalPages = Math.ceil(
  filteredProducts.length / PRODUCTS_PER_PAGE
);

const paginatedProducts = useMemo(() => {
  const startIndex =
    (currentPage - 1) * PRODUCTS_PER_PAGE;

  return filteredProducts.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE
  );
}, [filteredProducts, currentPage]);

const paginationStart =
  filteredProducts.length === 0
    ? 0
    : (currentPage - 1) * PRODUCTS_PER_PAGE + 1;

const paginationEnd = Math.min(
  currentPage * PRODUCTS_PER_PAGE,
  filteredProducts.length
);

useEffect(() => {
  setCurrentPage(1);
}, [search, category, status]);

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
  <div className="w-full space-y-5">
    {/* =====================================================
        HEADER
    ====================================================== */}
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f172a]">
          Product Catalogue
        </div>

        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-[var(--color-text-primary)]">
          Products
        </h1>

        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Manage product specifications, pricing and availability.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={loadProducts}
          title="Refresh products"
          disabled={loading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] shadow-sm transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
        </button>

        <button
          type="button"
          onClick={exportCSV}
          disabled={!filteredProducts.length}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3.5 text-[12px] font-semibold text-[var(--color-text-primary)] shadow-sm transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          Export
        </button>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-brand-900)] px-3.5 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-brand-800)] hover:shadow-md"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>
    </div>

    {/* =====================================================
        ALERTS
    ====================================================== */}
    {error && (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--color-danger-100)] bg-[var(--color-danger-50)] px-3.5 py-2.5 text-[12.5px] text-[var(--color-danger-700)]">
        <AlertCircle size={17} className="shrink-0" />

        <span className="min-w-0 flex-1">{error}</span>

        <button
          type="button"
          onClick={() => setError("")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/70"
        >
          <X size={14} />
        </button>
      </div>
    )}

    {success && (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--color-success-100)] bg-[var(--color-success-50)] px-3.5 py-2.5 text-[12.5px] text-[var(--color-success-700)]">
        <CheckCircle2 size={17} className="shrink-0" />

        <span className="min-w-0 flex-1">{success}</span>

        <button
          type="button"
          onClick={() => setSuccess("")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/70"
        >
          <X size={14} />
        </button>
      </div>
    )}

    {/* =====================================================
        KPI CARDS
    ====================================================== */}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* Total */}
      <div className="group flex items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-200)] hover:shadow-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
          <Package size={18} />
        </div>

        <div className="min-w-0">
          <span className="block text-[11px] font-medium text-[var(--color-text-muted)]">
            Total Products
          </span>

          <strong className="mt-0.5 block text-[19px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            {products.length}
          </strong>
        </div>
      </div>

      {/* Active */}
      <div className="group flex items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--color-success-200)] hover:shadow-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-50)] text-[var(--color-success-600)]">
          <CheckCircle2 size={18} />
        </div>

        <div className="min-w-0">
          <span className="block text-[11px] font-medium text-[var(--color-text-muted)]">
            Active
          </span>

          <strong className="mt-0.5 block text-[19px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            {activeProducts}
          </strong>
        </div>
      </div>

      {/* Inactive */}
      <div className="group flex items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--color-danger-200)] hover:shadow-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-danger-50)] text-[var(--color-danger-600)]">
          <XCircle size={18} />
        </div>

        <div className="min-w-0">
          <span className="block text-[11px] font-medium text-[var(--color-text-muted)]">
            Inactive
          </span>

          <strong className="mt-0.5 block text-[19px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            {inactiveProducts}
          </strong>
        </div>
      </div>
    </div>

    {/* =====================================================
        MAIN WORKSPACE
    ====================================================== */}
    <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* ===================================================
          PRODUCT CATALOGUE
      ==================================================== */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        {/* FILTER TOOLBAR */}
        <div className="border-b border-[var(--color-border)] p-3.5">
          <div className="flex flex-col gap-2.5 lg:flex-row">
            {/* Search */}
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-muted)] transition-all focus-within:border-[var(--color-brand-400)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--color-brand-100)]">
              <Search size={16} className="shrink-0" />

              <input
                type="text"
                placeholder="Search by product, code or category..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-[var(--color-border)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category */}
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] font-medium text-[var(--color-text-primary)] outline-none transition-all hover:border-[var(--color-border-strong)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] font-medium text-[var(--color-text-primary)] outline-none transition-all hover:border-[var(--color-border-strong)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* TABLE TITLE */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3.5">
          <div>
            <h2 className="text-[13.5px] font-semibold text-[var(--color-brand-800)]">
              Product Catalogue
            </h2>

            <span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">
              {filteredProducts.length} result
              {filteredProducts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {search || category !== "All Categories" || status !== "All Status" ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All Categories");
                setStatus("All Status");
              }}
              className="text-[11px] font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
              <RefreshCw size={21} className="animate-spin" />
            </div>

            <span className="text-[12px]">
              Loading products...
            </span>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* EMPTY */
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
              <Package size={23} />
            </div>

            <strong className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              No products found
            </strong>

            <span className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              {products.length === 0
                ? "Create your first product to get started."
                : "Try adjusting your search or filters."}
            </span>

            {products.length === 0 && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-brand-900)] px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-[var(--color-brand-800)]"
              >
                <Plus size={15} />
                Add Product
              </button>
            )}
          </div>
        ) : (
          <>
          {/* /* TABLE */ }
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Product
                  </th>

                  <th className="px-3 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Code
                  </th>

                  <th className="px-3 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Category
                  </th>

                  <th className="px-3 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Unit
                  </th>

                  <th className="px-3 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Price
                  </th>

                  <th className="px-3 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Status
                  </th>

                  <th className="w-[78px] px-3 py-3" />
                </tr>
              </thead>

              <tbody>
                {paginatedProducts.map((product) => {
                  const selected =
                    getId(selectedProduct) === getId(product);

                  return (
                    <tr
                      key={getId(product)}
                      onClick={() =>
                        setSelectedProduct(product)
                      }
                      className={`group cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-b-0 ${
                        selected
                          ? "bg-[var(--color-brand-50)]/70"
                          : "hover:bg-[var(--color-surface-hover)]"
                      }`}
                    >
                      {/* Product */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              selected
                                ? "bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                            }`}
                          >
                            <Package size={16} />
                          </div>

                          <div className="min-w-0">
                            <strong className="block truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">
                              {product.name}
                            </strong>

                            <span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">
                              {product.material || "Steel"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="px-3 py-3.5">
                        <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[10.5px] font-medium text-[var(--color-text-secondary)]">
                          {product.productCode}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-3 py-3.5 text-[12px] text-[var(--color-text-secondary)]">
                        {product.category || "—"}
                      </td>

                      {/* Unit */}
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                          {product.unit || "—"}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3.5 text-right">
                        <strong className="font-mono text-[12px] font-semibold text-[var(--color-text-primary)]">
                          {formatCurrency(
                            product.price,
                            product.currency
                          )}
                        </strong>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${
                            product.status === "Active"
                              ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
                              : "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              product.status === "Active"
                                ? "bg-[var(--color-success-600)]"
                                : "bg-[var(--color-danger-600)]"
                            }`}
                          />

                          {product.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3.5">
                        <div
                          className="flex items-center justify-end gap-1"
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
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] opacity-0 transition-all hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)] group-hover:opacity-100"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            type="button"
                            title="Delete"
                            disabled={deleting}
                            onClick={() =>
                              handleDelete(product)
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] opacity-0 transition-all hover:bg-[var(--color-danger-50)] hover:text-[var(--color-danger-600)] group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                           </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
              {/* Results count */}
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Showing{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {paginationStart}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {paginationEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {filteredProducts.length}
                </span>{" "}
                products
              </p>

              {/* Page controls */}
              <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.max(page - 1, 1)
                    )
                  }
                  className="h-8 rounded-md border border-[var(--color-border)] bg-white px-3 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {/* Page numbers */}
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
                        ? "bg-[var(--color-brand-700)] text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                {/* Next */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(page + 1, totalPages)
                    )
                  }
                  className="h-8 rounded-md border border-[var(--color-border)] bg-white px-3 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </section>

      {/* ===================================================
          DETAIL PANEL
      ==================================================== */}
      <aside className="min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
        {!selectedProduct ? (
          <div className="flex min-h-[500px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
              <Package size={24} />
            </div>

            <strong className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              Select a product
            </strong>

            <span className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              Choose a product from the catalogue to view
              its details.
            </span>
          </div>
        ) : (
          <>
            {/* DETAIL HEADER */}
            <div className="border-b border-[var(--color-border)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                  <Package size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                    Product
                  </span>

                  <h2 className="mt-0.5 truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
                    {selectedProduct.name}
                  </h2>

                  <p className="mt-0.5 font-mono text-[10.5px] text-[var(--color-text-muted)]">
                    {selectedProduct.productCode}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openEditModal(selectedProduct)
                  }
                  title="Edit product"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-brand-200)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)]"
                >
                  <Pencil size={14} />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${
                    selectedProduct.status === "Active"
                      ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
                      : "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selectedProduct.status === "Active"
                        ? "bg-[var(--color-success-600)]"
                        : "bg-[var(--color-danger-600)]"
                    }`}
                  />

                  {selectedProduct.status}
                </span>

                <small className="text-[10px] text-[var(--color-text-muted)]">
                  Updated {formatDate(selectedProduct.updatedAt)}
                </small>
              </div>
            </div>

            {/* PRICE CARD */}
            <div className="p-4">
              <div className="relative overflow-hidden rounded-xl border border-[var(--color-brand-100)] bg-[var(--color-brand-50)] px-4 py-3.5">
                <div className="relative z-10">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-brand-700)]">
                    Unit Price
                  </span>

                  <strong className="mt-1 block font-mono text-[20px] font-semibold tracking-tight text-[var(--color-brand-900)]">
                    {formatCurrency(
                      selectedProduct.price,
                      selectedProduct.currency
                    )}
                  </strong>
                </div>

                <div className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white/70 text-[var(--color-brand-700)]">
                  <CircleDollarSign size={20} />
                </div>
              </div>

              {/* SPECIFICATIONS */}
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                    <Layers3 size={14} />
                  </div>

                  <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                    Specifications
                  </span>
                </div>

                <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
                  <div className="grid grid-cols-2 gap-4 px-3 py-2.5">
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">
                      Category
                    </span>

                    <strong className="text-right text-[11px] font-medium text-[var(--color-text-primary)]">
                      {selectedProduct.category || "—"}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4 px-3 py-2.5">
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">
                      Material
                    </span>

                    <strong className="text-right text-[11px] font-medium text-[var(--color-text-primary)]">
                      {selectedProduct.material || "—"}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4 px-3 py-2.5">
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">
                      Unit
                    </span>

                    <strong className="text-right text-[11px] font-medium text-[var(--color-text-primary)]">
                      {selectedProduct.unit || "—"}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4 px-3 py-2.5">
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">
                      Diameter
                    </span>

                    <strong className="text-right text-[11px] font-medium text-[var(--color-text-primary)]">
                      {selectedProduct.diameter !== null &&
                      selectedProduct.diameter !== undefined
                        ? `${selectedProduct.diameter} ${
                            selectedProduct.diameterUnit || "mm"
                          }`
                        : "Not specified"}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4 px-3 py-2.5">
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">
                      Currency
                    </span>

                    <strong className="text-right font-mono text-[11px] font-medium text-[var(--color-text-primary)]">
                      {selectedProduct.currency || "INR"}
                    </strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4 px-3 py-2.5">
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">
                      Added
                    </span>

                    <strong className="text-right text-[11px] font-medium text-[var(--color-text-primary)]">
                      {formatDate(selectedProduct.createdAt)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                    <Tag size={14} />
                  </div>

                  <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                    Description
                  </span>
                </div>

                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
                  <p className="text-[11.5px] leading-relaxed text-[var(--color-text-secondary)]">
                    {selectedProduct.description ||
                      "No description has been added for this product."}
                  </p>
                </div>
              </div>
            </div>

            {/* PRODUCT ID */}
            <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  Product ID
                </span>

                <strong className="max-w-[190px] truncate font-mono text-[10px] text-[var(--color-text-secondary)]">
                  {getId(selectedProduct)}
                </strong>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>

    {/* =====================================================
        PRODUCT MODAL
    ====================================================== */}
    {showModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeModal();
          }
        }}
      >
        <div
          className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl"
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          {/* MODAL HEADER */}
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                  <Package size={14} />
                </div>

                <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-700)]">
                  Product Catalogue
                </span>
              </div>

              <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
                {editingProduct
                  ? "Edit Product"
                  : "Add Product"}
              </h2>

              <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                {editingProduct
                  ? "Update the product information."
                  : "Add a new product to the catalogue."}
              </p>
            </div>

            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              <X size={17} />
            </button>
          </div>

          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            className="min-h-0 overflow-y-auto"
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 p-5 sm:grid-cols-2">
              {/* Product Name */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Product Name <span className="text-[var(--color-danger-600)]">*</span>
                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. GI Wire"
                  required
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>

              {/* Product Code */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Product Code <span className="text-[var(--color-danger-600)]">*</span>
                </label>

                <input
                  type="text"
                  name="productCode"
                  value={form.productCode}
                  onChange={handleChange}
                  placeholder="e.g. GI-001"
                  required
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 font-mono text-[12px] uppercase text-[var(--color-text-primary)] outline-none transition-all placeholder:font-sans placeholder:normal-case placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Category <span className="text-[var(--color-danger-600)]">*</span>
                </label>

                <input
                  type="text"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="e.g. GI Wire"
                  required
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>

              {/* Material */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Material
                </label>

                <input
                  type="text"
                  name="material"
                  value={form.material}
                  onChange={handleChange}
                  placeholder="Steel"
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>

              {/* Diameter */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Diameter
                </label>

                <input
                  type="number"
                  name="diameter"
                  value={form.diameter}
                  onChange={handleChange}
                  placeholder="e.g. 2.5"
                  min="0"
                  step="any"
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 font-mono text-[12px] text-[var(--color-text-primary)] outline-none transition-all placeholder:font-sans placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>

              {/* Diameter Unit */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Diameter Unit
                </label>

                <select
                  name="diameterUnit"
                  value={form.diameterUnit}
                  onChange={handleChange}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                >
                  <option value="mm">mm</option>
                  <option value="inch">inch</option>
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Unit
                </label>

                <select
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                >
                  <option value="Kg">Kg</option>
                  <option value="Ton">Ton</option>
                  <option value="Meter">Meter</option>
                  <option value="Piece">Piece</option>
                  <option value="Coil">Coil</option>
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Price <span className="text-[var(--color-danger-600)]">*</span>
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
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 font-mono text-[12px] text-[var(--color-text-primary)] outline-none transition-all placeholder:font-sans placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Currency
                </label>

                <input
                  type="text"
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  placeholder="INR"
                  maxLength="3"
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 font-mono text-[12px] uppercase text-[var(--color-text-primary)] outline-none transition-all placeholder:font-sans placeholder:normal-case placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>

              {/* Status */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Status
                </label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-[12px] text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Add a short description of the product..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-[12px] leading-relaxed text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-400)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
                />
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3.5">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[12px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-brand-700)] px-4 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-brand-800)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <RefreshCw
                    size={14}
                    className="animate-spin"
                  />
                )}

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