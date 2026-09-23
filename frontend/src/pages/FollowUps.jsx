import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Download,
  X,
  Mail,
  MessageCircle,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

import {
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  getContacts,
  getEnquiries,
} from "../api/api";

const tabs = ["Today", "Upcoming", "Overdue", "Completed"];

const typeOptions = [
  "All Types",
  "Call",
  "Email",
  "Meeting",
  "WhatsApp",
  "Other",
];

const priorityOptions = [
  "All Priorities",
  "High",
  "Medium",
  "Low",
];

const stateOptions = [
  "All States",
  "Pending",
  "Completed",
  "Cancelled",
];

const EMPTY_FORM = {
  contact: "",
  enquiry: "",
  type: "Call",
  subject: "",
  notes: "",
  scheduledAt: "",
  status: "Pending",
  priority: "Medium",
};

function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [enquiries, setEnquiries] = useState([]);

  const [activeTab, setActiveTab] = useState("Today");

  const [typeFilter, setTypeFilter] = useState("All Types");
  const [priorityFilter, setPriorityFilter] =
    useState("All Priorities");
  const [stateFilter, setStateFilter] =
    useState("All States");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getFollowups();

      setFollowUps(response.data?.data || []);
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to load follow-ups."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await getContacts({
        page: 1,
        limit: 1000,
      });

      setContacts(response.data?.data || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    }
  };

  const fetchEnquiries = async () => {
    try {
      const response = await getEnquiries({
        page: 1,
        limit: 1000,
      });

      setEnquiries(response.data?.data || []);
    } catch (err) {
      console.error("Failed to load enquiries:", err);
    }
  };

  useEffect(() => {
    fetchFollowUps();
    fetchContacts();
    fetchEnquiries();
  }, []);

  const getCustomerName = (item) => {
    if (item.contact?.name) return item.contact.name;

    const contact = contacts.find(
      (c) => c._id === item.contact
    );

    return contact?.name || "Unknown Contact";
  };

  const getCompanyName = (item) => {
    if (item.contact?.company) return item.contact.company;

    const contact = contacts.find(
      (c) => c._id === item.contact
    );

    return contact?.company || "";
  };

  const getEnquiryNumber = (item) => {
    if (item.enquiry?.enquiryNumber) {
      return item.enquiry.enquiryNumber;
    }

    const enquiry = enquiries.find(
      (e) => e._id === item.enquiry
    );

    return enquiry?.enquiryNumber || "";
  };

  const getPhoneNumber = (item) => {
    if (item.contact?.phone) {
      return item.contact.phone;
    }

    const contact = contacts.find(
      (c) => c._id === item.contact
    );

    return contact?.phone || "";
  };

  const getInitials = (name = "") => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

  const formatDateTime = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isToday = (date) => {
    if (!date) return false;

    const current = new Date();
    const target = new Date(date);

    return (
      current.getDate() === target.getDate() &&
      current.getMonth() === target.getMonth() &&
      current.getFullYear() === target.getFullYear()
    );
  };

  const isCompleted = (item) => {
    return item.status === "Completed";
  };

  const isOverdue = (item) => {
    return (
      item.status === "Pending" &&
      new Date(item.scheduledAt) < new Date()
    );
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "Call":
        return <Phone size={14} />;

      case "Email":
        return <Mail size={14} />;

      case "Meeting":
        return <Calendar size={14} />;

      case "WhatsApp":
        return <MessageCircle size={14} />;

      default:
        return <FileText size={14} />;
    }
  };

  const getTypeClasses = (type) => {
    switch (type) {
      case "Call":
        return "bg-blue-50 text-blue-700 border-blue-100";

      case "Meeting":
        return "bg-violet-50 text-violet-700 border-violet-100";

      case "Email":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";

      case "WhatsApp":
        return "bg-green-50 text-green-700 border-green-100";

      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getPriorityClasses = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-50 text-red-700 border-red-100";

      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-100";

      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      const scheduled = new Date(item.scheduledAt);

      let matchesTab = true;

      if (activeTab === "Today") {
        matchesTab =
          isToday(scheduled) &&
          item.status === "Pending";
      }

      if (activeTab === "Upcoming") {
        matchesTab =
          scheduled > new Date() &&
          item.status === "Pending";
      }

      if (activeTab === "Overdue") {
        matchesTab =
          scheduled < new Date() &&
          item.status === "Pending";
      }

      if (activeTab === "Completed") {
        matchesTab = item.status === "Completed";
      }

      const matchesType =
        typeFilter === "All Types" ||
        item.type === typeFilter;

      const matchesPriority =
        priorityFilter === "All Priorities" ||
        item.priority === priorityFilter;

      const matchesState =
        stateFilter === "All States" ||
        item.status === stateFilter;

      return (
        matchesTab &&
        matchesType &&
        matchesPriority &&
        matchesState
      );
    });
  }, [
    followUps,
    activeTab,
    typeFilter,
    priorityFilter,
    stateFilter,
  ]);

  const todayFollowUps = useMemo(() => {
    return followUps.filter(
      (item) =>
        isToday(item.scheduledAt) &&
        item.status !== "Cancelled"
    );
  }, [followUps]);

  const completedToday = useMemo(() => {
    return followUps.filter(
      (item) =>
        isToday(item.completedAt || item.scheduledAt) &&
        item.status === "Completed"
    ).length;
  }, [followUps]);

  const commitmentRate = todayFollowUps.length
    ? Math.round(
        (completedToday / todayFollowUps.length) * 100
      )
    : 0;

  const scheduledCallsMeetings = followUps.filter(
    (item) =>
      item.status === "Pending" &&
      ["Call", "Meeting"].includes(item.type)
  ).length;

  const pendingExecution = followUps.filter(
    (item) => item.status === "Pending"
  ).length;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingId(null);

    setFormData({
      ...EMPTY_FORM,
      contact: contacts[0]?._id || "",
    });

    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);

    const scheduledDate = item.scheduledAt
      ? new Date(item.scheduledAt)
      : null;

    const localDateTime = scheduledDate
      ? new Date(
          scheduledDate.getTime() -
            scheduledDate.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 16)
      : "";

    setFormData({
      contact:
        item.contact?._id ||
        item.contact ||
        "",

      enquiry:
        item.enquiry?._id ||
        item.enquiry ||
        "",

      type: item.type || "Call",
      subject: item.subject || "",
      notes: item.notes || "",
      scheduledAt: localDateTime,
      status: item.status || "Pending",
      priority: item.priority || "Medium",
    });

    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setError("");

      const payload = {
        ...formData,
        enquiry: formData.enquiry || null,
      };

      if (editingId) {
        await updateFollowup(editingId, payload);
      } else {
        await createFollowup(payload);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);

      await fetchFollowUps();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to save follow-up."
      );
    }
  };

  const markCompleted = async (item) => {
    try {
      const response = await updateFollowup(item._id, {
        ...item,
        status: "Completed",
        completedAt: new Date().toISOString(),
      });

      const updated =
        response.data?.data || {
          ...item,
          status: "Completed",
        };

      setFollowUps((prev) =>
        prev.map((followUp) =>
          followUp._id === item._id
            ? updated
            : followUp
        )
      );

      setActiveTab("Completed");
      setStateFilter("Completed");
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to complete follow-up."
      );
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this follow-up?"
    );

    if (!confirmed) return;

    try {
      await deleteFollowup(id);
      await fetchFollowUps();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.message ||
          "Failed to delete follow-up."
      );
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    if (tab === "Completed") {
      setStateFilter("Completed");
    } else {
      setStateFilter("All States");
    }
  };

  const handleExportLedger = () => {
    const rows = [
      [
        "Subject",
        "Contact",
        "Company",
        "Type",
        "Priority",
        "Status",
        "Scheduled At",
        "Enquiry",
        "Notes",
      ],
      ...followUps.map((item) => [
        item.subject || "",
        getCustomerName(item),
        getCompanyName(item),
        item.type || "",
        item.priority || "",
        item.status || "",
        formatDateTime(item.scheduledAt),
        getEnquiryNumber(item),
        item.notes || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) =>
            `"${String(value)
              .replace(/"/g, '""')
              .replace(/\n/g, " ")}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "csw-follow-up-ledger.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const getTabCount = (tab) => {
    const now = new Date();

    return followUps.filter((item) => {
      const scheduled = new Date(item.scheduledAt);

      if (tab === "Today") {
        return (
          isToday(scheduled) &&
          item.status === "Pending"
        );
      }

      if (tab === "Upcoming") {
        return (
          scheduled > now &&
          item.status === "Pending"
        );
      }

      if (tab === "Overdue") {
        return (
          scheduled < now &&
          item.status === "Pending"
        );
      }

      return item.status === "Completed";
    }).length;
  };

  return (
    <div className="min-h-full bg-[#f7f9fc]">

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span>Sales Operations</span>
            <span className="text-slate-300">•</span>
            <span>Execution</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Follow-ups
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Manage customer calls, meetings and commercial
            follow-ups from one place.
          </p>
        </div>

        <div className="flex items-center gap-3">

          <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={16} />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Commitment Rate
              </p>

              <p className="text-sm font-semibold text-slate-900">
                {commitmentRate}%
              </p>
            </div>
          </div>

          {/* <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#00345f] hover:shadow-md"
          >
            <Plus size={16} />
            Schedule Follow-up
          </button> */}
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />

          <div className="flex-1">
            <p className="font-medium">
              Something went wrong
            </p>

            <p className="mt-0.5 text-red-600/80">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Quick Actions
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Frequently used follow-up operations
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-2 text-slate-500">
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">

          <button
            type="button"
            onClick={openCreateModal}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left transition hover:border-[#002244]/20 hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#002244]/10 text-[#002244] transition group-hover:bg-[#002244] group-hover:text-white">
              <Plus size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                Schedule Follow-up
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                Create a new customer activity
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleExportLedger}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-[#002244] group-hover:text-white">
              <Download size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                Export Daily Ledger
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                Download the follow-up activity
              </p>
            </div>
          </button>

        </div>
      </section>

      <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Follow-up Summary
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Current execution overview
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-2 text-slate-500">
            <FileText size={16} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3">

          <div className="border-b border-slate-100 px-5 py-4 sm:border-b-0 sm:border-r">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">
                Calls & Meetings
              </p>

              <Phone
                size={15}
                className="text-slate-300"
              />
            </div>

            <p className="mt-2 text-2xl font-semibold tracking-tight !text-black">
              {scheduledCallsMeetings}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Pending scheduled
            </p>
          </div>

          <div className="border-b border-slate-100 px-5 py-4 sm:border-b-0 sm:border-r">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">
                Pending Execution
              </p>

              <Clock
                size={15}
                className="text-slate-300"
              />
            </div>

            <p className="mt-2 text-2xl font-semibold tracking-tight !text-black">
              {pendingExecution}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Activities awaiting action
            </p>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">
                Total Follow-ups
              </p>

              <Calendar
                size={15}
                className="text-slate-300"
              />
            </div>

            <p className="mt-2 text-2xl font-semibold tracking-tight !text-black">
              {followUps.length}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              All recorded activities
            </p>
          </div>

        </div>

        </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(250px,1fr)]">

        <section className="min-w-0">

          <div className="mb-4 flex overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/70 p-1">

            {tabs.map((tab) => {
              const active = activeTab === tab;
              const count = getTabCount(tab);

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white text-[#002244] shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab}

                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active
                        ? "bg-[#002244]/10 text-[#002244]"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">

            <div className="flex-1">
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
              >
                {typeOptions.map((option) => (
                  <option key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
              >
                {priorityOptions.map((option) => (
                  <option key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <select
                value={stateFilter}
                onChange={(e) =>
                  setStateFilter(e.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
              >
                {stateOptions.map((option) => (
                  <option key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={fetchFollowUps}
              className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
            </button>

          </div>

          <div className="space-y-3">

            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#002244]" />

                <p className="mt-4 text-sm font-medium text-slate-700">
                  Loading follow-ups
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Fetching your latest activities...
                </p>
              </div>
            ) : filteredFollowUps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Calendar size={21} />
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-900">
                  No follow-ups found
                </h3>

                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  There are no activities matching the
                  current tab and filters.
                </p>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#002244] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#00345f]"
                >
                  <Plus size={15} />
                  Schedule Follow-up
                </button>
              </div>
            ) : (
              filteredFollowUps.map((item) => {
                const customer =
                  getCustomerName(item);

                const company =
                  getCompanyName(item);

                const enquiry =
                  getEnquiryNumber(item);

                const phone =
                  getPhoneNumber(item);

                return (
                  <article
                    key={item._id}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex">

                      {/* LEFT DATE */}
                      <div className="hidden w-20 shrink-0 border-r border-slate-100 bg-slate-50/70 px-3 py-4 text-center sm:block">

                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {new Date(
                            item.scheduledAt
                          ).toLocaleDateString(
                            "en-IN",
                            {
                              weekday: "short",
                            }
                          )}
                        </p>

                        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                          {new Date(
                            item.scheduledAt
                          ).getDate()}
                        </p>

                        <p className="text-[10px] font-medium uppercase text-slate-400">
                          {new Date(
                            item.scheduledAt
                          ).toLocaleDateString(
                            "en-IN",
                            {
                              month: "short",
                            }
                          )}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1 p-4">

                        <div className="flex flex-wrap items-center gap-2">

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${getTypeClasses(
                              item.type
                            )}`}
                          >
                            {getTypeIcon(item.type)}
                            {item.type}
                          </span>

                          <span
                            className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${getPriorityClasses(
                              item.priority
                            )}`}
                          >
                            {item.priority}
                          </span>

                          <span
                            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                              item.status ===
                              "Completed"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.status ===
                                  "Cancelled"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {item.status}
                          </span>

                          {isOverdue(item) && (
                            <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">
                              Overdue
                            </span>
                          )}

                        </div>


                        <div className="mt-3">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {item.subject}
                          </h3>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">

                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {formatDateTime(
                                item.scheduledAt
                              )}
                            </span>

                            <span className="text-slate-300">
                              •
                            </span>

                            <span className="font-medium text-slate-600">
                              {customer}
                            </span>

                            {company && (
                              <>
                                <span className="text-slate-300">
                                  •
                                </span>

                                <span>
                                  {company}
                                </span>
                              </>
                            )}

                          </div>
                        </div>

                        {enquiry && (
                          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                            <FileText
                              size={12}
                              className="text-slate-400"
                            />

                            <span className="text-[11px] font-semibold text-slate-600">
                              {enquiry}
                            </span>
                          </div>
                        )}

                        {item.notes && (
                          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                            {item.notes}
                          </p>
                        )}

                        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">

                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#002244] text-[10px] font-semibold text-white">
                              {getInitials(
                                customer
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-medium text-slate-700">
                                {customer}
                              </p>

                              <p className="text-[10px] text-slate-400">
                                {formatDate(
                                  item.scheduledAt
                                )}
                              </p>
                            </div>
                          </div>


                          <div className="flex flex-wrap items-center gap-1.5">

                            {item.type === "Call" &&
                              item.status ===
                                "Pending" &&
                              phone && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    (window.location.href = `tel:${phone}`)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                                >
                                  <Phone size={12} />
                                  Call
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(item)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                            >
                              <Pencil size={12} />
                              Edit
                            </button>

                            {item.status ===
                              "Pending" && (
                              <button
                                type="button"
                                onClick={() =>
                                  markCompleted(item)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#002244] px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#00345f]"
                              >
                                <CheckCircle2
                                  size={12}
                                />
                                Complete
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  item._id
                                )
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>

                          </div>

                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}

          </div>
        </section>

        <aside className="min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Daily Conversion SLA
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Today's execution
                </p>
              </div>

              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                TARGET 100%
              </span>

            </div>

            <div className="flex justify-center py-7">

              <div className="relative h-36 w-36">

                <svg
                  viewBox="0 0 120 120"
                  className="h-full w-full -rotate-90"
                >
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    className="text-slate-100"
                  />

                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min(
                      commitmentRate,
                      100
                    ) * 3.0159} 301.59`}
                    className="text-[#002244]"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">

                  <span className="text-2xl font-semibold tracking-tight text-slate-900">
                    {commitmentRate}%
                  </span>

                  <span className="mt-0.5 text-[10px] text-slate-400">
                    completed
                  </span>

                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Completed today
                </span>

                <span className="text-xs font-semibold text-slate-900">
                  {completedToday}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Today's follow-ups
                </span>

                <span className="text-xs font-semibold text-slate-900">
                  {todayFollowUps.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Pending
                </span>

                <span className="text-xs font-semibold text-slate-900">
                  {pendingExecution}
                </span>
              </div>

            </div>
          </div>

        </aside>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">

              <div className="flex items-start gap-3">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#002244]/10 text-[#002244]">
                  <Calendar size={18} />
                </div>

                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                    {editingId
                      ? "Edit Follow-up"
                      : "Schedule Follow-up"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {editingId
                      ? "Update the follow-up details."
                      : "Create a new customer activity."}
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>

            </div>

            <form onSubmit={handleSubmit}>

              <div className="grid grid-cols-1 gap-x-5 gap-y-5 px-6 py-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Contact{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                    required
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
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
                          {contact.name} —{" "}
                          {contact.company}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Enquiry
                  </label>

                  <select
                    name="enquiry"
                    value={formData.enquiry}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  >
                    <option value="">
                      Select enquiry
                    </option>

                    {enquiries.map(
                      (enquiry) => (
                        <option
                          key={enquiry._id}
                          value={enquiry._id}
                        >
                          {enquiry.enquiryNumber} —{" "}
                          {enquiry.customerName}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Follow-up Type{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  >
                    <option value="Call">
                      Call
                    </option>

                    <option value="Email">
                      Email
                    </option>

                    <option value="Meeting">
                      Meeting
                    </option>

                    <option value="WhatsApp">
                      WhatsApp
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  >
                    <option value="Low">
                      Low
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="High">
                      High
                    </option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Subject{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Discuss GI wire requirement"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Scheduled Date & Time{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    type="datetime-local"
                    name="scheduledAt"
                    value={formData.scheduledAt}
                    onChange={handleChange}
                    required
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  >
                    <option value="Pending">
                      Pending
                    </option>

                    <option value="Completed">
                      Completed
                    </option>

                    <option value="Cancelled">
                      Cancelled
                    </option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Add agenda, discussion points or additional notes..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#00345f] hover:shadow-md"
                >
                  <CheckCircle2 size={15} />

                  {editingId
                    ? "Update Follow-up"
                    : "Schedule Follow-up"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FollowUps;