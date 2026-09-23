import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock3,
  Users,
  Factory,
  Wallet,
  CreditCard,
  Smartphone,
  CalendarDays,
  RefreshCw,
  Inbox,
} from "lucide-react";
import api from "../api/axios";

const TABS = [
  {
    key: "Employee",
    label: "Employee",
    icon: Users,
    accent: "#2563EB",
    accentSoft: "#EFF6FF",
  },
  {
    key: "Factory People",
    label: "Factory People",
    icon: Factory,
    accent: "#B45309",
    accentSoft: "#FFFBEB",
  },
  {
    key: "Factory Expense",
    label: "Factory Expense",
    icon: Wallet,
    accent: "#7C3AED",
    accentSoft: "#F5F3FF",
  },
  {
    key: "Miscellaneous",
    label: "Miscellaneous",
    icon: CreditCard,
    accent: "#0F766E",
    accentSoft: "#F0FDFA",
  },
];

const EMPTY_FORM = {
  type: "Employee",
  date: new Date().toISOString().split("T")[0],
  amount: "",
  paymentStatus: "Pending",
  paymentMethod: "",
  person: "",
  expenseType: "",
  vendor: "",
  invoiceNumber: "",
  expenseName: "",
  expenseCategory: "",
  description: "",
  notes: "",
  transactionId: "",
};

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
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

