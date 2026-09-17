import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  Truck,
  MapPin,
  FileText,
  RefreshCw,
} from "lucide-react";

import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getContacts,
  getProducts,
} from "../api/api";

const ORDER_STATUSES = [
  "Draft",
  "Confirmed",
  "In Production",
  "Ready for Dispatch",
  "Dispatched",
  "Delivered",
  "Cancelled",
];

const PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Overdue"];

const emptyForm = {
  contact: "",
  enquiry: "",
  product: "",
  quantity: "",
  unit: "kg",
  rate: "",
  itemDiscount: "0",
  discount: "0",
  taxPercent: "18",
  expectedDeliveryDate: "",
  shippingAddress: "",
  billingAddress: "",
  notes: "",
};

function getStatusClass(status) {
  if (status === "Delivered" || status === "Dispatched") {
    return "status-resolved";
  }

  if (status === "Confirmed" || status === "In Production") {
    return "status-in-progress";
  }

  if (status === "Ready for Dispatch") {
    return "status-contacted";
  }

  if (status === "Cancelled") {
    return "status-new";
  }

  return "status-new";
}

function getPaymentClass(payment) {
  if (payment === "Paid") return "status-resolved";
  if (payment === "Partial") return "status-in-progress";
  if (payment === "Pending") return "status-new";
  return "status-contacted";
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().split("T")[0];
}

function getContactName(contact) {
  if (!contact) return "Unknown Contact";

  return (
    contact.company ||
    contact.name ||
    contact.email ||
    "Unknown Contact"
  );
}

function getContactPerson(contact) {
  if (!contact) return "—";

  return contact.name || contact.email || "—";
}

function getProductName(product) {
  if (!product) return "Unknown Product";

  return product.name || product.code || "Unknown Product";
}

function getItemsLabel(order) {
  if (!order?.items?.length) return "—";

  if (order.items.length === 1) {
    return getProductName(order.items[0].product);
  }

  return `${getProductName(order.items[0].product)} + ${
    order.items.length - 1
  } more`;
}

function getItemsQuantity(order) {
  if (!order?.items?.length) return "—";

  return order.items
    .map(
      (item) =>
        `${Number(item.quantity || 0).toLocaleString("en-IN")} ${
          item.unit || "kg"
        }`
    )
    .join(", ");
}

