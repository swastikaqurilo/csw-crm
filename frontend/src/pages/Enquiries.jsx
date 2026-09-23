import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  CalendarDays,
  RotateCcw,
  Download,
  Plus,
  X,
  MapPin,
  Phone,
  Mail,
  Building2,
  FileText,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Send,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Clock3,
  UserRound,
  BriefcaseBusiness,
  CircleDollarSign,
  Trash2,
  RefreshCw,
} from "lucide-react";

import {
  getEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
} from "../api/api";

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "In Progress",
  "In Discussion",
  "Quoted",
  "Converted",
  "Lost",
];

const SOURCE_OPTIONS = [
  "Website",
  "Referral",
  "Direct",
  "Phone",
  "Direct Tender Reference",
  "Other",
];

const PRODUCT_OPTIONS = [
  "GI Wire",
  "Barbed Wire",
  "Concertina Wire",
  "PVC Coated Wire",
  "Binding Wire",
  "Welded Wire Mesh",
];

const STATUS_STYLES = {
  New: "border-blue-200 bg-blue-50 text-blue-700",
  Contacted: "border-cyan-200 bg-cyan-50 text-cyan-700",
  "In Progress": "border-amber-200 bg-amber-50 text-amber-700",
  "In Discussion": "border-orange-200 bg-orange-50 text-orange-700",
  Quoted: "border-violet-200 bg-violet-50 text-violet-700",
  Converted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Lost: "border-red-200 bg-red-50 text-red-700",
};

const PRIORITY_STYLES = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-amber-50 text-amber-700",
  High: "bg-red-50 text-red-700",
};

function EnquiryStatus({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        STATUS_STYLES[status] ||
        "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "New"}
    </span>
  );
}

