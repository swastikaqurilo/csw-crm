import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  Truck,
  MapPin,
  FileText,
  RefreshCw,
  Package,
  UserRound,
  CalendarDays,
  CreditCard,
  IndianRupee,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Factory,
  AlertCircle,
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

const PAYMENT_STATUSES = [
  "Pending",
  "Partial",
  "Paid",
  "Overdue",
];

const ORDERS_PER_PAGE = 8;

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

  return product.name || product.code || product.productCode || "Unknown Product";
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

function getStatusStyles(status) {
  switch (status) {
    case "Delivered":
      return {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
      };

    case "Dispatched":
      return {
        badge: "border-sky-200 bg-sky-50 text-sky-700",
        icon: Truck,
      };

    case "Ready for Dispatch":
      return {
        badge: "border-violet-200 bg-violet-50 text-violet-700",
        icon: Package,
      };

    case "In Production":
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        icon: Factory,
      };

    case "Confirmed":
      return {
        badge: "border-blue-200 bg-blue-50 text-blue-700",
        icon: CheckCircle2,
      };

    case "Cancelled":
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        icon: AlertCircle,
      };

    default:
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-600",
        icon: FileText,
      };
  }
}

function getPaymentStyles(payment) {
  switch (payment) {
    case "Paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "Partial":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "Overdue":
      return "border-rose-200 bg-rose-50 text-rose-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function StatusBadge({ status }) {
  const styles = getStatusStyles(status);
  const Icon = styles.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}
    >
      <Icon size={12} />
      {status || "Draft"}
    </span>
  );
}

function PaymentBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPaymentStyles(
        status
      )}`}
    >
      {status || "Pending"}
    </span>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");

  const [viewOrder, setViewOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {
        page,
        limit: ORDERS_PER_PAGE,
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

      setOrders(result.data || []);
      setPages(Math.max(1, result.pages || 1));
      setTotalOrders(result.total || 0);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 300);

    return () => clearTimeout(timer);
  }, [page, search, statusFilter, paymentFilter]);


  const openViewOrder = async (order) => {
    if (!order?._id) return;

    setViewOrder(order);
    setDetailLoading(true);

    try {
      const response = await getOrderById(order._id);

      if (response?.data?.success) {
        setViewOrder(response.data.data);
      }
    } catch (err) {
      console.error("Fetch order details error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeViewOrder = () => {
    if (saving) return;
    setViewOrder(null);
  };

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

  const openAddModal = () => {
    setEditingOrder(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEditModal = (order) => {
    if (!order) return;

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
    setForm({ ...emptyForm });
  };

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

  const calculatedItemAmount = Math.max(
    0,
    Number(form.quantity || 0) * Number(form.rate || 0) -
      Number(form.itemDiscount || 0)
  );

  const estimatedTax =
    calculatedItemAmount * (Number(form.taxPercent || 0) / 100);

  const estimatedGrandTotal = Math.max(
    0,
    calculatedItemAmount -
      Number(form.discount || 0) +
      estimatedTax
  );

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
            unit: form.unit || selectedProduct?.unit || "kg",
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
        await openViewOrder(createdOrder);
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
        await openViewOrder(updatedOrder);
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

  const handleStatusChange = async (order, newStatus) => {
    if (
      !order?._id ||
      !newStatus ||
      newStatus === order.status
    ) {
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

      setViewOrder((current) =>
        current?._id === order._id
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
          response?.data?.message || "Failed to delete order"
        );
      }

      setViewOrder(null);

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

  const handleRefresh = () => {
    fetchOrders();
  };

  const canEdit = viewOrder?.isActive !== false;

  return (
    <div className="min-h-full space-y-5 pb-6">
      {/* PAGE HEADER */}

      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span>Commercial Operations</span>
            <span className="text-slate-300">/</span>
            <span>Fulfilment</span>
            <span className="text-slate-300">/</span>
            <span>Orders</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Orders
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage customer purchase orders, production and fulfilment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00335f] hover:shadow-md"
          >
            <Plus size={16} />
            New Order
          </button>
        </div>
      </section>

      {/* ERROR */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />

          <div>
            <p className="font-semibold">
              Unable to load orders
            </p>

            <p className="mt-0.5 text-rose-600">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* KPI CARDS */}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Orders"
          value={stats.total}
          description="Active purchase orders"
          icon={FileText}
        />  

        <KpiCard
          label="In Process"
          value={stats.inProcess}
          description="Active production"
          icon={Factory}
        />

        <KpiCard
          label="Dispatched"
          value={stats.dispatched}
          description="Current page"
          icon={Truck}
        />

        <KpiCard
          label="Order Value"
          value={formatCurrency(stats.value)}
          description="Loaded orders"
          icon={IndianRupee}
        />
      </section>
      {/* FILTER TOOLBAR */}

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by order number or notes..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="All">All Status</option>

              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => {
                setPage(1);
                setPaymentFilter(e.target.value);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="All">All Payments</option>

              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* LIST HEADER */}

        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Manufacturing & Dispatch Log
              </h2>

              {/* <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {totalOrders}
              </span> */}
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Purchase orders and current fulfilment status.
            </p>
          </div>

          <div className="text-xs font-medium text-slate-400">
            {loading ? "Updating..." : `${orders.length} shown`}
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Order
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Customer
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Product / Qty
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Value
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Payment
                </th>

                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: ORDERS_PER_PAGE }).map(
                  (_, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-100"
                    >
                      <td className="px-5 py-4">
                        <Skeleton width="w-24" />
                        <Skeleton width="w-16" />
                      </td>

                      <td className="px-4 py-4">
                        <Skeleton width="w-28" />
                        <Skeleton width="w-20" />
                      </td>

                      <td className="px-4 py-4">
                        <Skeleton width="w-32" />
                        <Skeleton width="w-20" />
                      </td>

                      <td className="px-4 py-4">
                        <Skeleton width="w-20" />
                      </td>

                      <td className="px-4 py-4">
                        <Skeleton width="w-16" rounded />
                      </td>

                      <td className="px-5 py-4">
                        <Skeleton width="w-24" rounded />
                      </td>
                    </tr>
                  )
                )
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <Package size={21} />
                      </div>

                      <h3 className="mt-4 text-sm font-semibold text-slate-800">
                        No orders found
                      </h3>

                      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                        Try adjusting your search or filters, or create a
                        new purchase order.
                      </p>

                      <button
                        type="button"
                        onClick={openAddModal}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#002244] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#00335f]"
                      >
                        <Plus size={14} />
                        New Order
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => openViewOrder(order)}
                    className="group cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-[#002244]">
                        {order.orderNumber}
                      </span>

                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <CalendarDays size={11} />
                        {formatDate(order.orderDate)}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <UserRound size={14} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {getContactName(order.contact)}
                          </p>

                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {getContactPerson(order.contact)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <p className="max-w-[240px] truncate text-sm font-medium text-slate-700">
                        {getItemsLabel(order)}
                      </p>

                      <p className="mt-1 max-w-[240px] truncate text-xs text-slate-400">
                        {getItemsQuantity(order)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatCurrency(order.grandTotal)}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-400">
                        {order.amountPaid
                          ? `${formatCurrency(order.amountPaid)} paid`
                          : "No payment"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <PaymentBadge status={order.paymentStatus} />
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-600">
              {totalOrders === 0
                ? 0
                : (page - 1) * ORDERS_PER_PAGE + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-600">
              {Math.min(page * ORDERS_PER_PAGE, totalOrders)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-600">
              {totalOrders}
            </span>{" "}
            purchase orders
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <div className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#002244] px-2 text-xs font-semibold text-white">
              {page}
            </div>

            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          ORDER DETAILS MODAL
      ===================================================== */}

      {viewOrder && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={closeViewOrder}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* DETAIL HEADER */}

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#002244]">
                    {viewOrder.orderNumber}
                  </span>

                  <StatusBadge status={viewOrder.status} />

                  <PaymentBadge status={viewOrder.paymentStatus} />
                </div>

                <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
                  Order Details
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Created {formatDate(viewOrder.orderDate)}
                  <span className="mx-1.5 text-slate-300">•</span>
                  Expected{" "}
                  {formatDate(viewOrder.expectedDeliveryDate)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeViewOrder}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close order details"
              >
                <X size={18} />
              </button>
            </div>

            {/* DETAIL BODY */}

            <div className="relative overflow-y-auto px-6 py-6">
              {detailLoading && (
                <div className="absolute right-5 top-5 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-500 shadow-sm">
                  <RefreshCw size={13} className="animate-spin" />
                  Loading details...
                </div>
              )}

              <div className="space-y-6">
                {/* PURCHASER */}

                <div>
                  <SectionHeading
                    icon={UserRound}
                    title="Purchaser Information"
                  />

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm font-bold text-slate-800">
                      {getContactName(viewOrder.contact)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {getContactPerson(viewOrder.contact)}
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                      <DetailRow
                        label="Phone"
                        value={viewOrder.contact?.phone}
                      />

                      <DetailRow
                        label="Email"
                        value={viewOrder.contact?.email}
                      />

                      {viewOrder.enquiry && (
                        <DetailRow
                          label="Enquiry"
                          value={
                            viewOrder.enquiry?.enquiryNumber ||
                            viewOrder.enquiry
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <SectionHeading
                    icon={Package}
                    title="Consignment Specification"
                  />

                  <div className="space-y-3">
                    {viewOrder.items?.map((item, index) => (
                      <div
                        key={item._id || index}
                        className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {getProductName(item.product)}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Item {index + 1}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                            {Number(item.quantity || 0).toLocaleString(
                              "en-IN"
                            )}{" "}
                            {item.unit || "kg"}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-100 pt-3.5 sm:grid-cols-3">
                          <DetailMetric
                            label="Rate / Unit"
                            value={formatCurrency(item.rate)}
                          />

                          <DetailMetric
                            label="Item Discount"
                            value={formatCurrency(item.discount)}
                          />

                          <DetailMetric
                            label="Line Amount"
                            value={formatCurrency(item.amount)}
                            strong
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="space-y-2.5">
                      <DetailRow
                        label="Subtotal"
                        value={formatCurrency(viewOrder.subTotal)}
                      />

                      <DetailRow
                        label="Overall Discount"
                        value={formatCurrency(viewOrder.discount)}
                      />

                      <DetailRow
                        label={`Tax (${viewOrder.taxPercent || 0}%)`}
                        value={formatCurrency(viewOrder.taxAmount)}
                      />

                      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="text-sm font-bold text-slate-700">
                          Grand Total
                        </span>

                        <span className="text-base font-bold text-[#002244]">
                          {formatCurrency(viewOrder.grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionHeading
                    icon={CreditCard}
                    title="Financial / Ledger"
                    iconWrapper="bg-emerald-50 text-emerald-600"
                  />

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <DetailMetric
                        label="Order Value"
                        value={formatCurrency(viewOrder.grandTotal)}
                        strong
                      />

                      <DetailMetric
                        label="Amount Paid"
                        value={formatCurrency(viewOrder.amountPaid)}
                        strong
                      />

                      <DetailMetric
                        label="Balance Due"
                        value={formatCurrency(
                          Math.max(
                            0,
                            Number(viewOrder.grandTotal || 0) -
                              Number(viewOrder.amountPaid || 0)
                          )
                        )}
                        strong
                      />
                    </div>

                    <div className="mt-4 border-t border-slate-200/70 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium text-slate-400">
                          Payment Status
                        </span>

                        <PaymentBadge
                          status={viewOrder.paymentStatus}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionHeading
                    icon={MapPin}
                    title="Logistics & Site Address"
                    iconWrapper="bg-sky-50 text-sky-600"
                  />

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-start gap-2.5">
                      <MapPin
                        size={15}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />

                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Shipping Address
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {viewOrder.shippingAddress ||
                            "No shipping address provided."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                      <DetailMetric
                        label="Billing Address"
                        value={
                          viewOrder.billingAddress ||
                          "Same / not provided"
                        }
                      />

                      <DetailMetric
                        label="Expected Delivery"
                        value={formatDate(
                          viewOrder.expectedDeliveryDate
                        )}
                      />

                      {viewOrder.dispatchedDate && (
                        <DetailMetric
                          label="Dispatched"
                          value={formatDate(
                            viewOrder.dispatchedDate
                          )}
                        />
                      )}

                      {viewOrder.deliveredDate && (
                        <DetailMetric
                          label="Delivered"
                          value={formatDate(
                            viewOrder.deliveredDate
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* NOTES */}

                {viewOrder.notes && (
                  <div>
                    <SectionHeading
                      icon={FileText}
                      title="Notes"
                    />

                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="whitespace-pre-wrap text-xs leading-5 text-slate-600">
                        {viewOrder.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* STATUS */}

                <div>
                  <SectionHeading
                    icon={Clock3}
                    title="Order Status"
                  />

                  <select
                    value={viewOrder.status || "Draft"}
                    onChange={(e) =>
                      handleStatusChange(
                        viewOrder,
                        e.target.value
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TIMELINE */}

                <div>
                  <SectionHeading
                    icon={Clock3}
                    title="Audit & Dispatch Timeline"
                  />

                  <div className="relative space-y-5 pl-6">
                    <span className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />

                    <TimelineItem
                      title="Order created"
                      description="Order record created in the system."
                      date={formatDate(
                        viewOrder.createdAt ||
                          viewOrder.orderDate
                      )}
                    />

                    {viewOrder.dispatchedDate && (
                      <TimelineItem
                        title="Order dispatched"
                        description="Dispatch date recorded against this order."
                        date={formatDate(
                          viewOrder.dispatchedDate
                        )}
                        active
                      />
                    )}

                    {viewOrder.deliveredDate && (
                      <TimelineItem
                        title="Order delivered"
                        description="Delivery date recorded against this order."
                        date={formatDate(
                          viewOrder.deliveredDate
                        )}
                        active
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* DETAIL FOOTER */}

            <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <FileText size={13} />
                  Print
                </button>

                <button
                  type="button"
                  onClick={() => openEditModal(viewOrder)}
                  disabled={!canEdit}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil size={13} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleStatusChange(
                      viewOrder,
                      "Ready for Dispatch"
                    )
                  }
                  disabled={
                    viewOrder.status === "Ready for Dispatch" ||
                    viewOrder.status === "Dispatched" ||
                    viewOrder.status === "Delivered" ||
                    viewOrder.status === "Cancelled"
                  }
                  className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#002244] px-3 text-xs font-semibold text-white transition hover:bg-[#00335f] disabled:cursor-not-allowed disabled:bg-slate-300 sm:col-span-2"
                >
                  <Truck size={13} />
                  Ready for Dispatch
                </button>

                {(viewOrder.status === "Draft" ||
                  viewOrder.status === "Cancelled") && (
                  <button
                    type="button"
                    onClick={() => handleDelete(viewOrder)}
                    disabled={deleting}
                    className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-4"
                  >
                    <Trash2 size={13} />
                    {deleting
                      ? "Deleting..."
                      : "Delete Order"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}

            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    {editingOrder ? (
                      <Pencil size={15} />
                    ) : (
                      <Plus size={16} />
                    )}
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {editingOrder
                      ? "Order Management"
                      : "Commercial Operations"}
                  </span>
                </div>

                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  {editingOrder
                    ? "Edit Order"
                    : "Create New Order"}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {editingOrder
                    ? `Update ${editingOrder.orderNumber}`
                    : "Create a new customer purchase order."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="overflow-y-auto px-6 py-6">
              {!editingOrder ? (
                <>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
                    <FormField label="Customer / Contact" required>
                      <select
                        className={inputClass}
                        name="contact"
                        value={form.contact}
                        onChange={handleChange}
                      >
                        <option value="">Select contact</option>

                        {contacts.map((contact) => (
                          <option
                            key={contact._id}
                            value={contact._id}
                          >
                            {getContactName(contact)}
                            {contact.name && contact.company
                              ? ` — ${contact.name}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Enquiry">
                      <select
                        className={inputClass}
                        name="enquiry"
                        value={form.enquiry}
                        onChange={handleChange}
                      >
                        <option value="">Select enquiry</option>

                        {contacts
                          .filter((contact) => contact.enquiry)
                          .map((contact) => (
                            <option
                              key={
                                contact.enquiry?._id ||
                                contact.enquiry
                              }
                              value={
                                contact.enquiry?._id ||
                                contact.enquiry
                              }
                            >
                              {contact.enquiry?.enquiryNumber ||
                                "Linked enquiry"}
                            </option>
                          ))}
                      </select>
                    </FormField>

                    <FormField label="Product" required>
                      <select
                        className={inputClass}
                        name="product"
                        value={form.product}
                        onChange={(e) => {
                          const productId = e.target.value;

                          const product = products.find(
                            (item) =>
                              item._id === productId
                          );

                          setForm((current) => ({
                            ...current,
                            product: productId,
                            rate:
                              product?.sellingPrice ??
                              product?.price ??
                              "",
                            unit: product?.unit || "kg",
                          }));
                        }}
                      >
                        <option value="">Select product</option>

                        {products.map((product) => (
                          <option
                            key={product._id}
                            value={product._id}
                          >
                            {product.name}
                            {product.code
                              ? ` (${product.code})`
                              : product.productCode
                              ? ` (${product.productCode})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Quantity" required>
                      <input
                        className={inputClass}
                        type="number"
                        min="0.01"
                        step="0.01"
                        name="quantity"
                        value={form.quantity}
                        onChange={handleChange}
                        placeholder="0"
                      />
                    </FormField>

                    <FormField label="Unit">
                      <select
                        className={inputClass}
                        name="unit"
                        value={form.unit}
                        onChange={handleChange}
                      >
                        <option value="kg">Kg</option>
                        <option value="ton">Ton</option>
                        <option value="meter">Meter</option>
                        <option value="piece">Piece</option>
                        <option value="coil">Coil</option>
                      </select>
                    </FormField>

                    <FormField label="Rate / Unit" required>
                      <div className="relative">
                        <IndianRupee
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                          className={`${inputClass} pl-9`}
                          type="number"
                          min="0"
                          step="0.01"
                          name="rate"
                          value={form.rate}
                          onChange={handleChange}
                          placeholder="0.00"
                        />
                      </div>
                    </FormField>

                    <FormField label="Item Discount">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        name="itemDiscount"
                        value={form.itemDiscount}
                        onChange={handleChange}
                        placeholder="0"
                      />
                    </FormField>

                    <FormField label="Order Discount">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        name="discount"
                        value={form.discount}
                        onChange={handleChange}
                        placeholder="0"
                      />
                    </FormField>

                    <FormField label="Tax %">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        name="taxPercent"
                        value={form.taxPercent}
                        onChange={handleChange}
                      />
                    </FormField>

                    <FormField label="Expected Delivery">
                      <input
                        className={inputClass}
                        type="date"
                        name="expectedDeliveryDate"
                        value={form.expectedDeliveryDate}
                        onChange={handleChange}
                      />
                    </FormField>

                    <FormField label="Shipping Address" full>
                      <textarea
                        className={textareaClass}
                        name="shippingAddress"
                        value={form.shippingAddress}
                        onChange={handleChange}
                        placeholder="Enter delivery / site address..."
                        rows="3"
                      />
                    </FormField>

                    <FormField label="Billing Address" full>
                      <textarea
                        className={textareaClass}
                        name="billingAddress"
                        value={form.billingAddress}
                        onChange={handleChange}
                        placeholder="Enter billing address..."
                        rows="3"
                      />
                    </FormField>

                    <FormField label="Notes" full>
                      <textarea
                        className={textareaClass}
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        placeholder="Additional order notes..."
                        rows="3"
                      />
                    </FormField>
                  </div>

                  {/* ORDER PREVIEW */}

                  <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Order Preview
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
                      <PreviewMetric
                        label="Line Amount"
                        value={formatCurrency(
                          calculatedItemAmount
                        )}
                      />

                      <PreviewMetric
                        label="Order Discount"
                        value={formatCurrency(form.discount)}
                      />

                      <PreviewMetric
                        label={`Tax (${form.taxPercent || 0}%)`}
                        value={formatCurrency(estimatedTax)}
                      />

                      <PreviewMetric
                        label="Estimated Total"
                        value={formatCurrency(
                          estimatedGrandTotal
                        )}
                        highlight
                      />
                    </div>

                    <div className="border-t border-slate-200 px-4 py-3">
                      <p className="text-[11px] leading-5 text-slate-500">
                        Final subtotal, tax amount and grand total are
                        calculated by the backend when the order is created.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* EDIT ORDER INFORMATION */}

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <FileText
                        size={15}
                        className="text-slate-500"
                      />

                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Order Information
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <DetailMetric
                        label="Order Number"
                        value={editingOrder.orderNumber}
                      />

                      <DetailMetric
                        label="Customer"
                        value={getContactName(
                          editingOrder.contact
                        )}
                      />

                      <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Current Status
                        </span>

                        <div className="mt-1.5">
                          <StatusBadge
                            status={editingOrder.status}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* EDIT FORM */}

                  <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
                    <FormField label="Expected Delivery">
                      <input
                        className={inputClass}
                        type="date"
                        name="expectedDeliveryDate"
                        value={form.expectedDeliveryDate}
                        onChange={handleChange}
                      />
                    </FormField>

                    <FormField label="Order Discount">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        name="discount"
                        value={form.discount}
                        onChange={handleChange}
                      />
                    </FormField>

                    <FormField label="Tax %">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.01"
                        name="taxPercent"
                        value={form.taxPercent}
                        onChange={handleChange}
                      />
                    </FormField>

                    <FormField label="Shipping Address">
                      <textarea
                        className={textareaClass}
                        name="shippingAddress"
                        value={form.shippingAddress}
                        onChange={handleChange}
                        rows="3"
                      />
                    </FormField>

                    <FormField label="Billing Address">
                      <textarea
                        className={textareaClass}
                        name="billingAddress"
                        value={form.billingAddress}
                        onChange={handleChange}
                        rows="3"
                      />
                    </FormField>

                    <FormField label="Notes" full>
                      <textarea
                        className={`${textareaClass} min-h-[90px]`}
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        rows="3"
                        placeholder="Additional order notes..."
                      />
                    </FormField>
                  </div>

                  <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-3">
                    <p className="text-[11px] leading-5 text-amber-700">
                      Product, quantity, contact and other order items are
                      not changed here because the current backend only
                      permits editing delivery, address, notes, discount
                      and tax after creation.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* MODAL FOOTER */}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  editingOrder
                    ? handleUpdate
                    : handleCreate
                }
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00335f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && (
                  <RefreshCw
                    size={14}
                    className="animate-spin"
                  />
                )}

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

/*
 * ---------------------------------------------------------
 * REUSABLE UI
 * ---------------------------------------------------------
 */

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

const textareaClass =
  "min-h-[84px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

function KpiCard({
  label,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              {label}
            </p>

            <p className="mt-2 text-2xl font-bold tracking-tight !text-black">
              {value}
            </p>

            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {description}
            </p>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon size={17} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton({
  width = "w-20",
  rounded = false,
}) {
  return (
    <div
      className={`h-4 ${width} animate-pulse bg-slate-100 ${
        rounded ? "rounded-full" : "rounded"
      }`}
    />
  );
}

function SectionHeading({
  icon: Icon,
  title,
  iconWrapper = "bg-slate-100 text-slate-500",
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconWrapper}`}
      >
        <Icon size={14} />
      </div>

      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
    </div>
  );
}

function FormField({
  label,
  required = false,
  full = false,
  children,
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}

        {required && (
          <span className="ml-1 text-rose-500">*</span>
        )}
      </label>

      {children}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[11px] font-medium text-slate-400">
        {label}
      </span>

      <span className="max-w-[65%] text-right text-xs font-semibold leading-5 text-slate-700">
        {value || "—"}
      </span>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  strong = false,
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>

      <span
        className={`mt-1 block break-words text-xs ${
          strong
            ? "font-bold text-slate-800"
            : "font-semibold text-slate-700"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  highlight = false,
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-bold ${
          highlight ? "text-[#002244]" : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TimelineItem({
  title,
  description,
  date,
  active = false,
}) {
  return (
    <div className="relative">
      <span
        className={`absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ring-1 ${
          active
            ? "bg-[#002244] ring-[#002244]/20"
            : "bg-slate-300 ring-slate-200"
        }`}
      />

      <p className="text-xs font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-1 text-[11px] leading-5 text-slate-500">
        {description}
      </p>

      <span className="mt-1.5 block text-[10px] font-medium text-slate-400">
        {date}
      </span>
    </div>
  );
}

export default Orders;