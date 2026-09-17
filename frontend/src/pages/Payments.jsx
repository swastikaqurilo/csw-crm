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

function getStatusClass(status) {
  if (status === "Completed") return "status-resolved";
  if (status === "Pending") return "status-in-progress";
  if (status === "Failed") return "status-new";
  if (status === "Bounced") return "status-contacted";
  if (status === "Cancelled") return "status-contacted";

  return "status-contacted";
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

  /*
   * FETCH PAYMENTS
   */
  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getPayments({
        page,
        limit: 20,
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
      console.error(
        "Failed to load payment:",
        err
      );

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
        window.alert(
          "Cheque number is required."
        );
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
      console.error(
        "Payment save error:",
        err
      );

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
      console.error(
        "Payment delete error:",
        err
      );

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
    <div className="payments-page">
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <div className="pay-breadcrumb">
            TREASURY & SETTLEMENTS · LEDGER GATEWAY
          </div>

          <h1>Payments & Settlements</h1>

          <p>
            Track customer receivables, banking
            reconciliations, and real-time
            receivables across commercial contracts.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handlePrint}
          >
            <Download size={15} />
            Report Ledger
          </button>

          <button
            className="btn btn-primary"
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
        <div
          className="card"
          style={{
            marginBottom: 16,
            padding: 16,
            color: "#b42318",
          }}
        >
          {error}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span className="pay-kpi-label">
              TOTAL PAYMENTS COLLECTED
            </span>
          </div>

          <div className="stat-value">
            {summaryLoading
              ? "—"
              : formatCurrency(
                  summary.totalCollected
                )}
          </div>

          <div className="stat-change text-success">
            <ArrowUpRight size={12} />
            {summary.totalCollectedCount} completed
            payments
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="pay-kpi-label">
              COMPLETED PAYMENTS
            </span>
          </div>

          <div className="stat-value">
            {summaryLoading
              ? "—"
              : summary.totalCollectedCount}
          </div>

          <div className="stat-change">
            Active payment records
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="pay-kpi-label">
              PENDING SETTLEMENTS
            </span>
          </div>

          <div className="stat-value">
            {summaryLoading
              ? "—"
              : formatCurrency(pendingAmount)}
          </div>

          <div className="stat-change text-warning">
            Pending payment records
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="pay-kpi-label">
              RECEIVED TODAY
            </span>
          </div>

          <div className="stat-value">
            {summaryLoading
              ? "—"
              : formatCurrency(summary.totalToday)}
          </div>

          <div className="stat-change">
            {summary.totalTodayCount} completed today
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="pay-filter-bar">
        <div className="pay-search">
          <Search size={15} />

          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by payment ID, transaction ID, cheque..."
          />
        </div>

        <select
          className="filter-select"
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
          className="filter-select"
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

      {/* MAIN TABLE + DETAIL */}
      <div className="pay-workspace">
        {/* TABLE */}
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>PAYMENT REF</th>
                  <th>ORDER</th>
                  <th>CUSTOMER ACCOUNT</th>
                  <th>SETTLED AMOUNT</th>
                  <th>BOOKING DATE</th>
                  <th>METHOD & INSTRUMENT</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign: "center",
                        padding: 40,
                      }}
                    >
                      Loading payments...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign: "center",
                        padding: 40,
                      }}
                    >
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => {
                    const customer =
                      getCustomerName(payment);

                    return (
                      <tr
                        key={payment._id}
                        className={
                          selectedId === payment._id
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setSelectedId(payment._id)
                        }
                      >
                        <td>
                          <span className="font-mono font-semibold text-sm text-brand">
                            {payment.paymentNumber}
                          </span>
                        </td>

                        <td>
                          <strong className="text-sm">
                            {getOrderNumber(payment)}
                          </strong>
                        </td>

                        <td>
                          <div className="flex items-center gap-2">
                            <div className="avatar avatar-sm">
                              {customer
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <span className="text-sm font-medium">
                              {customer}
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {formatCurrency(
                              payment.amount
                            )}
                          </strong>
                        </td>

                        <td className="text-sm text-muted">
                          {formatDate(
                            payment.paymentDate
                          )}
                        </td>

                        <td>
                          <div className="text-sm">
                            {payment.paymentMode}
                          </div>

                          <div className="text-xs text-muted font-mono">
                            {getPaymentReference(
                              payment
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`status ${getStatusClass(
                              payment.status
                            )}`}
                          >
                            {payment.status}
                          </span>
                        </td>

                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-ghost btn-sm"
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
                              className="btn btn-ghost btn-sm"
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
                              className="btn btn-ghost btn-sm"
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
          <div className="pagination">
            <span>
              Showing {payments.length} of {total}{" "}
              payment records
            </span>

            <div className="pagination-buttons">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Previous
              </button>

              <button
                type="button"
                className="active"
                disabled
              >
                {page}
              </button>

              <button
                type="button"
                disabled={page >= pages}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* DETAIL PANEL */}
        {selectedPayment && (
          <aside className="pay-detail card">
            <div className="pay-detail-header">
              <div>
                <div className="pay-detail-label">
                  ACTIVE RECONCILIATION
                </div>

                <h3>
                  {selectedPayment.paymentNumber}
                </h3>
              </div>

              <span
                className={`status ${getStatusClass(
                  selectedPayment.status
                )}`}
              >
                {selectedPayment.status}
              </span>
            </div>

            <div className="pay-detail-body">
              {/* PAYMENT OVERVIEW */}
              <div className="pay-detail-section">
                <div className="pay-detail-row">
                  <span>Linked Order</span>
                  <strong>
                    {getOrderNumber(selectedPayment)}
                  </strong>
                </div>

                <div className="pay-detail-row">
                  <span>Customer</span>
                  <strong>
                    {getCustomerName(selectedPayment)}
                  </strong>
                </div>

                <div className="pay-detail-row">
                  <span>Payment Amount</span>
                  <strong>
                    {formatCurrency(
                      selectedPayment.amount
                    )}
                  </strong>
                </div>

                <div className="pay-detail-row">
                  <span>Payment Date</span>
                  <strong>
                    {formatDate(
                      selectedPayment.paymentDate
                    )}
                  </strong>
                </div>

                <div className="pay-detail-row">
                  <span>Payment Mode</span>
                  <strong>
                    {selectedPayment.paymentMode}
                  </strong>
                </div>
              </div>

              {/* ORDER PAYMENT STATUS */}
              <div className="pay-detail-section">
                <div className="pay-detail-label">
                  PAYMENT MILESTONE STATUS
                </div>

                {selectedPayment?.order ? (
                  (() => {
                    const grandTotal = Number(
                      selectedPayment.order
                        .grandTotal || 0
                    );

                    const amountPaid = Number(
                      selectedPayment.order
                        .amountPaid || 0
                    );

                    const progress =
                      grandTotal > 0
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              (amountPaid /
                                grandTotal) *
                                100
                            )
                          )
                        : 0;

                    const remaining = Math.max(
                      0,
                      grandTotal - amountPaid
                    );

                    return (
                      <>
                        <div className="pay-progress">
                          <div
                            className="pay-progress-bar"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>

                        <div className="pay-progress-meta">
                          <span>
                            {progress.toFixed(1)}%
                            Realized
                          </span>

                          <span>
                            Remaining:{" "}
                            {formatCurrency(
                              remaining
                            )}
                          </span>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="text-sm text-muted">
                    Order information unavailable.
                  </div>
                )}
              </div>

              {/* PAYMENT AUDIT */}
              <div className="pay-detail-section">
                <div className="pay-detail-label">
                  LEDGER AUDIT TRACK
                </div>

                <div className="pay-audit-item">
                  <strong>
                    {selectedPayment.paymentMode ||
                      "—"}
                  </strong>

                  <span>
                    Reference:{" "}
                    {getPaymentReference(
                      selectedPayment
                    )}
                  </span>

                  <span className="text-muted">
                    Recorded{" "}
                    {formatDate(
                      selectedPayment.createdAt
                    )}
                  </span>
                </div>
              </div>

              {/* PAYMENT DETAILS */}
              <div className="pay-detail-section">
                <div className="pay-detail-label">
                  PAYMENT DETAILS
                </div>

                <div className="pay-gst-grid">
                  <div>
                    <span>Amount</span>
                    <strong>
                      {formatCurrency(
                        selectedPayment.amount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Currency</span>
                    <strong>
                      {selectedPayment.currency ||
                        "INR"}
                    </strong>
                  </div>

                  <div>
                    <span>Applied to Order</span>
                    <strong>
                      {selectedPayment.appliedToOrder
                        ? "Yes"
                        : "No"}
                    </strong>
                  </div>

                  <div>
                    <span>Reconciled</span>
                    <strong>
                      {selectedPayment.isReconciled
                        ? "Yes"
                        : "No"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* NOTES */}
              {selectedPayment.notes && (
                <div className="pay-detail-section">
                  <div className="pay-detail-label">
                    NOTES
                  </div>

                  <div className="pay-audit-item">
                    <span>
                      {selectedPayment.notes}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pay-detail-footer">
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={handlePrint}
              >
                <FileText size={13} />
                Print Receipt
              </button>

              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() =>
                  openEditModal(selectedPayment)
                }
              >
                <Pencil size={13} />
                Edit Payment
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* POLICY NOTE */}
      <div className="pay-policy-note">
        <strong>Payment Recording Policy</strong>

        <span>
          Completed payments are automatically applied
          to the linked order balance. Pending, Failed,
          Bounced, and Cancelled payments are recorded
          for audit purposes but do not affect the
          order's amount paid.
        </span>
      </div>

      {/* VIEW MODAL */}
      {viewPayment && (
        <div
          className="modal-overlay"
          onClick={() => setViewPayment(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {viewPayment.paymentNumber}
                </h3>

                <p className="text-muted text-sm">
                  Payment transaction details
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() => setViewPayment(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <span className="form-label">
                    Payment Number
                  </span>

                  <strong>
                    {viewPayment.paymentNumber}
                  </strong>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Order
                  </span>

                  <strong>
                    {getOrderNumber(viewPayment)}
                  </strong>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Customer
                  </span>

                  <strong>
                    {getCustomerName(viewPayment)}
                  </strong>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Amount
                  </span>

                  <strong>
                    {formatCurrency(
                      viewPayment.amount
                    )}
                  </strong>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Date
                  </span>

                  <strong>
                    {formatDate(
                      viewPayment.paymentDate
                    )}
                  </strong>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Payment Mode
                  </span>

                  <strong>
                    {viewPayment.paymentMode}
                  </strong>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Transaction / Cheque Reference
                  </span>

                  <strong className="font-mono">
                    {getPaymentReference(
                      viewPayment
                    )}
                  </strong>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Status
                  </span>

                  <span
                    className={`status ${getStatusClass(
                      viewPayment.status
                    )}`}
                  >
                    {viewPayment.status}
                  </span>
                </div>

                {viewPayment.bankName && (
                  <div className="form-group">
                    <span className="form-label">
                      Bank Name
                    </span>

                    <strong>
                      {viewPayment.bankName}
                    </strong>
                  </div>
                )}

                {viewPayment.chequeNumber && (
                  <div className="form-group">
                    <span className="form-label">
                      Cheque Number
                    </span>

                    <strong>
                      {viewPayment.chequeNumber}
                    </strong>
                  </div>
                )}

                {viewPayment.notes && (
                  <div
                    className="form-group"
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <span className="form-label">
                      Notes
                    </span>

                    <strong>
                      {viewPayment.notes}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setViewPayment(null)
                }
              >
                Close
              </button>

              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setViewPayment(null);
                  openEditModal(viewPayment);
                }}
              >
                <Pencil size={15} />
                Edit Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={closeModal}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 600 }}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {editingPayment
                    ? "Edit Payment"
                    : "Record New Payment"}
                </h3>

                <p className="text-muted text-sm">
                  {editingPayment
                    ? "Update the payment information."
                    : "Record money received from a customer."}
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="grid grid-2 gap-4">
                  {/* ORDER */}
                  <div
                    className="form-group"
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <label className="form-label">
                      Order *
                    </label>

                    <select
                      className="select"
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
                    <div
                      className="form-group"
                      style={{
                        gridColumn: "1 / -1",
                        padding: 14,
                        borderRadius: 8,
                        background:
                          "var(--color-surface-2, #f8fafc)",
                      }}
                    >
                      <div className="grid grid-2 gap-4">
                        <div>
                          <span className="form-label">
                            Order Total
                          </span>

                          <strong>
                            {formatCurrency(
                              orderBalance.total
                            )}
                          </strong>
                        </div>

                        <div>
                          <span className="form-label">
                            Already Paid
                          </span>

                          <strong>
                            {formatCurrency(
                              orderBalance.paid
                            )}
                          </strong>
                        </div>

                        <div>
                          <span className="form-label">
                            Remaining Balance
                          </span>

                          <strong>
                            {formatCurrency(
                              orderBalance.remaining
                            )}
                          </strong>
                        </div>

                        <div>
                          <span className="form-label">
                            Payment Status
                          </span>

                          <strong>
                            {selectedOrder.paymentStatus ||
                              "Pending"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AMOUNT */}
                  <div className="form-group">
                    <label className="form-label">
                      Amount *
                    </label>

                    <input
                      className="input"
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
                        <span className="text-xs text-muted">
                          Maximum:{" "}
                          {formatCurrency(
                            orderBalance.remaining
                          )}
                        </span>
                      )}
                  </div>

                  {/* DATE */}
                  <div className="form-group">
                    <label className="form-label">
                      Payment Date
                    </label>

                    <input
                      className="input"
                      type="date"
                      name="paymentDate"
                      value={form.paymentDate}
                      onChange={handleChange}
                    />
                  </div>

                  {/* PAYMENT MODE */}
                  <div className="form-group">
                    <label className="form-label">
                      Payment Mode *
                    </label>

                    <select
                      className="select"
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
                  <div className="form-group">
                    <label className="form-label">
                      Status *
                    </label>

                    <select
                      className="select"
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
                    <div className="form-group">
                      <label className="form-label">
                        Transaction ID *
                      </label>

                      <input
                        className="input"
                        name="transactionId"
                        value={form.transactionId}
                        onChange={handleChange}
                        placeholder="UTR / transaction ID"
                        required
                      />
                    </div>
                  )}

                  {/* CHEQUE */}
                  {form.paymentMode ===
                    "Cheque" && (
                    <>
                      <div className="form-group">
                        <label className="form-label">
                          Cheque Number *
                        </label>

                        <input
                          className="input"
                          name="chequeNumber"
                          value={form.chequeNumber}
                          onChange={handleChange}
                          placeholder="Cheque number"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Bank Name *
                        </label>

                        <input
                          className="input"
                          name="bankName"
                          value={form.bankName}
                          onChange={handleChange}
                          placeholder="Issuing bank"
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* NOTES */}
                  <div
                    className="form-group"
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <label className="form-label">
                      Notes
                    </label>

                    <textarea
                      className="input"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="Optional payment notes"
                      rows="3"
                    />
                  </div>

                  {/* ATTACHMENT */}
                  <div
                    className="form-group"
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <label className="form-label">
                      Attachment URL
                    </label>

                    <input
                      className="input"
                      name="attachmentUrl"
                      value={form.attachmentUrl}
                      onChange={handleChange}
                      placeholder="Optional receipt / document URL"
                    />
                  </div>
                </div>
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
                  type="submit"
                  className="btn btn-primary"
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
    </div>
  );
}

export default Payments;