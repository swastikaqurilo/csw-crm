import React, { useEffect, useMemo, useState, Fragment } from "react";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Download,
  FileText,
  CreditCard,
  Clock3,
  CheckCircle2,
  CalendarDays,
  ReceiptText,
  Wallet,
  CircleDollarSign,
  Inbox,
  Layers,
  Split,
  History,
  Smartphone,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentSummary,
  getOrders,
  getPaymentsByOrder,
  exportRevenueLedger,
} from "../api/api";

import DateFilter, { isWithinRange } from "../components/DateFilter";

const emptyForm = {
  order: "",
  amount: "",
  paymentDate: "",
  paymentMode: "Bank Transfer",
  transactionId: "",
  chequeNumber: "",
  bankName: "",
  status: "Completed",
  notes: "",
  attachmentUrl: "",
};

const PAYMENT_MODES = [
  "Bank Transfer",
  "UPI",
  "Cheque",
  "Cash",
  "NEFT",
  "RTGS",
  "Other",
];

const PAYMENT_STATUSES = [
  "Pending",
  "Completed",
  "Cancelled",
];

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

function getStatusClasses(status) {
  switch (status) {
    case "Completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Cancelled":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "Paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Partial":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getPaymentReference(payment) {
  return payment?.transactionId || payment?.chequeNumber || "—";
}

function getCustomerName(payment) {
  return (
    payment?.order?.contact?.company ||
    payment?.order?.contact?.name ||
    payment?.order?.customerName ||
    payment?.contact?.company ||
    payment?.contact?.name ||
    "Unknown Customer"
  );
}

function getCustomerPhone(payment) {
  return (
    payment?.order?.contact?.phone ||
    payment?.order?.customerPhone ||
    payment?.contact?.phone ||
    "—"
  );
}

function getOrderNumber(payment) {
  return payment?.order?.orderNumber || "—";
}

function getStatusIcon(status) {
  switch (status) {
    case "Completed":
    case "Paid":
      return CheckCircle2;
    case "Pending":
    case "Partial":
      return Clock3;
    case "Failed":
      return X;
    default:
      return Clock3;
  }
}

function getModeIcon(mode) {
  switch (mode) {
    case "UPI":
      return Smartphone;
    case "Cash":
      return Wallet;
    case "Cheque":
      return FileText;
    default:
      return CreditCard;
  }
}

/* ---------- DESIGN TOKENS (unchanged class strings, refined) ---------- */
const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0f172a] focus:ring-4 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500";

const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:bg-slate-800 hover:shadow-[0_4px_10px_rgba(15,23,42,0.15)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

function Payments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("All Methods");
  const [statusFilter, setStatusFilter] = useState("All Records");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  const [summary, setSummary] = useState({
    totalCollected: 0,
    totalCollectedCount: 0,
    totalToday: 0,
    totalTodayCount: 0,
    byStatus: [],
  });

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  const [orderPaymentData, setOrderPaymentData] = useState({
    order: null,
    payments: [],
  });
  const [orderPaymentLoading, setOrderPaymentLoading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const ORDERS_PER_PAGE = 10;

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch a large limit to group by order on the frontend.
      // For large datasets, the backend should support grouping/pagination by order.
      const response = await getPayments({
        page: 1,
        limit: 1000,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(methodFilter !== "All Methods" ? { paymentMode: methodFilter } : {}),
        ...(statusFilter !== "All Records" ? { status: statusFilter } : {}),
        ...(dateFrom ? { from: dateFrom } : {}),
        ...(dateTo ? { to: dateTo } : {}),
      });

      const data = response?.data?.data || [];
      setPayments(data);
      
      // Reset page when filters change
      setPage(1);
    } catch (err) {
      console.error("Failed to fetch payments:", err);
      setError(
        err?.response?.data?.message ||
          "Failed to load payments. Please check the backend connection."
      );
      setPayments([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await getPaymentSummary();
      setSummary(
        response?.data?.data || {
          totalCollected: 0,
          totalCollectedCount: 0,
          totalToday: 0,
          totalTodayCount: 0,
          byStatus: [],
        }
      );
    } catch (err) {
      console.error("Failed to fetch payment summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await getOrders({ page: 1, limit: 100 });
      setOrders(response?.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, methodFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSummary();
    fetchOrders();
  }, []);

  // ============ GROUPED PAYMENTS LOGIC ============
  const groupedPayments = useMemo(() => {
    const groups = {};

    const getTimestamp = (dateVal) => {
      if (!dateVal) return 0;
      const time = new Date(dateVal).getTime();
      return isNaN(time) ? 0 : time;
    };

    payments.forEach((payment) => {
      const orderId = payment.order?._id || payment.order;
      if (!orderId) return;

      if (!groups[orderId]) {
        groups[orderId] = {
          order: payment.order || { _id: orderId, orderNumber: "Unknown Order" },
          payments: [],
          totalAmount: 0,
          completedAmount: 0,
          pendingAmount: 0,
          latestDate: payment.paymentDate,
          latestTimestamp: getTimestamp(payment.paymentDate),
          status: "Pending",
        };
      }

      const group = groups[orderId];
      group.payments.push(payment);
      group.totalAmount += Number(payment.amount || 0);

      if (payment.status === "Completed") {
        group.completedAmount += Number(payment.amount || 0);
      }

      const paymentTimestamp = getTimestamp(payment.paymentDate);
      if (paymentTimestamp > group.latestTimestamp) {
        group.latestTimestamp = paymentTimestamp;
        group.latestDate = payment.paymentDate;
      }
    });

    Object.values(groups).forEach((group) => {
      group.payments.sort((a, b) => {
        const timeA = getTimestamp(a.paymentDate);
        const timeB = getTimestamp(b.paymentDate);
        if (timeB !== timeA) return timeB - timeA;
        return (b._id || "").localeCompare(a._id || "");
      });

      const orderTotal = Number(group.order.grandTotal || 0);
      const paid = group.completedAmount;
      
      const remaining = Math.max(0, orderTotal - paid);
      group.pendingAmount = remaining;

      if (remaining <= 0.01 && orderTotal > 0) {
        group.status = "Paid";
      } else if (paid > 0.01 && remaining > 0.01) {
        group.status = "Partial";
      } else if (group.pendingAmount > 0) {
        group.status = "Pending";
      } else {
        group.status = group.order.paymentStatus || "Pending";
      }
    });

    return Object.values(groups).sort((a, b) => {
      if (b.latestTimestamp !== a.latestTimestamp) {
        return b.latestTimestamp - a.latestTimestamp;
      }
      return (b.order.orderNumber || "").localeCompare(a.order.orderNumber || "");
    });
  }, [payments]);

  const totalOrders = groupedPayments.length;
  const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE) || 1;
  const paginatedOrders = groupedPayments.slice(
    (page - 1) * ORDERS_PER_PAGE,
    page * ORDERS_PER_PAGE
  );

  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };


  const collapseAll = () => {
    setExpandedOrders(new Set());
  };

  const selectedPayment = useMemo(() => {
    return (
      payments.find((payment) => payment._id === selectedId) ||
      payments[0] ||
      null
    );
  }, [payments, selectedId]);

  const selectedOrder = useMemo(() => {
    return orders.find((order) => order._id === form.order);
  }, [orders, form.order]);

  const orderBalance = useMemo(() => {
    if (!selectedOrder) return { total: 0, paid: 0, remaining: 0 };
    const total = Number(selectedOrder.grandTotal || 0);
    const paid = Number(selectedOrder.amountPaid || 0);
    return { total, paid, remaining: Math.max(0, total - paid) };
  }, [selectedOrder]);

  const pendingAmount = useMemo(() => {
    const pending = summary.byStatus?.find((item) => item._id === "Pending");
    return pending?.total || 0;
  }, [summary]);

  const pendingCount = useMemo(() => {
    const pending = summary.byStatus?.find((item) => item._id === "Pending");
    return pending?.count || 0;
  }, [summary]);

  const paymentsRemaining = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const order of orders) {
      const balance = Math.max(
        0,
        Number(order.grandTotal || 0) - Number(order.amountPaid || 0)
      );
      if (balance > 0.01) {
        count += 1;
        total += balance;
      }
    }
    return { count, total };
  }, [orders]);

  const partialPayments = useMemo(() => {
    let count = 0;
    let outstanding = 0;
    for (const order of orders) {
      const total = Number(order.grandTotal || 0);
      const paid = Number(order.amountPaid || 0);
      const balance = total - paid;
      if (paid > 0.01 && balance > 0.01) {
        count += 1;
        outstanding += balance;
      }
    }
    return { count, outstanding };
  }, [orders]);

  const hasActiveDateFilter = Boolean(dateFrom || dateTo);

  const openAddModal = () => {
    setEditingPayment(null);
    setForm({
      ...emptyForm,
      paymentDate: new Date().toISOString().split("T")[0],
    });
    setModalOpen(true);
  };

  const openAddModalForOrder = (orderId) => {
    if (!orderId) return;
    setEditingPayment(null);
    setForm({
      ...emptyForm,
      order: orderId,
      paymentDate: new Date().toISOString().split("T")[0],
    });
    setViewPayment(null);
    setModalOpen(true);
  };

  const openEditModal = async (payment) => {
    try {
      setSaving(true);
      const response = await getPaymentById(payment._id);
      const fullPayment = response?.data?.data || payment;

      setEditingPayment(fullPayment);
      setForm({
        order: fullPayment.order?._id || "",
        amount: fullPayment.amount || "",
        paymentDate: formatDateInput(fullPayment.paymentDate),
        paymentMode: fullPayment.paymentMode || "Bank Transfer",
        transactionId: fullPayment.transactionId || "",
        chequeNumber: fullPayment.chequeNumber || "",
        bankName: fullPayment.bankName || "",
        status: fullPayment.status || "Completed",
        notes: fullPayment.notes || "",
        attachmentUrl: fullPayment.attachmentUrl || "",
      });
      setViewPayment(null);
      setModalOpen(true);
    } catch (err) {
      console.error("Failed to load payment:", err);
      window.alert(
        err?.response?.data?.message || "Failed to load payment details."
      );
    } finally {
      setSaving(false);
    }
  };

  const openViewModal = async (payment) => {
    setViewPayment(payment);
    setOrderPaymentData({ order: null, payments: [] });

    const orderId = payment?.order?._id || payment?.order;
    if (!orderId) return;

    try {
      setOrderPaymentLoading(true);
      const response = await getPaymentsByOrder(orderId);
      const payload = response?.data || {};

      setOrderPaymentData({
        order: payload.order || null,
        payments: Array.isArray(payload.data) ? payload.data : [],
      });
    } catch (err) {
      console.error("Failed to load order splits:", err);
    } finally {
      setOrderPaymentLoading(false);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingPayment(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleOrderChange = (e) => {
    const orderId = e.target.value;
    setForm((current) => ({ ...current, order: orderId, amount: "" }));
  };

  const validatePaymentForm = () => {
    if (!form.order) {
      window.alert("Please select an order.");
      return false;
    }

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      window.alert("Payment amount must be greater than 0.");
      return false;
    }

    if (
      !editingPayment &&
      form.status === "Completed" &&
      amount > orderBalance.remaining + 0.01
    ) {
      window.alert(
        `Payment amount cannot exceed the remaining balance of ${formatCurrency(
          orderBalance.remaining
        )}.`
      );
      return false;
    }

    const needsTransactionId = ["UPI", "NEFT", "RTGS", "Bank Transfer"].includes(
      form.paymentMode
    );

    if (needsTransactionId && !form.transactionId.trim()) {
      window.alert(
        `Transaction ID is required for ${form.paymentMode} payments.`
      );
      return false;
    }

    if (form.paymentMode === "Cheque") {
      if (!form.chequeNumber.trim()) {
        window.alert("Cheque number is required.");
        return false;
      }
      if (!form.bankName.trim()) {
        window.alert("Bank name is required for cheque payments.");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePaymentForm()) return;

    try {
      setSaving(true);

      if (editingPayment) {
        const payload = {
          paymentMode: form.paymentMode,
          transactionId: form.transactionId.trim() || undefined,
          chequeNumber: form.chequeNumber.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
          notes: form.notes.trim() || undefined,
          status: form.status,
          paymentDate: form.paymentDate || undefined,
          attachmentUrl: form.attachmentUrl.trim() || undefined,
        };

        await updatePayment(editingPayment._id, payload);
        window.alert("Payment updated successfully.");
      } else {
        const payload = {
          order: form.order,
          amount: Number(form.amount),
          currency: "INR",
          paymentDate: form.paymentDate || undefined,
          paymentMode: form.paymentMode,
          transactionId: form.transactionId.trim() || undefined,
          chequeNumber: form.chequeNumber.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
          attachmentUrl: form.attachmentUrl.trim() || undefined,
        };

        await createPayment(payload);
        window.alert("Payment recorded successfully.");
      }

      setModalOpen(false);
      setEditingPayment(null);
      setForm(emptyForm);

      await Promise.all([fetchPayments(), fetchSummary(), fetchOrders()]);
    } catch (err) {
      console.error("Payment save error:", err);
      window.alert(
        err?.response?.data?.message ||
          "Failed to save payment. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (payment) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${payment.paymentNumber}?`
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      await deletePayment(payment._id);

      if (selectedId === payment._id) setSelectedId(null);

      window.alert("Payment deleted and order balance updated successfully.");
      await Promise.all([fetchPayments(), fetchSummary(), fetchOrders()]);
    } catch (err) {
      console.error("Payment delete error:", err);
      window.alert(
        err?.response?.data?.message || "Failed to delete payment."
      );
    } finally {
      setSaving(false);
    }
  };

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  };

  const handlePrint = () => {
    window.print();
  };

  /* EXPORT LEDGER AS CSV */
  const handleExport = async () => {
    if (exporting) return;

    try {
      setExporting(true);

      const response = await exportRevenueLedger({
        ...(dateFrom ? { from: dateFrom } : {}),
        ...(dateTo ? { to: dateTo } : {}),
        ...(methodFilter !== "All Methods"
          ? { paymentMode: methodFilter }
          : {}),
        ...(statusFilter !== "All Records" ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });

      const contentDisposition =
        response.headers?.["content-disposition"] || "";
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename =
        filenameMatch?.[1] ||
        `payments-ledger-${new Date().toISOString().split("T")[0]}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      window.alert(
        err?.response?.data?.message ||
          "Failed to export ledger. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  /* ============ SPLIT DERIVED VALUES ============ */
  const splitOrder = orderPaymentData.order;
  const splitPayments = orderPaymentData.payments;

  const splitTotals = useMemo(() => {
    if (!splitOrder) return { value: 0, paid: 0, remaining: 0, percent: 0 };

    const value = Number(splitOrder.grandTotal || 0);
    const paid = Number(splitOrder.amountPaid || 0);
    const remaining = Math.max(0, value - paid);
    const percent = value > 0 ? Math.min((paid / value) * 100, 100) : 0;

    return { value, paid, remaining, percent };
  }, [splitOrder]);

  return (
    <div className="w-full space-y-5 pb-8">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          {/* <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Treasury & Settlements · Ledger Gateway
          </div> */}
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900">
            Payments & Settlements
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Track customer receivables, banking reconciliations, and real-time
            receivables across commercial contracts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                Exporting…
              </>
            ) : (
              <>
                <Download size={15} />
                Report Ledger
              </>
            )}
          </button>

          <button
            className={primaryButtonClass}
            type="button"
            onClick={openAddModal}
          >
            <Plus size={16} />
            Record Payment
          </button>
        </div>
      </div>

      {/* ============ ERROR ============ */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500 ring-4 ring-red-500/15" />
          <span className="leading-5">{error}</span>
        </div>
      )}

      {/* ============ KPI CARDS ============ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Collected"
          value={formatCurrency(summary.totalCollected)}
          hint={`${summary.totalCollectedCount} completed payments`}
          hintTone="emerald"
          icon={Wallet}
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
          loading={summaryLoading}
        />

        <KpiCard
          label="Partial Payments"
          value={partialPayments.count}
          hint={`${formatCurrency(partialPayments.outstanding)} outstanding`}
          hintTone="amber"
          icon={Split}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={loading}
        />

        <KpiCard
          label="Received Today"
          value={formatCurrency(summary.totalToday)}
          hint={`${summary.totalTodayCount} payments today`}
          hintTone="slate"
          icon={CalendarDays}
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
          loading={summaryLoading}
        />

        <KpiCard
          label="Payments Remaining"
          value={paymentsRemaining.count}
          hint={`${formatCurrency(paymentsRemaining.total)} outstanding`}
          hintTone="amber"
          icon={Inbox}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={loading}
        />
      </div>

      {/* ============ FILTER BAR ============ */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_1px_3px_rgba(15,23,42,0.02)] lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search by payment ID, transaction ID, cheque..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0f172a] focus:bg-white focus:ring-4 focus:ring-slate-900/5"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all hover:border-slate-300 focus:border-[#0f172a] focus:ring-4 focus:ring-slate-900/5"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
            }}
          >
            <option>All Methods</option>
            {PAYMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all hover:border-slate-300 focus:border-[#0f172a] focus:ring-4 focus:ring-slate-900/5"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
          >
            <option>All Records</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <DateFilter
            from={dateFrom}
            to={dateTo}
            accent="#0f172a"
            onChange={({ from, to }) => {
              setDateFrom(from);
              setDateTo(to);
            }}
          />
        </div>
      </div>

      {/* ============ LEDGER TABLE (GROUPED BY ORDER) ============ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_1px_3px_rgba(15,23,42,0.02)]">
        {/* Table Header Actions */}
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Payment Ledger by Order
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Orders with payments — expand a row to see every payment (LIFO)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={collapseAll}
              className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              Collapse all
            </button>
            <div className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200/70 bg-slate-50 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <ReceiptText size={13} className="text-slate-400" />
              {totalOrders} ORDERS · {payments.length} PAYMENTS
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Order
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Customer
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Payments
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Completed
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Pending
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Latest
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#0f172a]" />
                      <span className="text-xs font-medium text-slate-500">
                        Loading payments…
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/70">
                        <Inbox size={22} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        No payments found
                      </p>
                      <p className="mt-1 max-w-xs text-xs text-slate-400">
                        {hasActiveDateFilter || search
                          ? "Try adjusting the date range, filters, or search."
                          : "Record your first payment to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((group) => {
                  const orderId = group.order._id;
                  const isExpanded = expandedOrders.has(orderId);
                  const customerName =
                    group.order.contact?.company ||
                    group.order.contact?.name ||
                    group.order.customerName ||
                    "Unknown Customer";
                  const customerPhone =
                    group.order.contact?.phone ||
                    group.order.customerPhone ||
                    "—";
                  const StatusIcon = getStatusIcon(group.status);

                  return (
                    <Fragment key={orderId}>
                      {/* PARENT ROW (ORDER) */}
                      <tr
                        className={`group cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 ${
                          isExpanded ? "bg-slate-50/80" : "hover:bg-slate-50/70"
                        }`}
                        onClick={() => toggleExpand(orderId)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <button
                              className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors ${
                                isExpanded
                                  ? "bg-slate-200 text-slate-700"
                                  : "group-hover:bg-slate-200 group-hover:text-slate-700"
                              }`}
                            >
                              {isExpanded ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                            </button>
                            <div>
                              <p className="font-mono text-xs font-semibold tracking-tight text-[#0f172a]">
                                {group.order.orderNumber || "—"}
                              </p>
                              <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                                {group.payments.length} payments
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-200 to-slate-100 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                              {customerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[180px] truncate text-xs font-medium text-slate-700">
                                {customerName}
                              </p>
                              {customerPhone !== "—" && (
                                <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-slate-400">
                                  {customerPhone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(group.totalAmount)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                            {formatCurrency(group.completedAmount)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm font-semibold text-amber-600 tabular-nums">
                            {group.pendingAmount > 0
                              ? formatCurrency(group.pendingAmount)
                              : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-500">
                            {formatDate(group.latestDate)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusClasses(
                              group.status
                            )}`}
                          >
                            <StatusIcon size={11} />
                            {group.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-slate-500 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddModalForOrder(orderId);
                              }}
                              title="Add payment to this order"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* CHILD ROWS (PAYMENTS) */}
                      {isExpanded &&
                        group.payments.map((payment) => {
                          const PaymentStatusIcon = getStatusIcon(
                            payment.status
                          );
                          const ModeIcon = getModeIcon(payment.paymentMode);

                          return (
                            <tr
                              key={payment._id}
                              className="border-b border-slate-100 bg-slate-50/60 transition-colors last:border-b-0 hover:bg-slate-100/60"
                            >
                              <td className="px-4 py-3 pl-14">
                                <div className="relative flex items-center gap-2">
                                  <span className="absolute -left-5 top-1/2 h-px w-3 -translate-y-1/2 bg-slate-300" />
                                  <span className="font-mono text-[11px] font-semibold text-slate-600">
                                    {payment.paymentNumber}
                                  </span>
                                  <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                    <ModeIcon size={10} />
                                    <span>{payment.paymentMode}</span>
                                  </div>
                                  {getPaymentReference(payment) !== "—" && (
                                    <span className="max-w-[100px] truncate font-mono text-[10px] text-slate-400">
                                      {getPaymentReference(payment)}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3"></td>

                              <td className="px-4 py-3 text-right">
                                <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                  {formatCurrency(payment.amount)}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right">
                                <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                                  {payment.status === "Completed"
                                    ? formatCurrency(payment.amount)
                                    : "—"}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right">
                                <span className="text-xs font-semibold text-amber-600 tabular-nums">
                                  {payment.status === "Pending"
                                    ? formatCurrency(payment.amount)
                                    : "—"}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <span className="text-[11px] text-slate-500">
                                  {formatDate(payment.paymentDate)}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${getStatusClasses(
                                    payment.status
                                  )}`}
                                >
                                  <PaymentStatusIcon size={9} />
                                  {payment.status}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-700 hover:shadow-sm"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openViewModal(payment);
                                    }}
                                    title="View payment"
                                  >
                                    <Eye size={13} />
                                  </button>
                                  <button
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-700 hover:shadow-sm"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(payment);
                                    }}
                                    title="Edit payment"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-sm"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(payment);
                                    }}
                                    title="Delete payment"
                                    disabled={saving}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ============ PAGINATION ============ */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {totalOrders === 0 ? 0 : (page - 1) * ORDERS_PER_PAGE + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-700">
              {Math.min(page * ORDERS_PER_PAGE, totalOrders)}
            </span>{" "}
            of <span className="font-semibold text-slate-700">{totalOrders}</span>{" "}
            orders
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => goToPage(pageNumber)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition-all ${
                    page === pageNumber
                      ? "bg-[#0f172a] text-white shadow-[0_1px_2px_rgba(15,23,42,0.15)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {pageNumber}
                </button>
              )
            )}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ============ POLICY NOTE ============ */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <ReceiptText size={14} />
          </div>
          <strong className="text-xs font-semibold text-slate-800">
            Payment Recording Policy
          </strong>
        </div>
        <span className="text-[11px] leading-5 text-slate-500">
          Completed payments are automatically applied to the linked order
          balance. Pending, and Cancelled payments are recorded
          for audit purposes but do not affect the order's amount paid.
        </span>
      </div>

      {/* ============ ADD / EDIT MODAL ============ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-start justify-between border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-5 py-4">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#0f172a] via-slate-500 to-transparent" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Treasury Entry
                </div>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {editingPayment
                    ? "Edit Payment"
                    : form.order && orders.some((o) => o._id === form.order)
                    ? "Add Split Payment"
                    : "Record New Payment"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {editingPayment
                    ? "Update the payment information."
                    : form.order
                    ? "Record an additional payment against this order."
                    : "Record money received from a customer."}
                </p>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                type="button"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Order *</label>
                    <select
                      className={inputClass}
                      name="order"
                      value={form.order}
                      onChange={handleOrderChange}
                      disabled={Boolean(editingPayment)}
                      required
                    >
                      <option value="">Select an order</option>
                      {orders.map((order) => (
                        <option key={order._id} value={order._id}>
                          {order.orderNumber} —{" "}
                          {order.contact?.company ||
                            order.contact?.name ||
                            "Customer"}{" "}
                          — {formatCurrency(order.grandTotal)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedOrder && (
                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <div className="mb-3 flex items-center gap-2">
                        <CircleDollarSign size={15} className="text-slate-600" />
                        <span className="text-xs font-semibold text-slate-800">
                          Order Payment Position
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className={labelClass}>Order Total</span>
                          <strong className="text-sm text-slate-800">
                            {formatCurrency(orderBalance.total)}
                          </strong>
                        </div>
                        <div>
                          <span className={labelClass}>Already Paid</span>
                          <strong className="text-sm text-slate-800">
                            {formatCurrency(orderBalance.paid)}
                          </strong>
                        </div>
                        <div>
                          <span className={labelClass}>Remaining Balance</span>
                          <strong className="text-sm font-semibold text-[#0f172a]">
                            {formatCurrency(orderBalance.remaining)}
                          </strong>
                        </div>
                        <div>
                          <span className={labelClass}>Payment Status</span>
                          <strong className="text-sm text-slate-800">
                            {selectedOrder.paymentStatus || "Pending"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Amount *</label>
                    <input
                      className={inputClass}
                      type="number"
                      name="amount"
                      value={form.amount}
                      onChange={handleChange}
                      placeholder="₹ Amount"
                      min="0.01"
                      step="0.01"
                      required
                      disabled={Boolean(editingPayment)}
                    />
                    {!editingPayment &&
                      selectedOrder &&
                      orderBalance.remaining > 0 && (
                        <span className="mt-1.5 block text-[10px] text-slate-400">
                          Maximum:{" "}
                          <strong className="font-semibold text-slate-600">
                            {formatCurrency(orderBalance.remaining)}
                          </strong>
                        </span>
                      )}
                  </div>

                  <div>
                    <label className={labelClass}>Payment Date</label>
                    <input
                      className={inputClass}
                      type="date"
                      name="paymentDate"
                      value={form.paymentDate}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Payment Mode *</label>
                    <select
                      className={inputClass}
                      name="paymentMode"
                      value={form.paymentMode}
                      onChange={handleChange}
                      required
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Status *</label>
                    <select
                      className={inputClass}
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      required
                    >
                      {PAYMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {["UPI", "NEFT", "RTGS", "Bank Transfer"].includes(
                    form.paymentMode
                  ) && (
                    <div>
                      <label className={labelClass}>Transaction ID *</label>
                      <input
                        className={inputClass}
                        name="transactionId"
                        value={form.transactionId}
                        onChange={handleChange}
                        placeholder="UTR / transaction ID"
                        required
                      />
                    </div>
                  )}

                  {form.paymentMode === "Cheque" && (
                    <div>
                      <label className={labelClass}>Cheque Number *</label>
                      <input
                        className={inputClass}
                        name="chequeNumber"
                        value={form.chequeNumber}
                        onChange={handleChange}
                        placeholder="Cheque number"
                        required
                      />
                    </div>
                  )}

                  {form.paymentMode === "Cheque" && (
                    <div>
                      <label className={labelClass}>Bank Name *</label>
                      <input
                        className={inputClass}
                        name="bankName"
                        value={form.bankName}
                        onChange={handleChange}
                        placeholder="Issuing bank"
                        required
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className={labelClass}>Notes</label>
                    <textarea
                      className="min-h-[90px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0f172a] focus:ring-4 focus:ring-slate-900/5"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="Optional payment notes"
                      rows="3"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass}>Attachment URL</label>
                    <input
                      className={inputClass}
                      name="attachmentUrl"
                      value={form.attachmentUrl}
                      onChange={handleChange}
                      placeholder="Optional receipt / document URL"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingPayment
                    ? "Save Changes"
                    : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ VIEW MODAL (ENHANCED WITH SPLITS) ============ */}
      {viewPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => setViewPayment(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="relative flex items-start justify-between border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 py-5">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#0f172a] via-slate-500 to-transparent" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Active Reconciliation
                </p>
                <div className="mt-1.5 flex items-center gap-3">
                  <h2 className="font-mono text-lg font-semibold tracking-tight text-slate-900">
                    {viewPayment.paymentNumber}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusClasses(
                      viewPayment.status
                    )}`}
                  >
                    {viewPayment.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewPayment(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            {/* BODY */}
            <div className="overflow-y-auto px-6 py-5">
              {/* TOP: Info grid + Order position */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Left: payment details */}
                <div className="space-y-4">
                  <DetailItem
                    label="Linked Order"
                    value={viewPayment.order?.orderNumber || "—"}
                  />
                  <DetailItem
                    label="Customer"
                    value={
                      viewPayment.order?.contact?.company ||
                      viewPayment.order?.contact?.name ||
                      viewPayment.order?.customerName ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Phone"
                    value={
                      viewPayment.order?.contact?.phone ||
                      viewPayment.order?.customerPhone ||
                      "—"
                    }
                  />
                  <DetailItem
                    label="Payment Amount"
                    value={formatCurrency(viewPayment.amount)}
                    emphasize
                  />
                  <DetailItem
                    label="Payment Date"
                    value={formatDate(viewPayment.paymentDate)}
                  />
                  <DetailItem
                    label="Payment Mode"
                    value={viewPayment.paymentMode || "—"}
                  />
                  <DetailItem
                    label="Reference"
                    value={getPaymentReference(viewPayment)}
                  />
                </div>

                {/* Right: order position */}
                <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers size={15} className="text-slate-600" />
                    <span className="text-xs font-semibold text-slate-800">
                      Order Payment Position
                    </span>
                  </div>

                  {orderPaymentLoading ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                      Loading…
                    </div>
                  ) : splitOrder ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            Order Value
                          </span>
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(splitTotals.value)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            Paid so far
                          </span>
                          <span className="text-sm font-semibold text-emerald-700 tabular-nums">
                            {formatCurrency(splitTotals.paid)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            Remaining
                          </span>
                          <span className="text-sm font-semibold text-amber-700 tabular-nums">
                            {formatCurrency(splitTotals.remaining)}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-slate-400">
                          <span>Progress</span>
                          <span className="tabular-nums">{splitTotals.percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                            style={{ width: `${splitTotals.percent}%` }}
                          />
                        </div>
                      </div>

                      {viewPayment.order?.paymentStatus && (
                        <div className="mt-4 border-t border-slate-200 pt-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Order Payment Status
                          </span>
                          <p className="mt-1 text-xs font-semibold text-slate-700">
                            {viewPayment.order.paymentStatus}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Order payment position not available.
                    </p>
                  )}
                </div>
              </div>

              {/* SPLIT TIMELINE */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Split size={15} className="text-slate-600" />
                    <h3 className="text-xs font-semibold text-slate-800">
                      Split Transactions
                    </h3>
                    {splitPayments.length > 0 && (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 tabular-nums">
                        {splitPayments.length}
                      </span>
                    )}
                  </div>
                  {splitPayments.length > 1 && (
                    <span className="text-[10px] font-medium text-slate-400">
                      This order was paid in {splitPayments.length} parts
                    </span>
                  )}
                </div>

                {orderPaymentLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500">
                    Loading split history…
                  </div>
                ) : splitPayments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                    <History size={20} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      No other payments on this order
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {splitPayments.map((split, index) => {
                      const isCurrent = split._id === viewPayment._id;
                      const SplitStatusIcon = getStatusIcon(split.status);

                      return (
                        <div
                          key={split._id || index}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                            isCurrent
                              ? "border-[#0f172a] bg-slate-50 ring-1 ring-[#0f172a]/10"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          {/* Index badge */}
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                              isCurrent
                                ? "bg-[#0f172a] text-white shadow-[0_1px_2px_rgba(15,23,42,0.2)]"
                                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                            }`}
                          >
                            #{index + 1}
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                                {formatCurrency(split.amount)}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(
                                  split.status
                                )}`}
                              >
                                <SplitStatusIcon size={10} />
                                {split.status}
                              </span>
                              {isCurrent && (
                                <span className="rounded-full bg-[#0f172a] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                  Current
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                              <span>{split.paymentMode || "—"}</span>
                              <span className="text-slate-300">·</span>
                              <span>{formatDate(split.paymentDate)}</span>
                              {getPaymentReference(split) !== "—" && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-mono text-[10px]">
                                    {getPaymentReference(split)}
                                  </span>
                                </>
                              )}
                            </div>

                            {split.notes && (
                              <p className="mt-1 truncate text-[11px] text-slate-400">
                                {split.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* NOTES */}
              {viewPayment.notes && (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-slate-900">Notes</p>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <p className="text-sm leading-6 text-slate-600">
                      {viewPayment.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handlePrint}
                className={secondaryButtonClass}
              >
                <FileText size={15} />
                Print Receipt
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(viewPayment)}
                  className={secondaryButtonClass}
                >
                  <Pencil size={15} />
                  Edit Payment
                </button>

                {/* 👇 ADD SPLIT PAYMENT */}
                <button
                  type="button"
                  onClick={() => {
                    const orderId =
                      viewPayment?.order?._id || viewPayment?.order;
                    openAddModalForOrder(orderId);
                  }}
                  disabled={
                    !viewPayment?.order ||
                    (splitTotals.remaining <= 0 &&
                      viewPayment?.order?.paymentStatus === "Paid")
                  }
                  className={primaryButtonClass}
                >
                  <Plus size={15} />
                  Add Split Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ KPI CARD ============ */
function KpiCard({
  label,
  value,
  hint,
  hintTone = "slate",
  icon: Icon,
  iconBg = "bg-slate-100",
  iconColor = "text-slate-700",
  loading = false,
}) {
  const hintColors = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    slate: "text-slate-500",
  };

  const accents = {
    emerald: "from-emerald-400 to-emerald-500",
    amber: "from-amber-400 to-amber-500",
    slate: "from-slate-400 to-slate-500",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_1px_3px_rgba(15,23,42,0.02)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)]">
      <div
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${
          accents[hintTone] || accents.slate
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {label}
          </span>
          <div className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {loading ? "—" : value}
          </div>
          {hint && (
            <div
              className={`mt-1.5 truncate text-[11px] font-medium ${
                hintColors[hintTone] || hintColors.slate
              }`}
            >
              {hint}
            </div>
          )}
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-200/70 ${iconBg} ${iconColor} transition-transform group-hover:scale-105`}
        >
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

/* ============ DETAIL ITEM ============ */
function DetailItem({ label, value, emphasize = false }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm ${
          emphasize
            ? "font-semibold text-slate-900 tabular-nums"
            : "font-medium text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default Payments;