function formatDate(date) {
  if (!date) return "—";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return date;

  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === "") {
    return "₹0";
  }

  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatTimelineDate(date) {
  if (!date) return "—";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return date;

  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(value) {
  if (!value || value === "—") return "?";

  return value
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mapEnquiry(item) {
  return {
    id: item.enquiryNumber,
    mongoId: item._id,

    customer: item.customerName,
    role: item.customerRole || "—",

    company: item.company || "—",
    project: item.project || "—",
    location: item.location || "—",

    product: item.product || "—",
    quantity: item.quantity || "—",
    value: formatCurrency(item.estimatedValue),

    estimatedValue: item.estimatedValue || 0,

    status: item.status,
    priority: item.priority,

    source: item.source,
    assigned: item.assignedTo || "Unassigned",
    assignedRole: item.assignedRole || "",

    created: formatDate(item.createdAt),

    phone: item.phone || "—",
    email: item.email || "—",
    projectRef: item.projectRef || "—",

    requirement: item.requirement || "No requirement notes added.",

    timeline: Array.isArray(item.timeline) ? item.timeline : [],

    raw: item,
  };
}

const EMPTY_ENQUIRY = {
  customerName: "",
  customerRole: "",
  company: "",
  phone: "",
  email: "",
  project: "",
  location: "",
  projectRef: "",
  product: "GI Wire",
  quantity: "",
  estimatedValue: "",
  status: "New",
  priority: "Medium",
  source: "Website",
  assignedTo: "",
  assignedRole: "",
  requirement: "",
};

function Enquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [dateFilter, setDateFilter] = useState(false);

  const [page, setPage] = useState(1);
  const limit = 20;
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showNewModal, setShowNewModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [newEnquiry, setNewEnquiry] = useState(EMPTY_ENQUIRY);
  const [noteText, setNoteText] = useState("");

  const loadEnquiries = async () => {
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

      if (statusFilter !== "All Statuses") {
        params.status = statusFilter;
      }

      if (sourceFilter !== "All Sources") {
        params.source = sourceFilter;
      }

      const response = await getEnquiries(params);

      const data = response?.data?.data || [];
      const mapped = data.map(mapEnquiry);

      setEnquiries(mapped);
      setTotal(response?.data?.total || 0);
      setPages(response?.data?.pages || 1);

      // Keep selected enquiry open if it still exists after reload
      if (selectedId) {
        const stillExists = mapped.some((item) => item.id === selectedId);
        if (!stillExists) {
          setSelectedId(null);
        }
      }
    } catch (err) {
      console.error("Failed to load enquiries:", err);

      setError(
        err?.response?.data?.message ||
          "Failed to load enquiries. Make sure your backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
  }, [page, statusFilter, sourceFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        loadEnquiries();
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const selectedEnquiry = useMemo(() => {
    return enquiries.find((item) => item.id === selectedId) || null;
  }, [enquiries, selectedId]);

  const stats = useMemo(() => {
    return {
      newCount: enquiries.filter((item) => item.status === "New").length,

      progressCount: enquiries.filter(
        (item) =>
          item.status === "In Progress" || item.status === "In Discussion"
      ).length,

      convertedCount: enquiries.filter((item) => item.status === "Converted")
        .length,
    };
  }, [enquiries]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All Statuses");
    setSourceFilter("All Sources");
    setDateFilter(false);
    setPage(1);
  };

  const handleCreateEnquiry = async () => {
    if (!newEnquiry.customerName.trim()) {
      alert("Customer name is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...newEnquiry,
        estimatedValue:
          newEnquiry.estimatedValue === ""
            ? 0
            : Number(newEnquiry.estimatedValue),
      };

      const response = await createEnquiry(payload);
      const created = response?.data?.data;

      setShowNewModal(false);
      setNewEnquiry(EMPTY_ENQUIRY);

      await loadEnquiries();

      if (created?.enquiryNumber) {
        setSelectedId(created.enquiryNumber);
      }
    } catch (err) {
      console.error("Create enquiry error:", err);

      alert(err?.response?.data?.message || "Failed to create enquiry.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedEnquiry?.mongoId) return;

    try {
      setSaving(true);

      await updateEnquiry(selectedEnquiry.mongoId, {
        status: newStatus,
      });

      await loadEnquiries();
    } catch (err) {
      console.error("Update enquiry error:", err);

      alert(err?.response?.data?.message || "Failed to update enquiry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEnquiry = async () => {
    if (!selectedEnquiry?.mongoId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedEnquiry.id}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await deleteEnquiry(selectedEnquiry.mongoId);

      setSelectedId(null);
      await loadEnquiries();
    } catch (err) {
      console.error("Delete enquiry error:", err);

      alert(err?.response?.data?.message || "Failed to delete enquiry.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedEnquiry?.mongoId) return;

    if (!noteText.trim()) {
      alert("Please enter a note.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `http://localhost:5000/api/enquiries/${selectedEnquiry.mongoId}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: noteText.trim(),
            createdBy: "System",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to add note");
      }

      setNoteText("");
      setShowNoteModal(false);

      const enquiryResponse = await getEnquiryById(selectedEnquiry.mongoId);

      const updated = mapEnquiry(enquiryResponse.data.data);

      setEnquiries((current) =>
        current.map((item) =>
          item.mongoId === updated.mongoId ? updated : item
        )
      );
    } catch (err) {
      console.error("Add note error:", err);
      alert("Failed to add note.");
    } finally {
      setSaving(false);
    }
  };

  const exportEnquiries = () => {
    if (!enquiries.length) {
      alert("There are no enquiries to export.");
      return;
    }

    const headers = [
      "Enquiry ID",
      "Customer",
      "Company",
      "Project",
      "Location",
      "Product",
      "Quantity",
      "Estimated Value",
      "Status",
      "Priority",
      "Source",
      "Assigned To",
      "Created",
    ];

    const rows = enquiries.map((item) => [
      item.id,
      item.customer,
      item.company,
      item.project,
      item.location,
      item.product,
      item.quantity,
      item.estimatedValue,
      item.status,
      item.priority,
      item.source,
      item.assigned,
      item.created,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "csw-enquiries.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;

  const endRecord = Math.min(page * limit, total);

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > pages) return;
    setPage(newPage);
  };

  const closeDetailModal = () => {
    setSelectedId(null);
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <span>Commercial Pipeline</span>
            <span>•</span>
            <span>FY 2026–27</span>
          </div>

          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-slate-900">
            Enquiries
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage incoming customer and project enquiries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportEnquiries}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download size={15} />
            Export
          </button>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00345f]"
          >
            <Plus size={16} />
            New enquiry
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={loadEnquiries}
            className="inline-flex items-center gap-1.5 font-semibold hover:underline"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total enquiries"
          value={total}
          meta="Active records"
          icon={ClipboardList}
          iconClass="bg-slate-100 text-slate-600"
        />

        <StatCard
          label="New"
          value={stats.newCount}
          meta="Current page"
          icon={MessageSquare}
          iconClass="bg-blue-50 text-blue-600"
        />

        <StatCard
          label="In progress"
          value={stats.progressCount}
          meta="Active negotiations"
          icon={Clock3}
          iconClass="bg-amber-50 text-amber-600"
        />

        <StatCard
          label="Converted"
          value={stats.convertedCount}
          meta="Current page"
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search enquiry, customer, project or product..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#315b89] focus:bg-white focus:ring-3 focus:ring-blue-50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#315b89]"
          >
            <option>All Statuses</option>

            {STATUS_OPTIONS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#315b89]"
          >
            <option>All Sources</option>

            {SOURCE_OPTIONS.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setDateFilter((value) => !value)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
              dateFilter
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <CalendarDays size={14} />
            Last 30 days
          </button>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Enquiry queue
              </h2>

              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {total}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              Click an enquiry to view its details.
            </p>
          </div>

          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
            >
              Standard
            </button>

            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              Compact
            </button>

            <button
              type="button"
              className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-600"
              title="Column settings"
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Clock3 size={21} />
              </div>

              <h4 className="text-sm font-semibold text-slate-700">
                Loading enquiries
              </h4>

              <p className="mt-1 text-xs text-slate-400">
                Fetching enquiry data from the server.
              </p>
            </div>
          ) : enquiries.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Search size={20} />
              </div>

              <h4 className="text-sm font-semibold text-slate-700">
                No enquiries found
              </h4>

              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Enquiry
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Customer
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Company
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Project
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {enquiries.map((item) => {
                  const selected = selectedId === item.id;

                  return (
                    <tr
                      key={item.mongoId}
                      onClick={() => setSelectedId(item.id)}
                      className={`cursor-pointer border-b border-slate-100 transition last:border-0 ${
                        selected
                          ? "bg-blue-50/60"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              selected
                                ? "bg-[#002244] text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {getInitials(item.id)}
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(item.id);
                              }}
                              className="font-mono text-xs font-bold text-[#315b89] hover:underline"
                            >
                              {item.id}
                            </button>

                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {item.created}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="max-w-[180px]">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {item.customer}
                          </div>

                          <div className="mt-0.5 truncate text-xs text-slate-400">
                            {item.role}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex max-w-[150px] items-center gap-2">
                          <Building2
                            size={14}
                            className="shrink-0 text-slate-400"
                          />

                          <span className="truncate text-sm text-slate-600">
                            {item.company}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="max-w-[190px]">
                          <div className="truncate text-sm font-medium text-slate-700">
                            {item.project}
                          </div>

                          <div className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400">
                            <MapPin size={11} />
                            {item.location}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <EnquiryStatus status={item.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing{" "}
            <strong className="font-semibold text-slate-700">
              {startRecord}–{endRecord}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-slate-700">{total}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => goToPage(page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: Math.min(pages, 5) }, (_, index) => {
              const pageNumber = index + 1;

              return (
                <button
                  type="button"
                  key={pageNumber}
                  onClick={() => goToPage(pageNumber)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition ${
                    page === pageNumber
                      ? "bg-[#002244] text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              type="button"
              disabled={page === pages}
              onClick={() => goToPage(page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {selectedEnquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={closeDetailModal}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#315b89]">
                    {selectedEnquiry.id}
                  </span>

                  <EnquiryStatus status={selectedEnquiry.status} />
                </div>

                <h2 className="text-base font-bold text-slate-900">
                  Enquiry details
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Created {selectedEnquiry.created} · {selectedEnquiry.source}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetailModal}
                className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close enquiry details"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#315b89]">
                      <BriefcaseBusiness size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Product requirement
                      </span>

                      <h3 className="mt-1 truncate text-sm font-bold text-slate-800">
                        {selectedEnquiry.product}
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Heavy Galvanized Grade 1
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                            Quantity
                          </span>

                          <strong className="text-sm text-slate-700">
                            {selectedEnquiry.quantity || "Not specified"}
                          </strong>
                        </div>

                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                            Estimated value
                          </span>

                          <strong className="flex items-center gap-1 text-sm text-slate-700">
                            <CircleDollarSign
                              size={13}
                              className="text-emerald-500"
                            />
                            {selectedEnquiry.value}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <DetailSection title="Customer & enterprise">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#002244] text-xs font-bold text-white">
                      {getInitials(selectedEnquiry.customer)}
                    </div>

                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold text-slate-800">
                        {selectedEnquiry.customer}
                      </strong>

                      <span className="block truncate text-xs text-slate-400">
                        {selectedEnquiry.role}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <ContactLine
                      icon={Building2}
                      value={selectedEnquiry.company}
                    />

                    <ContactLine icon={Phone} value={selectedEnquiry.phone} />

                    <ContactLine icon={Mail} value={selectedEnquiry.email} />

                    <ContactLine
                      icon={FileText}
                      value={`Project: ${selectedEnquiry.projectRef}`}
                    />
                  </div>
                </DetailSection>

                <DetailSection title="Project information">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoItem
                      label="Project"
                      value={selectedEnquiry.project}
                    />

                    <InfoItem
                      label="Location"
                      value={selectedEnquiry.location}
                    />

                    <InfoItem label="Source" value={selectedEnquiry.source} />

                    <InfoItem
                      label="Priority"
                      value={
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            PRIORITY_STYLES[selectedEnquiry.priority] ||
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {selectedEnquiry.priority || "Medium"}
                        </span>
                      }
                    />
                  </div>
                </DetailSection>

                <DetailSection title="Sales state">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </label>

                      <select
                        value={selectedEnquiry.status}
                        disabled={saving}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-[#315b89]"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Assigned lead
                      </span>

                      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-1.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {getInitials(selectedEnquiry.assigned)}
                        </div>

                        <div className="min-w-0">
                          <strong className="block truncate text-xs font-semibold text-slate-700">
                            {selectedEnquiry.assigned}
                          </strong>

                          {selectedEnquiry.assignedRole && (
                            <span className="block truncate text-[10px] text-slate-400">
                              {selectedEnquiry.assignedRole}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </DetailSection>

                <DetailSection title="Technical & dispatch notes">
                  <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    {selectedEnquiry.requirement}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNoteModal(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#315b89] hover:underline"
                  >
                    <Plus size={13} />
                    Add note
                  </button>
                </DetailSection>

                <DetailSection
                  title="Activity timeline"
                  action={
                    <button
                      type="button"
                      onClick={() => setShowNoteModal(true)}
                      className="text-[11px] font-semibold text-[#315b89] hover:underline"
                    >
                      + Add note
                    </button>
                  }
                >
                  {selectedEnquiry.timeline.length > 0 ? (
                    <div className="space-y-0">
                      {selectedEnquiry.timeline.map((event, index) => (
                        <div
                          key={index}
                          className="relative flex gap-3 pb-4 last:pb-0"
                        >
                          <div className="relative flex w-4 shrink-0 justify-center">
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-[#315b89] ring-4 ring-blue-50" />

                            {index !==
                              selectedEnquiry.timeline.length - 1 && (
                              <span className="absolute top-4 h-full w-px bg-slate-200" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-semibold text-slate-400">
                              {formatTimelineDate(event.date)}
                            </div>

                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {event.text}
                            </p>

                            {event.createdBy && (
                              <span className="mt-1 block text-[10px] text-slate-400">
                                By {event.createdBy}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No activity recorded yet.
                    </p>
                  )}
                </DetailSection>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#002244] px-3 text-xs font-semibold text-white transition hover:bg-[#00345f]"
              >
                <Send size={14} />
                Generate quote
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteEnquiry}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title="Delete enquiry"
              >
                <Trash2 size={15} />
              </button>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                title="More actions"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={() => !saving && setShowNewModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  New enquiry
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Create a new customer or project enquiry.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setShowNewModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                <FormField label="Customer name" required>
                  <input
                    className="form-input"
                    value={newEnquiry.customerName}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        customerName: e.target.value,
                      })
                    }
                    placeholder="Enter customer name"
                  />
                </FormField>

                <FormField label="Customer role">
                  <input
                    className="form-input"
                    value={newEnquiry.customerRole}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        customerRole: e.target.value,
                      })
                    }
                    placeholder="Procurement Head"
                  />
                </FormField>

                <FormField label="Company">
                  <input
                    className="form-input"
                    value={newEnquiry.company}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        company: e.target.value,
                      })
                    }
                    placeholder="Enter company name"
                  />
                </FormField>

                <FormField label="Phone">
                  <input
                    className="form-input"
                    value={newEnquiry.phone}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+91 XXXXX XXXXX"
                  />
                </FormField>

                <FormField label="Email">
                  <input
                    className="form-input"
                    type="email"
                    value={newEnquiry.email}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        email: e.target.value,
                      })
                    }
                    placeholder="customer@company.com"
                  />
                </FormField>

                <FormField label="Project">
                  <input
                    className="form-input"
                    value={newEnquiry.project}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        project: e.target.value,
                      })
                    }
                    placeholder="Project name"
                  />
                </FormField>

                <FormField label="Location">
                  <input
                    className="form-input"
                    value={newEnquiry.location}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        location: e.target.value,
                      })
                    }
                    placeholder="City, State"
                  />
                </FormField>

                <FormField label="Project reference">
                  <input
                    className="form-input"
                    value={newEnquiry.projectRef}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        projectRef: e.target.value,
                      })
                    }
                    placeholder="Project reference"
                  />
                </FormField>

                <FormField label="Product">
                  <select
                    className="form-input"
                    value={newEnquiry.product}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        product: e.target.value,
                      })
                    }
                  >
                    {PRODUCT_OPTIONS.map((product) => (
                      <option key={product}>{product}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Quantity">
                  <input
                    className="form-input"
                    value={newEnquiry.quantity}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        quantity: e.target.value,
                      })
                    }
                    placeholder="2,500 Kg"
                  />
                </FormField>

                <FormField label="Estimated value">
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={newEnquiry.estimatedValue}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        estimatedValue: e.target.value,
                      })
                    }
                    placeholder="225000"
                  />
                </FormField>

                <FormField label="Source">
                  <select
                    className="form-input"
                    value={newEnquiry.source}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        source: e.target.value,
                      })
                    }
                  >
                    {SOURCE_OPTIONS.map((source) => (
                      <option key={source}>{source}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Priority">
                  <select
                    className="form-input"
                    value={newEnquiry.priority}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        priority: e.target.value,
                      })
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </FormField>

                <FormField label="Assigned to">
                  <input
                    className="form-input"
                    value={newEnquiry.assignedTo}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        assignedTo: e.target.value,
                      })
                    }
                    placeholder="Sales executive"
                  />
                </FormField>

                <FormField label="Assigned role">
                  <input
                    className="form-input"
                    value={newEnquiry.assignedRole}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        assignedRole: e.target.value,
                      })
                    }
                    placeholder="Sales Executive"
                  />
                </FormField>
              </div>

              <div className="mt-4">
                <FormField label="Requirement / notes">
                  <textarea
                    className="form-input min-h-[110px] resize-y py-2.5"
                    value={newEnquiry.requirement}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        requirement: e.target.value,
                      })
                    }
                    placeholder="Describe the customer's requirement..."
                  />
                </FormField>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowNewModal(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleCreateEnquiry}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#002244] px-4 text-xs font-semibold text-white hover:bg-[#00345f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={14} />

                {saving ? "Creating..." : "Create enquiry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && selectedEnquiry && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={() => !saving && setShowNoteModal(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Add timeline note
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Add activity to {selectedEnquiry.id}.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setShowNoteModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            <div className="px-6 py-5">
              <FormField label="Note">
                <textarea
                  autoFocus
                  className="form-input min-h-[130px] resize-y py-2.5"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter follow-up, quotation, dispatch or customer communication details..."
                />
              </FormField>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowNoteModal(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleAddNote}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#002244] px-4 text-xs font-semibold text-white hover:bg-[#00345f] disabled:opacity-60"
              >
                <Plus size={14} />

                {saving ? "Adding..." : "Add note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, meta, icon: Icon, iconClass }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}
        >
          <Icon size={15} />
        </div>
      </div>

      <div className="mt-3 text-[24px] font-bold tracking-[-0.02em] text-slate-900">
        {value}
      </div>

      <div className="mt-1 text-[11px] text-slate-400">{meta}</div>
    </div>
  );
}

function DetailSection({ title, action, children }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          {title}
        </h3>

        {action}
      </div>

      {children}
    </section>
  );
}

function ContactLine({ icon: Icon, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-xs text-slate-600">
      <Icon size={14} className="shrink-0 text-slate-400" />

      <span className="truncate">{value}</span>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </span>

      <div className="mt-1 truncate text-xs font-medium text-slate-700">
        {value}
      </div>
    </div>
  );
}

function FormField({ label, required = false, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}

        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {children}
    </div>
  );
}

export default Enquiries;