function getCurrentMonthTotal(expenses) {
  const now = new Date();
  return expenses
    .filter((expense) => {
      const date = new Date(expense.date);
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

export default function Expenses() {
  const [activeTab, setActiveTab] = useState("Employee");

  const [expenses, setExpenses] = useState([]);
  const [people, setPeople] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const activeConfig = TABS.find((tab) => tab.key === activeTab);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentExpense, setPaymentExpense] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [paymentTransactionId, setPaymentTransactionId] = useState("");
    const [paymentSaving, setPaymentSaving] = useState(false);

  /* FETCH EXPENSES */
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/expense");
      const data = response?.data?.data || response?.data?.expenses || [];
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load expenses:", err);
      setError(
        err?.response?.data?.message ||
          "Couldn't load expenses. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  /* FETCH PEOPLE */
  const fetchPeople = async () => {
    try {
      const response = await api.get("/people", { params: { status: "Active" } });
      const data = response?.data?.data || response?.data?.people || [];
      setPeople(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load people:", err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchPeople();
  }, []);

  const employeeList = useMemo(
    () => people.filter((person) => person.type === "Employee"),
    [people]
  );

  const factoryPeopleList = useMemo(
    () => people.filter((person) => person.type === "Factory People"),
    [people]
  );

  /* FILTER */
  const filteredExpenses = useMemo(() => {
    let result = expenses.filter((expense) => expense.type === activeTab);

    if (statusFilter !== "All") {
      result = result.filter((expense) => expense.paymentStatus === statusFilter);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((expense) => {
        const personName = expense.person?.name || "";
        return (
          personName.toLowerCase().includes(query) ||
          String(expense.expenseType || "").toLowerCase().includes(query) ||
          String(expense.expenseName || "").toLowerCase().includes(query) ||
          String(expense.vendor || "").toLowerCase().includes(query) ||
          String(expense.invoiceNumber || "").toLowerCase().includes(query) ||
          String(expense.description || "").toLowerCase().includes(query)
        );
      });
    }

    return result;
  }, [expenses, activeTab, statusFilter, search]);

  /* COUNTS PER TAB (for the tab bar badges) */
  const countsByTab = useMemo(() => {
    return TABS.reduce((acc, tab) => {
      acc[tab.key] = expenses.filter((e) => e.type === tab.key).length;
      return acc;
    }, {});
  }, [expenses]);

  /* STATS */
  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const paid = filteredExpenses
      .filter((e) => e.paymentStatus === "Paid")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const pending = filteredExpenses
      .filter((e) => e.paymentStatus === "Pending")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const monthTotal = getCurrentMonthTotal(filteredExpenses);

    return { total, paid, pending, monthTotal };
  }, [filteredExpenses]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, type: activeTab });
    setEditingExpense(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setForm({
      type: expense.type || activeTab,
      date: expense.date ? new Date(expense.date).toISOString().split("T")[0] : "",
      amount: expense.amount || "",
      paymentStatus: expense.paymentStatus || "Pending",
      paymentMethod: expense.paymentMethod || "",
      person: expense.person?._id || expense.person || "",
      expenseType: expense.expenseType || "",
      vendor: expense.vendor || "",
      invoiceNumber: expense.invoiceNumber || "",
      expenseName: expense.expenseName || "",
      expenseCategory: expense.expenseCategory || "",
      description: expense.description || "",
      notes: expense.notes || "",
      transactionId: expense.transactionId || "",
    });
    setShowModal(true);
  };

  const validateForm = () => {
    if (!form.date) {
      alert("Date is required.");
      return false;
    }
    if (form.type === "Employee" || form.type === "Factory People") {
      if (!form.person) {
        alert("Please select a person.");
        return false;
      }
    }
    if (form.type === "Factory Expense" && !form.expenseType.trim()) {
      alert("Expense type is required.");
      return false;
    }
    if (form.type === "Miscellaneous" && !form.expenseName.trim()) {
      alert("Expense name is required.");
      return false;
    }
    if (form.paymentStatus === "Paid" && !form.paymentMethod) {
      alert("Please select a payment method.");
      return false;
    }
    if (
      form.paymentStatus === "Paid" &&
      form.paymentMethod === "UPI" &&
      !form.transactionId.trim()
    ) {
      alert("UPI transaction ID is required.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        type: form.type,
        date: form.date,
        paymentStatus: form.paymentStatus,
        paymentMethod: form.paymentStatus === "Paid" ? form.paymentMethod : null,
        person:
          form.type === "Employee" || form.type === "Factory People" ? form.person : null,
        expenseType: form.type === "Factory Expense" ? form.expenseType : null,
        vendor: form.type === "Factory Expense" ? form.vendor : null,
        invoiceNumber: form.type === "Factory Expense" ? form.invoiceNumber : null,
        expenseName: form.type === "Miscellaneous" ? form.expenseName : null,
        expenseCategory: form.type === "Miscellaneous" ? form.expenseCategory : null,
        description: form.description || null,
        notes: form.notes || null,
        transactionId:
          form.paymentStatus === "Paid" && form.paymentMethod === "UPI"
            ? form.transactionId
            : null,
      };

      // Employee / Factory People amount is computed server-side from Person.
      if (form.type === "Factory Expense" || form.type === "Miscellaneous") {
        payload.amount = Number(form.amount || 0);
      }

      if (editingExpense) {
        await api.put(`/expense/${editingExpense._id}`, payload);
      } else {
        await api.post("/expense", payload);
      }

      setShowModal(false);
      resetForm();
      await fetchExpenses();
    } catch (err) {
      console.error("Save expense error:", err);
      alert(err?.response?.data?.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (expense) => {
    setPaymentExpense(expense);
    setPaymentMethod("Cash");
    setPaymentTransactionId("");
    setShowPaymentModal(true);
    };

    const handleMarkAsPaid = async (e) => {
    e.preventDefault();

    if (!paymentExpense) return;

    if (paymentMethod === "UPI" && !paymentTransactionId.trim()) {
        alert("UPI transaction ID is required.");
        return;
    }

    try {
        setPaymentSaving(true);

        await api.patch(`/expense/${paymentExpense._id}/pay`, {
        paymentMethod,
        transactionId:
            paymentMethod === "UPI"
            ? paymentTransactionId.trim()
            : null,
        });

        setShowPaymentModal(false);
        setPaymentExpense(null);
        setPaymentMethod("Cash");
        setPaymentTransactionId("");

        await fetchExpenses();
    } catch (err) {
        console.error("Mark expense paid error:", err);
        alert(
        err?.response?.data?.message ||
            "Failed to mark expense as paid."
        );
    } finally {
        setPaymentSaving(false);
    }
    };

  const handleDelete = async (expense) => {
    if (expense.paymentStatus === "Paid") {
      alert("Paid expenses cannot be deleted.");
      return;
    }
    const confirmed = window.confirm("Are you sure you want to delete this expense?");
    if (!confirmed) return;

    try {
      await api.delete(`/expense/${expense._id}`);
      await fetchExpenses();
    } catch (err) {
      console.error("Delete expense error:", err);
      alert(err?.response?.data?.message || "Failed to delete expense.");
    }
  };

  const selectedPerson = people.find((person) => person._id === form.person);

  const calculatedAmount =
    form.type === "Employee"
      ? selectedPerson?.salary || 0
      : form.type === "Factory People"
      ? selectedPerson?.dailyWage || 0
      : Number(form.amount || 0);

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Finance</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
            Expenses
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Salaries, factory wages, factory costs and miscellaneous spend, in one place.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchExpenses}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
          >
            <RefreshCw size={14} />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white shadow-sm transition"
            style={{ backgroundColor: "#0B2545" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#123761")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0B2545")}
          >
            <Plus size={15} />
            Add expense
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={fetchExpenses} className="font-medium hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* TABS — underline style, category-coded */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setStatusFilter("All");
                setSearch("");
              }}
              className="relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition"
              style={{ color: active ? tab.accent : "#64748B" }}
            >
              <Icon size={15} />
              {tab.label}
              <span
                className="ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
                style={{
                  color: active ? tab.accent : "#94A3B8",
                  backgroundColor: active ? tab.accentSoft : "transparent",
                }}
              >
                {/* {countsByTab[tab.key] ?? 0} */}
              </span>
              {active && (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                  style={{ backgroundColor: tab.accent }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total"
          value={formatCurrency(stats.total)}
          accent={activeConfig?.accent}
        />
        <StatCard
          label="Paid"
          value={formatCurrency(stats.paid)}
          icon={CheckCircle2}
          accent="#059669"
        />
        <StatCard
          label="Pending"
          value={formatCurrency(stats.pending)}
          icon={Clock3}
          accent="#D97706"
        />
        <StatCard
          label="This month"
          value={formatCurrency(stats.monthTotal)}
          icon={CalendarDays}
          accent="#475569"
        />
      </div>

      {/* FILTERS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "Employee"
                ? "Search employee"
                : activeTab === "Factory People"
                ? "Search worker"
                : "Search expense"
            }
            className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {["All", "Pending", "Paid"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={`rounded px-3 py-1.5 font-medium transition ${
                statusFilter === option
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <section className="overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{activeTab}</h2>
          <p className="text-xs text-slate-500">
            {filteredExpenses.length} {filteredExpenses.length === 1 ? "entry" : "entries"}
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-center">
              <RefreshCw size={18} className="animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Loading expenses…</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-center">
              <Inbox size={22} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-700">No expenses here yet</p>
              <p className="text-xs text-slate-400">
                Add one, or adjust your search and status filter.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
            <colgroup>
                {/* Date */}
                <col className="w-32" />

                {/* Person / Expense */}
                <col className="w-48" />

                {/* Designation / Role / Vendor / Description */}
                <col className="w-48" />

                {/* Amount */}
                <col className="w-36" />

                {/* Payment */}
                <col className="w-44" />

                {/* Actions */}
                <col className="w-32" />
            </colgroup>

            <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="px-6 py-3 text-xs font-medium text-slate-500">
                    Date
                </th>

                {activeTab === "Employee" && (
                    <>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Employee
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Designation
                    </th>
                    </>
                )}

                {activeTab === "Factory People" && (
                    <>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Person
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Role
                    </th>
                    </>
                )}

                {activeTab === "Factory Expense" && (
                    <>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Expense
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Vendor
                    </th>
                    </>
                )}

                {activeTab === "Miscellaneous" && (
                    <>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Expense
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">
                        Description
                    </th>
                    </>
                )}

                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                    Amount
                </th>

                <th className="px-4 py-3 text-xs font-medium text-slate-500">
                    Payment
                </th>

                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">
                    Actions
                </th>
                </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((expense) => (
                <tr
                    key={expense._id}
                    className="align-middle transition-colors hover:bg-slate-50/70"
                >
                    <td className="px-6 py-4 align-middle text-sm text-slate-500">
                    {formatDate(expense.date)}
                    </td>

                    {activeTab === "Employee" && (
                    <>
                        <td className="truncate px-4 py-4 align-middle">
                        <div className="truncate text-sm font-medium text-slate-800">
                            {expense.person?.name || "—"}
                        </div>
                        </td>

                        <td className="truncate px-4 py-4 align-middle text-sm text-slate-500">
                        {expense.person?.role || "—"}
                        </td>
                    </>
                    )}

                    {activeTab === "Factory People" && (
                    <>
                        <td className="truncate px-4 py-4 align-middle">
                        <div className="truncate text-sm font-medium text-slate-800">
                            {expense.person?.name || "—"}
                        </div>
                        </td>

                        <td className="truncate px-4 py-4 align-middle text-sm text-slate-500">
                        {expense.person?.role || "—"}
                        </td>
                    </>
                    )}

                    {activeTab === "Factory Expense" && (
                    <>
                        <td className="truncate px-4 py-4 align-middle">
                        <div className="truncate text-sm font-medium text-slate-800">
                            {expense.expenseType || "—"}
                        </div>

                        {expense.invoiceNumber && (
                            <div className="truncate text-xs text-slate-400">
                            Invoice {expense.invoiceNumber}
                            </div>
                        )}
                        </td>

                        <td className="truncate px-4 py-4 align-middle text-sm text-slate-500">
                        {expense.vendor || "—"}
                        </td>
                    </>
                    )}

                    {activeTab === "Miscellaneous" && (
                    <>
                        <td className="truncate px-4 py-4 align-middle">
                        <div className="truncate text-sm font-medium text-slate-800">
                            {expense.expenseName || "—"}
                        </div>

                        <div className="truncate text-xs text-slate-400">
                            {expense.expenseCategory || "—"}
                        </div>
                        </td>

                        <td className="max-w-[280px] truncate px-4 py-4 align-middle text-sm text-slate-500">
                        {expense.description || "—"}
                        </td>
                    </>
                    )}

                    <td className="px-4 py-4 align-middle text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatCurrency(expense.amount)}
                    </td>

                    <td className="px-4 py-4 align-middle">
                    <div className="space-y-1">
                        <PaymentStatus status={expense.paymentStatus} />

                        {expense.paymentStatus === "Paid" && expense.paymentMethod && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            {expense.paymentMethod === "UPI" ? (
                            <Smartphone size={11} />
                            ) : (
                            <Wallet size={11} />
                            )}

                            <span className="truncate">
                            {expense.paymentMethod}
                            </span>

                            {expense.transactionId && (
                            <span className="truncate text-slate-300">
                                &nbsp;· {expense.transactionId}
                            </span>
                            )}
                        </div>
                        )}
                    </div>
                    </td>

                    <td className="px-6 py-4 align-middle">
                    <div className="flex items-center justify-end gap-1">
                        {expense.paymentStatus === "Pending" && (
                        <button
                            type="button"
                            onClick={() => openPaymentModal(expense)}
                            title="Record payment"
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 transition-all duration-150 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 active:scale-[0.98]"
                        >
                            <CheckCircle2 size={13} strokeWidth={2} />
                            <span>Pay</span>
                        </button>
                        )}

                        <button
                        type="button"
                        onClick={() => openEditModal(expense)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        title="Edit"
                        >
                        <Pencil size={13} />
                        </button>

                        <button
                        type="button"
                        onClick={() => handleDelete(expense)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                        >
                        <Trash2 size={13} />
                        </button>
                    </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => !saving && setShowModal(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingExpense ? "Edit expense" : "Add expense"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{activeTab}</p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
                <FormField label="Date" required>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateForm("date", e.target.value)}
                    className="form-input"
                  />
                </FormField>

                {form.type === "Employee" && (
                  <>
                    <FormField label="Employee" required>
                      <select
                        value={form.person}
                        onChange={(e) => updateForm("person", e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select employee</option>
                        {employeeList.map((person) => (
                          <option key={person._id} value={person._id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Monthly salary">
                      <input
                        type="number"
                        value={selectedPerson?.salary || ""}
                        disabled
                        className="form-input bg-slate-50"
                      />
                    </FormField>
                  </>
                )}

                {form.type === "Factory People" && (
                  <>
                    <FormField label="Factory person" required>
                      <select
                        value={form.person}
                        onChange={(e) => updateForm("person", e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select worker</option>
                        {factoryPeopleList.map((person) => (
                          <option key={person._id} value={person._id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Daily wage">
                      <input
                        type="number"
                        value={selectedPerson?.dailyWage || ""}
                        disabled
                        className="form-input bg-slate-50"
                      />
                    </FormField>
                  </>
                )}

                {form.type === "Factory Expense" && (
                  <>
                    <FormField label="Expense type" required>
                      <input
                        type="text"
                        value={form.expenseType}
                        onChange={(e) => updateForm("expenseType", e.target.value)}
                        placeholder="Electricity, maintenance, supplies"
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Amount" required>
                      <input
                        type="number"
                        min="0"
                        value={form.amount}
                        onChange={(e) => updateForm("amount", e.target.value)}
                        placeholder="0"
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Vendor">
                      <input
                        type="text"
                        value={form.vendor}
                        onChange={(e) => updateForm("vendor", e.target.value)}
                        placeholder="Vendor name"
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Invoice number">
                      <input
                        type="text"
                        value={form.invoiceNumber}
                        onChange={(e) => updateForm("invoiceNumber", e.target.value)}
                        placeholder="Invoice number"
                        className="form-input"
                      />
                    </FormField>
                  </>
                )}

                {form.type === "Miscellaneous" && (
                  <>
                    <FormField label="Expense name" required>
                      <input
                        type="text"
                        value={form.expenseName}
                        onChange={(e) => updateForm("expenseName", e.target.value)}
                        placeholder="Office stationery, refreshments"
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Amount" required>
                      <input
                        type="number"
                        min="0"
                        value={form.amount}
                        onChange={(e) => updateForm("amount", e.target.value)}
                        placeholder="0"
                        className="form-input"
                      />
                    </FormField>
                    <FormField label="Category">
                      <input
                        type="text"
                        value={form.expenseCategory}
                        onChange={(e) => updateForm("expenseCategory", e.target.value)}
                        placeholder="Office, staff, travel"
                        className="form-input"
                      />
                    </FormField>
                  </>
                )}

                {(form.type === "Employee" || form.type === "Factory People") && (
                  <FormField label="Amount">
                    <input
                      type="number"
                      value={calculatedAmount}
                      disabled
                      className="form-input bg-slate-50 font-medium"
                    />
                  </FormField>
                )}

                <FormField label="Payment status" required>
                  <select
                    value={form.paymentStatus}
                    onChange={(e) => updateForm("paymentStatus", e.target.value)}
                    className="form-input"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </FormField>

                {form.paymentStatus === "Paid" && (
                  <FormField label="Payment method" required>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => updateForm("paymentMethod", e.target.value)}
                      className="form-input"
                    >
                      <option value="">Select payment method</option>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </FormField>
                )}

                {form.paymentStatus === "Paid" && form.paymentMethod === "UPI" && (
                  <FormField label="UPI transaction ID" required>
                    <input
                      type="text"
                      value={form.transactionId}
                      onChange={(e) => updateForm("transactionId", e.target.value)}
                      placeholder="Enter UPI transaction ID"
                      className="form-input"
                    />
                  </FormField>
                )}

                <div className="md:col-span-2">
                  <FormField label="Description">
                    <textarea
                      value={form.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      rows={3}
                      placeholder="Add expense details"
                      className="form-input min-h-[84px] resize-none"
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2">
                  <FormField label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) => updateForm("notes", e.target.value)}
                      rows={2}
                      placeholder="Internal notes"
                      className="form-input min-h-[64px] resize-none"
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                  className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#0B2545" }}
                >
                  {saving && <RefreshCw size={13} className="animate-spin" />}
                  {editingExpense ? "Save changes" : "Add expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && paymentExpense && (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
            onClick={() => !paymentSaving && setShowPaymentModal(false)}
        >
            <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            >
            {/* HEADER */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                <h2 className="text-base font-semibold text-slate-900">
                    Payment done
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                    Record this expense payment
                </p>
                </div>

                <button
                type="button"
                onClick={() =>
                    !paymentSaving && setShowPaymentModal(false)
                }
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                <X size={16} />
                </button>
            </div>

            {/* DETAILS */}
            <form onSubmit={handleMarkAsPaid}>
                <div className="space-y-4 px-6 py-5">

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">
                    Expense
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900">
                    {paymentExpense.person?.name ||
                        paymentExpense.expenseType ||
                        paymentExpense.expenseName ||
                        "Expense"}
                    </p>

                    <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(paymentExpense.amount)}
                    </p>
                </div>

                <FormField label="Payment method" required>
                    <select
                    value={paymentMethod}
                    onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        if (e.target.value === "Cash") {
                        setPaymentTransactionId("");
                        }
                    }}
                    className="form-input"
                    >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    </select>
                </FormField>

                {paymentMethod === "UPI" && (
                    <FormField label="UPI transaction ID" required>
                    <input
                        type="text"
                        value={paymentTransactionId}
                        onChange={(e) =>
                        setPaymentTransactionId(e.target.value)
                        }
                        placeholder="Enter transaction ID"
                        className="form-input"
                    />
                    </FormField>
                )}

                <div className="rounded-md bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                    Once you confirm, this expense will be marked as{" "}
                    <strong>Paid</strong> in the database.
                </div>
                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                    type="button"
                    disabled={paymentSaving}
                    onClick={() => setShowPaymentModal(false)}
                    className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    disabled={paymentSaving}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                    {paymentSaving && (
                    <RefreshCw
                        size={13}
                        className="animate-spin"
                    />
                    )}

                    <CheckCircle2 size={14} />

                    Confirm payment
                </button>
                </div>
            </form>
            </div>
        </div>
        )}

      {/* Shared input styling */}
      <style>{`
        .form-input {
          height: 2.25rem;
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #CBD5E1;
          background-color: white;
          padding: 0 0.75rem;
          font-size: 0.875rem;
          color: #1E293B;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .form-input:focus {
          border-color: #64748B;
          box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.12);
        }
        textarea.form-input {
          padding-top: 0.5rem;
          height: auto;
        }
      `}</style>
    </div>
  );
}

/* STAT CARD — flat with a left accent bar instead of a boxed icon + shadow */
function StatCard({ label, value, icon: Icon, accent = "#0B2545" }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3.5">
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center justify-between pl-2">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
        </div>
        {Icon && <Icon size={16} style={{ color: accent }} />}
      </div>
    </div>
  );
}

/* PAYMENT STATUS */
function PaymentStatus({ status }) {
  const paid = status === "Paid";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "Pending"}
    </span>
  );
}

/* FORM FIELD */
function FormField({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}