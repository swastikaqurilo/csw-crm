import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Download,
  FileText,
  ArrowUpRight,
  CreditCard,
  Clock3,
  CheckCircle2,
  CalendarDays,
  Building2,
  ReceiptText,
  Wallet,
  CircleDollarSign,
} from "lucide-react";

import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentSummary,
  getOrders,
} from "../api/api";

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
  "Failed",
  "Bounced",
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

    case "Failed":
      return "border-red-200 bg-red-50 text-red-700";

    case "Bounced":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "Cancelled":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getPaymentReference(payment) {
  return payment?.transactionId || payment?.chequeNumber || "—";
}

function getCustomerName(payment) {
  return (
    payment?.contact?.company ||
    payment?.contact?.name ||
    "Unknown Customer"
  );
}

function getOrderNumber(payment) {
  return payment?.order?.orderNumber || "—";
}

function getStatusIcon(status) {
  switch (status) {
    case "Completed":
      return CheckCircle2;

    case "Pending":
      return Clock3;

    case "Failed":
      return X;

    default:
      return Clock3;
  }
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600";

const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

function Payments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("All Methods");
  const [statusFilter, setStatusFilter] = useState("All Records");

  const [selectedId, setSelectedId] = useState(null);

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
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const PAYMENTS_PER_PAGE = 8;

  /*
   * FETCH PAYMENTS
   */
  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getPayments({
        page,
        limit: PAYMENTS_PER_PAGE,
        ...(search.trim()
          ? { search: search.trim() }
          : {}),
        ...(methodFilter !== "All Methods"
          ? { paymentMode: methodFilter }
          : {}),
        ...(statusFilter !== "All Records"
          ? { status: statusFilter }
          : {}),
      });

      const data = response?.data?.data || [];

      setPayments(data);
      setPages(response?.data?.pages || 1);
      setTotal(response?.data?.total || 0);

      if (data.length > 0) {
        setSelectedId((current) => {
          const exists = data.some(
            (payment) => payment._id === current
          );

          return exists ? current : data[0]._id;
        });
      } else {
        setSelectedId(null);
      }
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

  /*
   * FETCH SUMMARY
   */
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

  /*
   * FETCH ORDERS
   */
  const fetchOrders = async () => {
    try {
      const response = await getOrders({
        page: 1,
        limit: 100,
      });

      setOrders(response?.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, search, methodFilter, statusFilter]);

  useEffect(() => {
    fetchSummary();
    fetchOrders();
  }, []);

  /*
   * SELECTED PAYMENT
   */
  const selectedPayment = useMemo(() => {
    return (
      payments.find(
        (payment) => payment._id === selectedId
      ) ||
      payments[0] ||
      null
    );
  }, [payments, selectedId]);

  /*
   * SELECTED ORDER
   */
  const selectedOrder = useMemo(() => {
    return orders.find(
      (order) => order._id === form.order
    );
  }, [orders, form.order]);

  /*
   * ORDER BALANCE
   */
  const orderBalance = useMemo(() => {
    if (!selectedOrder) {
      return {
        total: 0,
        paid: 0,
        remaining: 0,
      };
    }

    const total = Number(selectedOrder.grandTotal || 0);
    const paid = Number(selectedOrder.amountPaid || 0);

    return {
      total,
      paid,
      remaining: Math.max(0, total - paid),
    };
  }, [selectedOrder]);

  /*
   * PENDING AMOUNT
   */
  const pendingAmount = useMemo(() => {
    const pending = summary.byStatus?.find(
      (item) => item._id === "Pending"
    );

    return pending?.total || 0;
  }, [summary]);

  /*
   * OPEN ADD MODAL
   */
  const openAddModal = () => {
    setEditingPayment(null);

    setForm({
      ...emptyForm,
      paymentDate: new Date()
        .toISOString()
        .split("T")[0],
    });

    setModalOpen(true);
  };

  /*
   * OPEN EDIT MODAL
   */
  const openEditModal = async (payment) => {
    try {
      setSaving(true);

      const response = await getPaymentById(payment._id);

      const fullPayment =
        response?.data?.data || payment;

      setEditingPayment(fullPayment);

      setForm({
        order: fullPayment.order?._id || "",
        amount: fullPayment.amount || "",
        paymentDate: formatDateInput(
          fullPayment.paymentDate
        ),
        paymentMode:
          fullPayment.paymentMode || "Bank Transfer",
        transactionId:
          fullPayment.transactionId || "",
        chequeNumber:
          fullPayment.chequeNumber || "",
        bankName: fullPayment.bankName || "",
        status:
          fullPayment.status || "Completed",
        notes: fullPayment.notes || "",
        attachmentUrl:
          fullPayment.attachmentUrl || "",
      });

      setModalOpen(true);
    } catch (err) {
      console.error("Failed to load payment:", err);

      window.alert(
        err?.response?.data?.message ||
          "Failed to load payment details."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * CLOSE MODAL
   */
  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingPayment(null);
    setForm(emptyForm);
  };

  /*
   * FORM CHANGE
   */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /*
   * ORDER CHANGE
   */
  const handleOrderChange = (e) => {
    const orderId = e.target.value;

    setForm((current) => ({
      ...current,
      order: orderId,
      amount: "",
    }));
  };

  /*
   * VALIDATE PAYMENT
   */
  const validatePaymentForm = () => {
    if (!form.order) {
      window.alert("Please select an order.");
      return false;
    }

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      window.alert(
        "Payment amount must be greater than 0."
      );
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

    const needsTransactionId = [
      "UPI",
      "NEFT",
      "RTGS",
      "Bank Transfer",
    ].includes(form.paymentMode);

    if (
      needsTransactionId &&
      !form.transactionId.trim()
    ) {
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
        window.alert(
          "Bank name is required for cheque payments."
        );
        return false;
      }
    }

    return true;
  };

  /*
   * CREATE / UPDATE PAYMENT
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePaymentForm()) return;

    try {
      setSaving(true);

      if (editingPayment) {
        const payload = {
          paymentMode: form.paymentMode,
          transactionId:
            form.transactionId.trim() || undefined,
          chequeNumber:
            form.chequeNumber.trim() || undefined,
          bankName:
            form.bankName.trim() || undefined,
          notes:
            form.notes.trim() || undefined,
          status: form.status,
          paymentDate:
            form.paymentDate || undefined,
          attachmentUrl:
            form.attachmentUrl.trim() ||
            undefined,
        };

        await updatePayment(
          editingPayment._id,
          payload
        );

        window.alert(
          "Payment updated successfully."
        );
      } else {
        const payload = {
          order: form.order,
          amount: Number(form.amount),
          currency: "INR",
          paymentDate:
            form.paymentDate || undefined,
          paymentMode: form.paymentMode,
          transactionId:
            form.transactionId.trim() || undefined,
          chequeNumber:
            form.chequeNumber.trim() || undefined,
          bankName:
            form.bankName.trim() || undefined,
          status: form.status,
          notes:
            form.notes.trim() || undefined,
          attachmentUrl:
            form.attachmentUrl.trim() ||
            undefined,
        };

        await createPayment(payload);

        window.alert(
          "Payment recorded successfully."
        );
      }

      setModalOpen(false);
      setEditingPayment(null);
      setForm(emptyForm);

      await Promise.all([
        fetchPayments(),
        fetchSummary(),
        fetchOrders(),
      ]);
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

  /*
   * DELETE PAYMENT
   */
  const handleDelete = async (payment) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${payment.paymentNumber}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await deletePayment(payment._id);

      if (selectedId === payment._id) {
        setSelectedId(null);
      }

      window.alert(
        "Payment deleted and order balance updated successfully."
      );

      await Promise.all([
        fetchPayments(),
        fetchSummary(),
        fetchOrders(),
      ]);
    } catch (err) {
      console.error("Payment delete error:", err);

      window.alert(
        err?.response?.data?.message ||
          "Failed to delete payment."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * PAGINATION
   */
  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > pages) return;

    setPage(nextPage);
  };

  /*
   * PRINT
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-5 pb-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Treasury & Settlements · Ledger Gateway
          </div>

          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">
            Payments & Settlements
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Track customer receivables, banking
            reconciliations, and real-time
            receivables across commercial contracts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={handlePrint}
          >
            <Download size={15} />
            Report Ledger
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

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />

          <span>{error}</span>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* TOTAL COLLECTED */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Total Payments Collected
              </span>

              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {summaryLoading
                  ? "—"
                  : formatCurrency(
                      summary.totalCollected
                    )}
              </div>

              <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                <ArrowUpRight size={12} />

                {summary.totalCollectedCount} completed
                payments
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Wallet size={17} />
            </div>
          </div>
        </div>

        {/* COMPLETED */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Completed Payments
              </span>

              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {summaryLoading
                  ? "—"
                  : summary.totalCollectedCount}
              </div>

              <div className="mt-1.5 text-[11px] font-medium text-slate-500">
                Active payment records
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={17} />
            </div>
          </div>
        </div>

        {/* PENDING */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Pending Settlements
              </span>

              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {summaryLoading
                  ? "—"
                  : formatCurrency(pendingAmount)}
              </div>

              <div className="mt-1.5 text-[11px] font-medium text-amber-600">
                Pending payment records
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock3 size={17} />
            </div>
          </div>
        </div>

        {/* TODAY */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Received Today
              </span>

              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {summaryLoading
                  ? "—"
                  : formatCurrency(summary.totalToday)}
              </div>

              <div className="mt-1.5 text-[11px] font-medium text-slate-500">
                {summary.totalTodayCount} completed today
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <CalendarDays size={17} />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by payment ID, transaction ID, cheque..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:bg-white focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <select
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
          value={methodFilter}
          onChange={(e) => {
            setMethodFilter(e.target.value);
            setPage(1);
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
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option>All Records</option>

          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* TABLE */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Payment Ledger
              </h2>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Customer payment and settlement records
              </p>
            </div>

            <div className="flex h-8 items-center gap-1.5 rounded-md bg-slate-100 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <ReceiptText size={13} />
              {total} Records
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Payment Ref
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Order
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Customer Account
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Settled Amount
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Booking Date
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Method & Instrument
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Status
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-12 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#0f172a]" />

                        <span className="text-xs text-slate-500">
                          Loading payments...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-12 text-center"
                    >
                      <div className="flex flex-col items-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <CreditCard size={18} />
                        </div>

                        <p className="text-sm font-medium text-slate-700">
                          No payments found
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Try changing your filters or search
                          criteria.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => {
                    const customer =
                      getCustomerName(payment);

                    const StatusIcon = getStatusIcon(
                      payment.status
                    );

                    return (
                      <tr
                        key={payment._id}
                        onClick={() =>
                          setSelectedId(payment._id)
                        }
                        className={`cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 ${
                          selectedId === payment._id
                            ? "bg-slate-50"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-semibold text-[#0f172a]">
                            {payment.paymentNumber}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-slate-700">
                            {getOrderNumber(payment)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                              {customer
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <span className="max-w-[180px] truncate text-xs font-medium text-slate-700">
                              {customer}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span className="text-xs font-semibold text-slate-900">
                            {formatCurrency(
                              payment.amount
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-500">
                            {formatDate(
                              payment.paymentDate
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-xs font-medium text-slate-700">
                            {payment.paymentMode}
                          </div>

                          <div className="mt-0.5 max-w-[150px] truncate font-mono text-[10px] text-slate-400">
                            {getPaymentReference(
                              payment
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusClasses(
                              payment.status
                            )}`}
                          >
                            <StatusIcon size={11} />
                            {payment.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewPayment(payment);
                              }}
                              title="View payment"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(payment);
                              }}
                              title="Edit payment"
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(payment);
                              }}
                              title="Delete payment"
                              disabled={saving}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          
          {/* PAGINATION */}
<div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
  <span className="text-[11px] text-slate-500">
    Showing{" "}
    <span className="font-semibold text-slate-700">
      {total === 0 ? 0 : (page - 1) * PAYMENTS_PER_PAGE + 1}
    </span>{" "}
    to{" "}
    <span className="font-semibold text-slate-700">
      {Math.min(page * PAYMENTS_PER_PAGE, total)}
    </span>{" "}
    of{" "}
    <span className="font-semibold text-slate-700">
      {total}
    </span>{" "}
    payment records
  </span>

  <div className="flex items-center gap-1">
    {/* PREVIOUS */}
    <button
      type="button"
      disabled={page <= 1}
      onClick={() => goToPage(page - 1)}
      className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Previous
    </button>

    {/* PAGE NUMBERS */}
    {Array.from(
      { length: pages },
      (_, index) => index + 1
    ).map((pageNumber) => (
      <button
        key={pageNumber}
        type="button"
        onClick={() => goToPage(pageNumber)}
        className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition-colors ${
          page === pageNumber
            ? "bg-[#0f172a] text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {pageNumber}
      </button>
    ))}

    {/* NEXT */}
    <button
      type="button"
      disabled={page >= pages}
      onClick={() => goToPage(page + 1)}
      className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Next
    </button>
  </div>
</div>
        </div>

      </div>

      {/* POLICY NOTE */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-700 shadow-sm">
            <ReceiptText size={14} />
          </div>

          <strong className="text-xs font-semibold text-slate-800">
            Payment Recording Policy
          </strong>
        </div>

        <span className="text-[11px] leading-5 text-slate-500">
          Completed payments are automatically applied
          to the linked order balance. Pending, Failed,
          Bounced, and Cancelled payments are recorded
          for audit purposes but do not affect the
          order's amount paid.
        </span>
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Treasury Entry
                </div>

                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {editingPayment
                    ? "Edit Payment"
                    : "Record New Payment"}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {editingPayment
                    ? "Update the payment information."
                    : "Record money received from a customer."}
                </p>
              </div>

              <button
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                type="button"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* ORDER */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Order *
                    </label>

                    <select
                      className={inputClass}
                      name="order"
                      value={form.order}
                      onChange={handleOrderChange}
                      disabled={Boolean(
                        editingPayment
                      )}
                      required
                    >
                      <option value="">
                        Select an order
                      </option>

                      {orders.map((order) => (
                        <option
                          key={order._id}
                          value={order._id}
                        >
                          {order.orderNumber} —{" "}
                          {order.contact?.company ||
                            order.contact?.name ||
                            "Customer"}{" "}
                          —{" "}
                          {formatCurrency(
                            order.grandTotal
                          )}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ORDER BALANCE */}
                  {selectedOrder && (
                    <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <CircleDollarSign
                          size={15}
                          className="text-slate-600"
                        />

                        <span className="text-xs font-semibold text-slate-800">
                          Order Payment Position
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className={labelClass}>
                            Order Total
                          </span>

                          <strong className="text-sm text-slate-800">
                            {formatCurrency(
                              orderBalance.total
                            )}
                          </strong>
                        </div>

                        <div>
                          <span className={labelClass}>
                            Already Paid
                          </span>

                          <strong className="text-sm text-slate-800">
                            {formatCurrency(
                              orderBalance.paid
                            )}
                          </strong>
                        </div>

                        <div>
                          <span className={labelClass}>
                            Remaining Balance
                          </span>

                          <strong className="text-sm font-semibold text-[#0f172a]">
                            {formatCurrency(
                              orderBalance.remaining
                            )}
                          </strong>
                        </div>

                        <div>
                          <span className={labelClass}>
                            Payment Status
                          </span>

                          <strong className="text-sm text-slate-800">
                            {selectedOrder.paymentStatus ||
                              "Pending"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AMOUNT */}
                  <div>
                    <label className={labelClass}>
                      Amount *
                    </label>

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
                      disabled={Boolean(
                        editingPayment
                      )}
                    />

                    {!editingPayment &&
                      selectedOrder &&
                      orderBalance.remaining > 0 && (
                        <span className="mt-1.5 block text-[10px] text-slate-400">
                          Maximum:{" "}
                          <strong className="font-semibold text-slate-600">
                            {formatCurrency(
                              orderBalance.remaining
                            )}
                          </strong>
                        </span>
                      )}
                  </div>

                  {/* DATE */}
                  <div>
                    <label className={labelClass}>
                      Payment Date
                    </label>

                    <input
                      className={inputClass}
                      type="date"
                      name="paymentDate"
                      value={form.paymentDate}
                      onChange={handleChange}
                    />
                  </div>

                  {/* PAYMENT MODE */}
                  <div>
                    <label className={labelClass}>
                      Payment Mode *
                    </label>

                    <select
                      className={inputClass}
                      name="paymentMode"
                      value={form.paymentMode}
                      onChange={handleChange}
                      required
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option
                          key={mode}
                          value={mode}
                        >
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* STATUS */}
                  <div>
                    <label className={labelClass}>
                      Status *
                    </label>

                    <select
                      className={inputClass}
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      required
                    >
                      {PAYMENT_STATUSES.map(
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

                  {/* TRANSACTION ID */}
                  {[
                    "UPI",
                    "NEFT",
                    "RTGS",
                    "Bank Transfer",
                  ].includes(form.paymentMode) && (
                    <div>
                      <label className={labelClass}>
                        Transaction ID *
                      </label>

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

                  {/* CHEQUE NUMBER */}
                  {form.paymentMode === "Cheque" && (
                    <div>
                      <label className={labelClass}>
                        Cheque Number *
                      </label>

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

                  {/* BANK NAME */}
                  {form.paymentMode === "Cheque" && (
                    <div>
                      <label className={labelClass}>
                        Bank Name *
                      </label>

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

                  {/* NOTES */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Notes
                    </label>

                    <textarea
                      className="min-h-[90px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0f172a] focus:ring-2 focus:ring-slate-900/10"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="Optional payment notes"
                      rows="3"
                    />
                  </div>

                  {/* ATTACHMENT */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Attachment URL
                    </label>

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

              {/* FOOTER */}
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
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

      {viewPayment && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
    onClick={() => setViewPayment(null)}
  >
    <div
      className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Active Reconciliation
          </p>

          <div className="mt-1 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {viewPayment.paymentNumber}
            </h2>

            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
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

      {/* Content */}
      <div className="overflow-y-auto px-6 py-5">
        {/* Payment Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Linked Order
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {viewPayment.order?.orderNumber || "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Customer
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {viewPayment.order?.contact?.company ||
                viewPayment.order?.contact?.name ||
                "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Payment Amount
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              ₹
              {Number(viewPayment.amount || 0).toLocaleString("en-IN")}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Payment Date
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {viewPayment.paymentDate
                ? new Date(viewPayment.paymentDate).toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }
                  )
                : "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Payment Mode
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {viewPayment.paymentMode || "—"}
            </p>
          </div>
        </div>

        {/* Milestone */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-800">
              Payment Milestone Status
            </p>

            <span className="text-xs font-semibold text-slate-700">
              {viewPayment.order?.amount
                ? (
                    (Number(viewPayment.amount || 0) /
                      Number(viewPayment.order.amount)) *
                    100
                  ).toFixed(1)
                : "0.0"}
              %
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[#0f172a]"
              style={{
                width: `${
                  viewPayment.order?.amount
                    ? Math.min(
                        (Number(viewPayment.amount || 0) /
                          Number(viewPayment.order.amount)) *
                          100,
                        100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>Realized</span>

            <span>
              Remaining:{" "}
              <span className="font-semibold text-slate-700">
                ₹
                {Number(
                  viewPayment.order?.amount -
                    viewPayment.amount || 0
                ).toLocaleString("en-IN")}
              </span>
            </span>
          </div>
        </div>

        {/* Ledger Audit */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-900">
            Ledger Audit Track
          </p>

          <div className="mt-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                {viewPayment.paymentMode?.slice(0, 3).toUpperCase() ||
                  "PAY"}
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {viewPayment.paymentMode || "Payment"}
                </p>

                <p className="mt-1 text-[11px] text-slate-500">
                  Reference:{" "}
                  <span className="font-medium text-slate-700">
                    {viewPayment.transactionId ||
                      viewPayment.referenceNumber ||
                      "—"}
                  </span>
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  Recorded{" "}
                  {viewPayment.createdAt
                    ? new Date(
                        viewPayment.createdAt
                      ).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-900">
            Payment Details
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Amount
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                ₹
                {Number(viewPayment.amount || 0).toLocaleString(
                  "en-IN"
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Currency
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-800">
                {viewPayment.currency || "INR"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Applied to Order
              </p>

              <p className="mt-1 text-sm font-semibold text-emerald-600">
                Yes
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-xs font-medium text-slate-600">
              Reconciled
            </span>

            <span className="text-xs font-semibold text-emerald-600">
              Yes
            </span>
          </div>
        </div>

        {/* Notes */}
        {viewPayment.notes && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-900">
              Notes
            </p>

            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
              <p className="text-sm leading-6 text-slate-600">
                {viewPayment.notes}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
        <button
          type="button"
          onClick={handlePrint}
          className={secondaryButtonClass}
        >
          <FileText size={15} />
          Print Receipt
        </button>

        <button
          type="button"
          onClick={() => {
            setViewPayment(null);
            openEditModal(viewPayment);
          }}
          className={primaryButtonClass}
        >
          <Pencil size={15} />
          Edit Payment
        </button>
      </div>
    </div>
  </div>
)}
    </div>

    
  );
}

export default Payments;