function Orders() {
  const [orders, setOrders] = useState([]);

  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");

  const [selectedId, setSelectedId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const limit = 20;

  /*
   * ---------------------------------------------------------
   * FETCH ORDERS
   * ---------------------------------------------------------
   */

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        limit,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter !== "All") {
        params.status = statusFilter;
      }

      if (paymentFilter !== "All") {
        params.paymentStatus = paymentFilter;
      }

      const response = await getOrders(params);

      const result = response?.data;

      if (!result?.success) {
        throw new Error(result?.message || "Failed to fetch orders");
      }

      const fetchedOrders = result.data || [];

      setOrders(fetchedOrders);
      setPages(result.pages || 1);
      setTotalOrders(result.total || 0);

      if (fetchedOrders.length > 0) {
        const currentStillExists = fetchedOrders.some(
          (order) => order._id === selectedId
        );

        if (!currentStillExists) {
          setSelectedId(fetchedOrders[0]._id);
        }
      } else {
        setSelectedId(null);
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error("Fetch orders error:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load orders."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * FETCH CONTACTS + PRODUCTS
   * ---------------------------------------------------------
   */

  const fetchFormData = async () => {
    try {
      const [contactsResponse, productsResponse] = await Promise.all([
        getContacts({ limit: 100 }),
        getProducts({ limit: 100 }),
      ]);

      const contactsResult = contactsResponse?.data;
      const productsResult = productsResponse?.data;

      if (contactsResult?.success) {
        setContacts(contactsResult.data || []);
      }

      if (productsResult?.success) {
        setProducts(productsResult.data || []);
      }
    } catch (err) {
      console.error("Fetch order form data error:", err);
    }
  };

  useEffect(() => {
    fetchFormData();
  }, []);

  /*
   * ---------------------------------------------------------
   * FETCH ORDERS WHEN FILTERS CHANGE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 300);

    return () => clearTimeout(timer);
  }, [page, search, statusFilter, paymentFilter]);

  /*
   * ---------------------------------------------------------
   * FETCH SELECTED ORDER DETAILS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!selectedId) {
      setSelectedOrder(null);
      return;
    }

    const fetchSelectedOrder = async () => {
      try {
        setDetailLoading(true);

        const response = await getOrderById(selectedId);

        if (response?.data?.success) {
          setSelectedOrder(response.data.data);
        }
      } catch (err) {
        console.error("Fetch order details error:", err);

        const fromList = orders.find(
          (order) => order._id === selectedId
        );

        if (fromList) {
          setSelectedOrder(fromList);
        }
      } finally {
        setDetailLoading(false);
      }
    };

    fetchSelectedOrder();
  }, [selectedId]);

  /*
   * ---------------------------------------------------------
   * STATS
   * ---------------------------------------------------------
   */

  const stats = useMemo(() => {
    const inProcessStatuses = [
      "Confirmed",
      "In Production",
      "Ready for Dispatch",
    ];

    const inProcess = orders.filter((order) =>
      inProcessStatuses.includes(order.status)
    ).length;

    const dispatched = orders.filter(
      (order) =>
        order.status === "Dispatched" ||
        order.status === "Delivered"
    ).length;

    const value = orders.reduce(
      (sum, order) => sum + Number(order.grandTotal || 0),
      0
    );

    return {
      total: totalOrders,
      inProcess,
      dispatched,
      value,
    };
  }, [orders, totalOrders]);

  /*
   * ---------------------------------------------------------
   * CREATE MODAL
   * ---------------------------------------------------------
   */

  const openAddModal = () => {
    setEditingOrder(null);
    setForm({
      ...emptyForm,
    });
    setModalOpen(true);
  };

  /*
   * ---------------------------------------------------------
   * EDIT MODAL
   * ---------------------------------------------------------
   */

  const openEditModal = (order) => {
    setEditingOrder(order);

    setForm({
      contact: order.contact?._id || order.contact || "",
      enquiry: order.enquiry?._id || order.enquiry || "",
      product: order.items?.[0]?.product?._id || "",
      quantity: order.items?.[0]?.quantity || "",
      unit: order.items?.[0]?.unit || "kg",
      rate: order.items?.[0]?.rate || "",
      itemDiscount: order.items?.[0]?.discount || "0",
      discount: order.discount || "0",
      taxPercent: order.taxPercent ?? "18",
      expectedDeliveryDate: formatDateInput(
        order.expectedDeliveryDate
      ),
      shippingAddress: order.shippingAddress || "",
      billingAddress: order.billingAddress || "",
      notes: order.notes || "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingOrder(null);
    setForm(emptyForm);
  };

  /*
   * ---------------------------------------------------------
   * FORM HANDLING
   * ---------------------------------------------------------
   */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const selectedProduct = products.find(
    (product) => product._id === form.product
  );

  const calculatedItemAmount =
    Number(form.quantity || 0) * Number(form.rate || 0) -
    Number(form.itemDiscount || 0);

  /*
   * ---------------------------------------------------------
   * CREATE ORDER
   * ---------------------------------------------------------
   */

  const handleCreate = async () => {
    if (!form.contact) {
      alert("Please select a contact.");
      return;
    }

    if (!form.product) {
      alert("Please select a product.");
      return;
    }

    if (!form.quantity || Number(form.quantity) <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    if (Number(form.rate || 0) < 0) {
      alert("Please enter a valid rate.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        contact: form.contact,
        items: [
          {
            product: form.product,
            quantity: Number(form.quantity),
            unit:
              form.unit ||
              selectedProduct?.unit ||
              "kg",
            rate: Number(form.rate || 0),
            discount: Number(form.itemDiscount || 0),
          },
        ],
        discount: Number(form.discount || 0),
        taxPercent: Number(form.taxPercent || 18),
        expectedDeliveryDate:
          form.expectedDeliveryDate || undefined,
        shippingAddress: form.shippingAddress.trim(),
        billingAddress: form.billingAddress.trim(),
        notes: form.notes.trim(),
      };

      if (form.enquiry.trim()) {
        payload.enquiry = form.enquiry.trim();
      }

      const response = await createOrder(payload);

      if (!response?.data?.success) {
        throw new Error(
          response?.data?.message || "Failed to create order"
        );
      }

      const createdOrder = response.data.data;

      closeModal();

      await fetchOrders();

      if (createdOrder?._id) {
        setSelectedId(createdOrder._id);
      }
    } catch (err) {
      console.error("Create order error:", err);

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create order."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * UPDATE ORDER
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * Your backend controller only allows:
   *
   * expectedDeliveryDate
   * shippingAddress
   * billingAddress
   * notes
   * discount
   * taxPercent
   *
   * So we only send those fields here.
   */

  const handleUpdate = async () => {
    if (!editingOrder?._id) return;

    try {
      setSaving(true);

      const payload = {
        expectedDeliveryDate:
          form.expectedDeliveryDate || undefined,
        shippingAddress: form.shippingAddress.trim(),
        billingAddress: form.billingAddress.trim(),
        notes: form.notes.trim(),
        discount: Number(form.discount || 0),
        taxPercent: Number(form.taxPercent || 18),
      };

      const response = await updateOrder(
        editingOrder._id,
        payload
      );

      if (!response?.data?.success) {
        throw new Error(
          response?.data?.message || "Failed to update order"
        );
      }

      const updatedOrder = response.data.data;

      closeModal();

      await fetchOrders();

      if (updatedOrder?._id) {
        setSelectedId(updatedOrder._id);
      }
    } catch (err) {
      console.error("Update order error:", err);

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update order."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * STATUS UPDATE
   * ---------------------------------------------------------
   */

  const handleStatusChange = async (order, newStatus) => {
    if (!order?._id || !newStatus || newStatus === order.status) {
      return;
    }

    const message =
      newStatus === "Confirmed"
        ? "Confirming this order will deduct the ordered quantity from inventory. Continue?"
        : `Change order status to "${newStatus}"?`;

    if (!window.confirm(message)) {
      return;
    }

    try {
      const response = await updateOrderStatus(
        order._id,
        newStatus
      );

      if (!response?.data?.success) {
        throw new Error(
          response?.data?.message ||
            "Failed to update order status"
        );
      }

      const updatedOrder = response.data.data;

      setOrders((current) =>
        current.map((item) =>
          item._id === order._id
            ? {
                ...item,
                ...updatedOrder,
                status: newStatus,
              }
            : item
        )
      );

      setSelectedOrder((current) =>
        current
          ? {
              ...current,
              ...updatedOrder,
              status: newStatus,
            }
          : current
      );
    } catch (err) {
      console.error("Update status error:", err);

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update order status."
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * DELETE ORDER
   * ---------------------------------------------------------
   */

  const handleDelete = async (order) => {
    if (!order?._id) return;

    if (!["Draft", "Cancelled"].includes(order.status)) {
      alert(
        "Only Draft or Cancelled orders can be deleted."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${order.orderNumber}?`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const response = await deleteOrder(order._id);

      if (!response?.data?.success) {
        throw new Error(
          response?.data?.message ||
            "Failed to delete order"
        );
      }

      setSelectedId(null);
      setSelectedOrder(null);

      await fetchOrders();
    } catch (err) {
      console.error("Delete order error:", err);

      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete order."
      );
    } finally {
      setDeleting(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * REFRESH
   * ---------------------------------------------------------
   */

  const handleRefresh = () => {
    fetchOrders();
  };

  const canEdit = selectedOrder?.isActive !== false;

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="orders-page">
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <div className="ord-breadcrumb">
            COMMERCIAL OPS · FULFILMENT · DISPATCH LOG
          </div>

          <h1>Orders</h1>

          <p>
            Manage customer purchase orders, production and
            logistics.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            type="button"
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          <button
            className="btn btn-primary"
            onClick={openAddModal}
            type="button"
          >
            <Plus size={16} />
            New Order
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="alert alert-error mb-4">
          {error}
        </div>
      )}

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span className="ord-kpi-label">
              TOTAL ORDERS
            </span>
          </div>

          <div className="stat-value">
            {stats.total}
          </div>

          <div className="stat-change">
            Active purchase orders
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="ord-kpi-label">
              IN PROCESS
            </span>
          </div>

          <div className="stat-value">
            {stats.inProcess}
          </div>

          <div className="stat-change">
            Active production
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="ord-kpi-label">
              DISPATCHED
            </span>
          </div>

          <div className="stat-value">
            {stats.dispatched}
          </div>

          <div className="stat-change">
            Current page
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="ord-kpi-label">
              ORDER VALUE
            </span>
          </div>

          <div className="stat-value">
            {formatCurrency(stats.value)}
          </div>

          <div className="stat-change">
            Loaded orders
          </div>
        </div>
      </div>

      {/* FILTER */}
      <div className="ord-filter-bar">
        <div className="ord-search">
          <Search size={15} />

          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by Order ID or notes..."
          />
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="All">
            All Statuses
          </option>

          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={paymentFilter}
          onChange={(e) => {
            setPage(1);
            setPaymentFilter(e.target.value);
          }}
        >
          <option value="All">
            All Payments
          </option>

          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* WORKSPACE */}
      <div className="ord-workspace">
        {/* LEFT: ORDER LIST */}
        <section className="card ord-queue">
          <div className="ord-queue-header">
            <div>
              <h2>Manufacturing & Dispatch Log</h2>

              <span className="text-muted text-sm">
                {loading
                  ? "Loading..."
                  : `${orders.length} shown`}
              </span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ORDER #</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT / QTY</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4">
                      <div className="text-muted">
                        Loading orders...
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      <div className="text-muted">
                        No orders found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order._id}
                      className={
                        selectedId === order._id
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setSelectedId(order._id)
                      }
                    >
                      <td>
                        <span className="font-mono font-semibold text-sm text-brand">
                          {order.orderNumber}
                        </span>

                        <div className="text-xs text-muted">
                          {formatDate(order.orderDate)}
                        </div>
                      </td>

                      <td>
                        <strong className="text-sm">
                          {getContactName(order.contact)}
                        </strong>

                        <div className="text-xs text-muted">
                          {getContactPerson(order.contact)}
                        </div>
                      </td>

                      <td>
                        <div className="text-sm">
                          {getItemsLabel(order)}
                        </div>

                        <div className="text-xs text-muted">
                          {getItemsQuantity(order)}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="pagination">
            <span>
              Showing {orders.length} of {totalOrders} Purchase
              Orders
            </span>

            <div className="pagination-buttons">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() =>
                  setPage((current) => current - 1)
                }
              >
                Previous
              </button>

              <button
                type="button"
                disabled
              >
                {page}
              </button>

              <button
                type="button"
                disabled={
                  page >= pages || loading
                }
                onClick={() =>
                  setPage((current) => current + 1)
                }
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT: DETAIL PANEL */}
        <aside className="card ord-detail">
          {!selectedOrder ? (
            <div className="ord-detail-body">
              <div className="text-muted">
                Select an order to view its details.
              </div>
            </div>
          ) : detailLoading ? (
            <div className="ord-detail-body">
              <div className="text-muted">
                Loading order details...
              </div>
            </div>
          ) : (
            <>
              <div className="ord-detail-header">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-brand">
                      {selectedOrder.orderNumber}
                    </span>

                    <span
                      className={`status ${getStatusClass(
                        selectedOrder.status
                      )}`}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>

                  <h2>
                    {selectedOrder.status}
                  </h2>

                  <p className="text-muted text-sm">
                    Created{" "}
                    {formatDate(
                      selectedOrder.orderDate
                    )}{" "}
                    · Expected{" "}
                    {formatDate(
                      selectedOrder.expectedDeliveryDate
                    )}
                  </p>
                </div>
              </div>

              <div className="ord-detail-body">
                {/* PURCHASER */}
                <div className="ord-section">
                  <div className="ord-section-title">
                    PURCHASER INFORMATION
                  </div>

                  <strong className="text-base">
                    {getContactName(
                      selectedOrder.contact
                    )}
                  </strong>

                  <p className="text-sm text-muted mt-1">
                    {getContactPerson(
                      selectedOrder.contact
                    )}
                  </p>

                  <div className="ord-meta-row">
                    <span>Phone</span>
                    <strong>
                      {selectedOrder.contact?.phone ||
                        "—"}
                    </strong>
                  </div>

                  <div className="ord-meta-row">
                    <span>Email</span>
                    <strong>
                      {selectedOrder.contact?.email ||
                        "—"}
                    </strong>
                  </div>

                  {selectedOrder.enquiry && (
                    <div className="ord-meta-row">
                      <span>Enquiry</span>
                      <strong>
                        {selectedOrder.enquiry
                          ?.enquiryNumber ||
                          "—"}
                      </strong>
                    </div>
                  )}
                </div>

                {/* CONSIGNMENT */}
                <div className="ord-section">
                  <div className="ord-section-title">
                    CONSIGNMENT SPECIFICATION
                  </div>

                  {selectedOrder.items?.map(
                    (item, index) => (
                      <div
                        className="ord-spec-grid"
                        key={
                          item._id || index
                        }
                      >
                        <div>
                          <span>
                            Description & Grade
                          </span>

                          <strong>
                            {getProductName(
                              item.product
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Quantity</span>

                          <strong>
                            {Number(
                              item.quantity || 0
                            ).toLocaleString(
                              "en-IN"
                            )}{" "}
                            {item.unit || "kg"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Rate / Unit
                          </span>

                          <strong>
                            {formatCurrency(
                              item.rate
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Item Discount
                          </span>

                          <strong>
                            {formatCurrency(
                              item.discount
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Line Amount
                          </span>

                          <strong>
                            {formatCurrency(
                              item.amount
                            )}
                          </strong>
                        </div>
                      </div>
                    )
                  )}

                  <div className="ord-spec-grid mt-3">
                    <div>
                      <span>Subtotal</span>

                      <strong>
                        {formatCurrency(
                          selectedOrder.subTotal
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Overall Discount
                      </span>

                      <strong>
                        {formatCurrency(
                          selectedOrder.discount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tax (
                        {selectedOrder.taxPercent ||
                          0}
                        %)
                      </span>

                      <strong>
                        {formatCurrency(
                          selectedOrder.taxAmount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Grand Total
                      </span>

                      <strong className="text-base">
                        {formatCurrency(
                          selectedOrder.grandTotal
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* FINANCIAL */}
                <div className="ord-section">
                  <div className="ord-section-title">
                    FINANCIAL / LEDGER STATUS
                  </div>

                  <div className="ord-finance-row">
                    <div>
                      <span>Order Value</span>

                      <strong>
                        {formatCurrency(
                          selectedOrder.grandTotal
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Payment Status
                      </span>

                      <span
                        className={`status ${getPaymentClass(
                          selectedOrder.paymentStatus
                        )}`}
                      >
                        {selectedOrder.paymentStatus ||
                          "Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="ord-meta-row">
                    <span>Amount Paid</span>

                    <strong>
                      {formatCurrency(
                        selectedOrder.amountPaid
                      )}
                    </strong>
                  </div>
                </div>

                {/* LOGISTICS */}
                <div className="ord-section">
                  <div className="ord-section-title">
                    LOGISTICS & SITE ADDRESS
                  </div>

                  <div className="ord-address">
                    <MapPin size={14} />

                    <span>
                      {selectedOrder.shippingAddress ||
                        "No shipping address provided."}
                    </span>
                  </div>

                  <div className="ord-meta-row">
                    <span>
                      Billing Address
                    </span>

                    <strong>
                      {selectedOrder.billingAddress ||
                        "Same / not provided"}
                    </strong>
                  </div>

                  <div className="ord-meta-row">
                    <span>
                      Expected Delivery
                    </span>

                    <strong>
                      {formatDate(
                        selectedOrder.expectedDeliveryDate
                      )}
                    </strong>
                  </div>

                  {selectedOrder.dispatchedDate && (
                    <div className="ord-meta-row">
                      <span>
                        Dispatched
                      </span>

                      <strong>
                        {formatDate(
                          selectedOrder.dispatchedDate
                        )}
                      </strong>
                    </div>
                  )}

                  {selectedOrder.deliveredDate && (
                    <div className="ord-meta-row">
                      <span>
                        Delivered
                      </span>

                      <strong>
                        {formatDate(
                          selectedOrder.deliveredDate
                        )}
                      </strong>
                    </div>
                  )}
                </div>

                {/* NOTES */}
                {selectedOrder.notes && (
                  <div className="ord-section">
                    <div className="ord-section-title">
                      NOTES
                    </div>

                    <p className="text-sm">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                {/* STATUS CONTROL */}
                <div className="ord-section">
                  <div className="ord-section-title">
                    ORDER STATUS
                  </div>

                  <select
                    className="select"
                    value={
                      selectedOrder.status || "Draft"
                    }
                    onChange={(e) =>
                      handleStatusChange(
                        selectedOrder,
                        e.target.value
                      )
                    }
                  >
                    {ORDER_STATUSES.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* AUDIT */}
                <div className="ord-section">
                  <div className="ord-section-title">
                    AUDIT & DISPATCH TIMELINE
                  </div>

                  <div className="ord-timeline">
                    <div className="ord-timeline-item">
                      <div className="ord-timeline-dot" />

                      <div>
                        <strong>
                          Order created
                        </strong>

                        <p>
                          Order record created in
                          the system.
                        </p>

                        <span className="text-xs text-muted">
                          {formatDate(
                            selectedOrder.createdAt ||
                              selectedOrder.orderDate
                          )}
                        </span>
                      </div>
                    </div>

                    {selectedOrder.dispatchedDate && (
                      <div className="ord-timeline-item">
                        <div className="ord-timeline-dot active" />

                        <div>
                          <strong>
                            Order dispatched
                          </strong>

                          <p>
                            Dispatch date recorded
                            against this order.
                          </p>

                          <span className="text-xs text-muted">
                            {formatDate(
                              selectedOrder.dispatchedDate
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedOrder.deliveredDate && (
                      <div className="ord-timeline-item">
                        <div className="ord-timeline-dot active" />

                        <div>
                          <strong>
                            Order delivered
                          </strong>

                          <p>
                            Delivery date recorded
                            against this order.
                          </p>

                          <span className="text-xs text-muted">
                            {formatDate(
                              selectedOrder.deliveredDate
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="ord-detail-footer">
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() =>
                    window.print()
                  }
                >
                  <FileText size={13} />
                  Print Packing Slip
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() =>
                    openEditModal(
                      selectedOrder
                    )
                  }
                  disabled={!canEdit}
                >
                  Edit Order
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() =>
                    handleStatusChange(
                      selectedOrder,
                      "Ready for Dispatch"
                    )
                  }
                  disabled={
                    selectedOrder.status ===
                      "Ready for Dispatch" ||
                    selectedOrder.status ===
                      "Dispatched" ||
                    selectedOrder.status ===
                      "Delivered" ||
                    selectedOrder.status ===
                      "Cancelled"
                  }
                >
                  <Truck size={13} />
                  Ready for Dispatch
                </button>

                {(selectedOrder.status ===
                  "Draft" ||
                  selectedOrder.status ===
                    "Cancelled") && (
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() =>
                      handleDelete(
                        selectedOrder
                      )
                    }
                    disabled={deleting}
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={closeModal}
        >
          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{ maxWidth: 680 }}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {editingOrder
                    ? "Edit Order"
                    : "Create New Order"}
                </h3>

                <p className="text-muted text-sm">
                  {editingOrder
                    ? `Update ${editingOrder.orderNumber}`
                    : "Create a new customer purchase order."}
                </p>
              </div>

              <button
                className="icon-button"
                onClick={closeModal}
                type="button"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {!editingOrder ? (
                <>
                  <div className="grid grid-2 gap-4">
                    {/* CONTACT */}
                    <div className="form-group">
                      <label className="form-label">
                        Customer / Contact *
                      </label>

                      <select
                        className="select"
                        name="contact"
                        value={form.contact}
                        onChange={handleChange}
                      >
                        <option value="">
                          Select contact
                        </option>

                        {contacts.map(
                          (contact) => (
                            <option
                              key={contact._id}
                              value={contact._id}
                            >
                              {getContactName(
                                contact
                              )}
                              {contact.name &&
                              contact.company
                                ? ` — ${contact.name}`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {/* PRODUCT */}
                    <div className="form-group">
                      <label className="form-label">
                        Product *
                      </label>

                      <select
                        className="select"
                        name="product"
                        value={form.product}
                        onChange={(e) => {
                          const productId =
                            e.target.value;

                          const product =
                            products.find(
                              (item) =>
                                item._id ===
                                productId
                            );

                          setForm(
                            (current) => ({
                              ...current,
                              product:
                                productId,
                              rate:
                                product?.sellingPrice ??
                                "",
                              unit:
                                product?.unit ||
                                "kg",
                            })
                          );
                        }}
                      >
                        <option value="">
                          Select product
                        </option>

                        {products.map(
                          (product) => (
                            <option
                              key={product._id}
                              value={product._id}
                            >
                              {product.name}
                              {product.code
                                ? ` (${product.code})`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {/* QUANTITY */}
                    <div className="form-group">
                      <label className="form-label">
                        Quantity *
                      </label>

                      <input
                        className="input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        name="quantity"
                        value={form.quantity}
                        onChange={handleChange}
                        placeholder="0"
                      />
                    </div>

                    {/* UNIT */}
                    <div className="form-group">
                      <label className="form-label">
                        Unit
                      </label>

                      <input
                        className="input"
                        name="unit"
                        value={form.unit}
                        onChange={handleChange}
                        placeholder="kg"
                      />
                    </div>

                    {/* RATE */}
                    <div className="form-group">
                      <label className="form-label">
                        Rate / Unit *
                      </label>

                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="rate"
                        value={form.rate}
                        onChange={handleChange}
                        placeholder="0.00"
                      />
                    </div>

                    {/* ITEM DISCOUNT */}
                    <div className="form-group">
                      <label className="form-label">
                        Item Discount
                      </label>

                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="itemDiscount"
                        value={
                          form.itemDiscount
                        }
                        onChange={handleChange}
                        placeholder="0"
                      />
                    </div>

                    {/* OVERALL DISCOUNT */}
                    <div className="form-group">
                      <label className="form-label">
                        Order Discount
                      </label>

                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="discount"
                        value={form.discount}
                        onChange={handleChange}
                        placeholder="0"
                      />
                    </div>

                    {/* TAX */}
                    <div className="form-group">
                      <label className="form-label">
                        Tax %
                      </label>

                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="taxPercent"
                        value={
                          form.taxPercent
                        }
                        onChange={handleChange}
                      />
                    </div>

                    {/* DELIVERY */}
                    <div className="form-group">
                      <label className="form-label">
                        Expected Delivery
                      </label>

                      <input
                        className="input"
                        type="date"
                        name="expectedDeliveryDate"
                        value={
                          form.expectedDeliveryDate
                        }
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  {/* CALCULATED PREVIEW */}
                  <div className="ord-section mt-4">
                    <div className="ord-section-title">
                      ORDER PREVIEW
                    </div>

                    <div className="ord-finance-row">
                      <div>
                        <span>
                          Estimated Line Amount
                        </span>

                        <strong>
                          {formatCurrency(
                            calculatedItemAmount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Tax
                        </span>

                        <strong>
                          {form.taxPercent || 0}%
                        </strong>
                      </div>
                    </div>

                    <p className="text-xs text-muted mt-2">
                      Final subtotal, tax amount and
                      grand total are calculated by the
                      backend when the order is created.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="ord-section">
                    <div className="ord-section-title">
                      ORDER INFORMATION
                    </div>

                    <div className="ord-meta-row">
                      <span>Order Number</span>

                      <strong className="font-mono">
                        {editingOrder.orderNumber}
                      </strong>
                    </div>

                    <div className="ord-meta-row">
                      <span>Customer</span>

                      <strong>
                        {getContactName(
                          editingOrder.contact
                        )}
                      </strong>
                    </div>

                    <div className="ord-meta-row">
                      <span>Current Status</span>

                      <span
                        className={`status ${getStatusClass(
                          editingOrder.status
                        )}`}
                      >
                        {editingOrder.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-2 gap-4 mt-4">
                    {/* DELIVERY */}
                    <div className="form-group">
                      <label className="form-label">
                        Expected Delivery
                      </label>

                      <input
                        className="input"
                        type="date"
                        name="expectedDeliveryDate"
                        value={
                          form.expectedDeliveryDate
                        }
                        onChange={handleChange}
                      />
                    </div>

                    {/* DISCOUNT */}
                    <div className="form-group">
                      <label className="form-label">
                        Order Discount
                      </label>

                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="discount"
                        value={form.discount}
                        onChange={handleChange}
                      />
                    </div>

                    {/* TAX */}
                    <div className="form-group">
                      <label className="form-label">
                        Tax %
                      </label>

                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        name="taxPercent"
                        value={
                          form.taxPercent
                        }
                        onChange={handleChange}
                      />
                    </div>

                    {/* SHIPPING */}
                    <div className="form-group">
                      <label className="form-label">
                        Shipping Address
                      </label>

                      <textarea
                        className="input"
                        name="shippingAddress"
                        value={
                          form.shippingAddress
                        }
                        onChange={handleChange}
                        rows="3"
                      />
                    </div>

                    {/* BILLING */}
                    <div className="form-group">
                      <label className="form-label">
                        Billing Address
                      </label>

                      <textarea
                        className="input"
                        name="billingAddress"
                        value={
                          form.billingAddress
                        }
                        onChange={handleChange}
                        rows="3"
                      />
                    </div>

                    {/* NOTES */}
                    <div className="form-group">
                      <label className="form-label">
                        Notes
                      </label>

                      <textarea
                        className="input"
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        rows="3"
                        placeholder="Additional order notes..."
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted mt-3">
                    Product, quantity, contact and other
                    order items are not changed here because
                    the current backend only permits editing
                    delivery, address, notes, discount and
                    tax after creation.
                  </p>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={
                  editingOrder
                    ? handleUpdate
                    : handleCreate
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingOrder
                  ? "Save Changes"
                  : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;
