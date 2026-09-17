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

const statusClass = {
  New: "status-new",
  Contacted: "status-contacted",
  "In Progress": "status-in-progress",
  "In Discussion": "status-in-progress",
  Quoted: "status-quoted",
  Converted: "status-resolved",
  Lost: "status-lost",
};

function EnquiryStatus({ status }) {
  return (
    <span className={`status ${statusClass[status] || "status-new"}`}>
      {status}
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

// Convert backend object to the shape used by the UI
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

function Enquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [sourceFilter, setSourceFilter] = useState("All Sources");

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [showNewModal, setShowNewModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [newEnquiry, setNewEnquiry] = useState({
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
  });

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

      if (mapped.length > 0) {
        const stillExists = mapped.some(
          (item) => item.id === selectedId
        );

        if (!stillExists) {
          setSelectedId(mapped[0].id);
        }
      } else {
        setSelectedId(null);
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

  // Search after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadEnquiries();
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const selectedEnquiry = useMemo(() => {
    return (
      enquiries.find((item) => item.id === selectedId) ||
      null
    );
  }, [enquiries, selectedId]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All Statuses");
    setSourceFilter("All Sources");
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

      setNewEnquiry({
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
      });

      await loadEnquiries();

      if (created?.enquiryNumber) {
        setSelectedId(created.enquiryNumber);
      }
    } catch (err) {
      console.error("Create enquiry error:", err);

      alert(
        err?.response?.data?.message ||
          "Failed to create enquiry."
      );
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

      alert(
        err?.response?.data?.message ||
          "Failed to update enquiry."
      );
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

      alert(
        err?.response?.data?.message ||
          "Failed to delete enquiry."
      );
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

      await fetch(
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

      setNoteText("");
      setShowNoteModal(false);

      const response = await getEnquiryById(
        selectedEnquiry.mongoId
      );

      const updated = mapEnquiry(response.data.data);

      setEnquiries((current) =>
        current.map((item) =>
          item.mongoId === updated.mongoId
            ? updated
            : item
        )
      );
    } catch (err) {
      console.error("Add note error:", err);

      alert("Failed to add note.");
    } finally {
      setSaving(false);
    }
  };

  const startRecord =
    total === 0 ? 0 : (page - 1) * limit + 1;

  const endRecord = Math.min(page * limit, total);

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > pages) return;

    setPage(newPage);
  };

  const stats = useMemo(() => {
    const newCount = enquiries.filter(
      (item) => item.status === "New"
    ).length;

    const progressCount = enquiries.filter(
      (item) =>
        item.status === "In Progress" ||
        item.status === "In Discussion"
    ).length;

    const convertedCount = enquiries.filter(
      (item) => item.status === "Converted"
    ).length;

    return {
      newCount,
      progressCount,
      convertedCount,
    };
  }, [enquiries]);

  return (
    <div className="enquiries-page">
      <div className="page-heading">
        <div>
          <div className="enq-breadcrumb">
            COMMERCIAL PIPELINE <span>•</span> FY 2026-27
          </div>

          <h1>Enquiries</h1>

          <p>
            Manage incoming customer and project enquiries.
          </p>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-secondary">
            <Download size={15} />
            Export Ledger
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowNewModal(true)}
          >
            <Plus size={16} />
            New enquiry
          </button>
        </div>
      </div>
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      <div className="enq-stats-grid">
        <div className="enq-stat-card">
          <div className="enq-stat-top">
            <span className="enq-stat-label">
              TOTAL ENQUIRIES
            </span>

            <div className="enq-stat-icon">
              <ClipboardList size={15} />
            </div>
          </div>

          <div className="enq-stat-value">{total}</div>

          <div className="enq-stat-meta">
            <span>active records</span>
          </div>
        </div>

        <div className="enq-stat-card">
          <div className="enq-stat-top">
            <span className="enq-stat-label">NEW</span>

            <div className="enq-stat-icon blue">
              <MessageSquare size={15} />
            </div>
          </div>

          <div className="enq-stat-value">
            {stats.newCount}
          </div>

          <div className="enq-stat-meta">
            <span>current page</span>
          </div>
        </div>

        <div className="enq-stat-card">
          <div className="enq-stat-top">
            <span className="enq-stat-label">
              IN PROGRESS
            </span>

            <div className="enq-stat-icon amber">
              <Clock3 size={15} />
            </div>
          </div>

          <div className="enq-stat-value">
            {stats.progressCount}
          </div>

          <div className="enq-stat-meta">
            <span>active negotiations</span>
          </div>
        </div>

        <div className="enq-stat-card">
          <div className="enq-stat-top">
            <span className="enq-stat-label">
              CONVERTED
            </span>

            <div className="enq-stat-icon green">
              <CheckCircle2 size={15} />
            </div>
          </div>

          <div className="enq-stat-value">
            {stats.convertedCount}
          </div>

          <div className="enq-stat-meta">
            <span>current page</span>
          </div>
        </div>
      </div>

      <div className="enq-filter-bar">
        <div className="enq-search">
          <Search size={15} />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search enquiry by ID, customer, project or product..."
          />
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option>All Statuses</option>

          {STATUS_OPTIONS.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
        >
          <option>All Sources</option>

          {SOURCE_OPTIONS.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </select>

        <button className="filter-button">
          <CalendarDays size={14} />
          Last 30 days
        </button>

        <button
          className="filter-button"
          onClick={resetFilters}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      <div className="enq-workspace">
        <section className="enq-queue card">
          <div className="enq-queue-header">
            <div>
              <h2>Active Enquiries Queue</h2>

              <span className="text-muted text-sm">
                {loading
                  ? "Loading..."
                  : `${enquiries.length} displayed`}
              </span>
            </div>

            <div className="enq-view-toggle">
              <button className="active">
                Standard
              </button>

              <button>Compact</button>

              <button
                className="icon-only"
                title="Column settings"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div className="empty-state">
                <Clock3 size={28} />

                <h4>Loading enquiries...</h4>

                <p>
                  Fetching enquiry data from the server.
                </p>
              </div>
            ) : (
              <table className="table enq-table">
                <thead>
                  <tr>
                    <th>ENQUIRY ID</th>
                    <th>CUSTOMER</th>
                    <th>COMPANY</th>
                    <th>PROJECT / LOCATION</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {enquiries.map((item) => (
                    <tr
                      key={item.mongoId}
                      className={
                        selectedId === item.id
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setSelectedId(item.id)
                      }
                    >
                      <td>
                        <button
                          className="enq-id-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(item.id);
                          }}
                        >
                          {item.id}
                        </button>
                      </td>

                      <td>
                        <div className="enq-customer">
                          <strong>
                            {item.customer}
                          </strong>

                          <span>{item.role}</span>
                        </div>
                      </td>

                      <td>
                        <span className="text-sm">
                          {item.company}
                        </span>
                      </td>

                      <td>
                        <div className="enq-project-cell">
                          <span>{item.project}</span>

                          <span className="text-muted text-xs flex items-center gap-1">
                            <MapPin size={11} />

                            {item.location}
                          </span>
                        </div>
                      </td>

                      <td>
                        <EnquiryStatus
                          status={item.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!loading && enquiries.length === 0 && (
              <div className="empty-state">
                <Search size={28} />

                <h4>No enquiries found</h4>

                <p>
                  Try changing your search or filters.
                </p>
              </div>
            )}
          </div>
          <div className="enq-pagination">
            <span>
              Showing{" "}
              <strong>
                {startRecord}–{endRecord}
              </strong>{" "}
              of <strong>{total}</strong>
            </span>

            <span className="text-muted">
              Page <strong>{page}</strong> of{" "}
              <strong>{pages}</strong>
            </span>

            <div className="pagination-buttons">
              <button
                disabled={page === 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from(
                { length: Math.min(pages, 5) },
                (_, index) => {
                  const pageNumber = index + 1;

                  return (
                    <button
                      key={pageNumber}
                      className={
                        page === pageNumber
                          ? "pagination-active"
                          : ""
                      }
                      onClick={() =>
                        goToPage(pageNumber)
                      }
                    >
                      {pageNumber}
                    </button>
                  );
                }
              )}

              <button
                disabled={page === pages}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>

        <aside className="enq-detail card">
          {!selectedEnquiry ? (
            <div className="empty-state">
              <ClipboardList size={30} />

              <h4>Select an enquiry</h4>

              <p>
                Select an enquiry from the queue to view
                its details.
              </p>
            </div>
          ) : (
            <>
            <div className="enq-detail-header">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="enq-detail-id">
                    {selectedEnquiry.id}
                  </span>

                  <EnquiryStatus
                    status={selectedEnquiry.status}
                  />
                </div>

                <h2>Enquiry Details</h2>

                <p className="text-muted text-sm">
                  Created {selectedEnquiry.created} · {selectedEnquiry.source}
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() => setSelectedId(null)}
                aria-label="Close enquiry details"
              >
                <X size={17} />
              </button>
            </div>

              <div className="enq-detail-body">

              {/* PRODUCT */}
              <div className="enq-product-card">
                <div className="enq-product-image">
                  <div className="wire-placeholder">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>

                <div className="enq-product-info">
                  <span className="enq-detail-label">
                    MATERIAL GRADE
                  </span>

                  <strong>
                    {selectedEnquiry.product}
                  </strong>

                  <span className="enq-product-grade">
                    Heavy Galvanized Grade 1
                  </span>

                  <div className="enq-product-meta">
                    <b>
                      {selectedEnquiry.quantity ||
                        "Quantity not specified"}
                    </b>

                    <span>
                      Est. {selectedEnquiry.value}
                    </span>
                  </div>
                </div>
              </div>


              {/* CUSTOMER */}
              <div className="enq-section">
                <div className="enq-section-title">
                  CUSTOMER & ENTERPRISE PROFILE
                </div>

                <div className="enq-profile">
                  <div className="avatar avatar-md">
                    {selectedEnquiry.customer
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div className="enq-profile-info">
                    <strong>
                      {selectedEnquiry.customer}
                    </strong>

                    <span>
                      {selectedEnquiry.role}
                    </span>
                  </div>
                </div>

                <div className="enq-contact-list">
                  <div className="enq-contact-item">
                    <Building2 size={15} />
                    <span>{selectedEnquiry.company}</span>
                  </div>

                  <div className="enq-contact-item">
                    <Phone size={15} />
                    <span>{selectedEnquiry.phone}</span>
                  </div>

                  <div className="enq-contact-item">
                    <Mail size={15} />
                    <span>{selectedEnquiry.email}</span>
                  </div>

                  <div className="enq-contact-item">
                    <FileText size={15} />
                    <span>
                      Project: {selectedEnquiry.projectRef}
                    </span>
                  </div>
                </div>
              </div>


              {/* STATUS + ASSIGNED */}
              <div className="enq-two-col">

                <div>
                  <div className="enq-section-title">
                    STATUS STATE
                  </div>

                  <select
                    className="filter-select enq-status-select"
                    value={selectedEnquiry.status}
                    disabled={saving}
                    onChange={(e) =>
                      handleStatusChange(e.target.value)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="enq-section-title">
                    ASSIGNED LEAD
                  </div>

                  <div className="enq-assigned">
                    <div className="avatar avatar-sm">
                      {selectedEnquiry.assigned
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div className="enq-assigned-info">
                      <strong>
                        {selectedEnquiry.assigned}
                      </strong>

                      {selectedEnquiry.assignedRole && (
                        <span>
                          {selectedEnquiry.assignedRole}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>


              {/* NOTES */}
              <div className="enq-section">
                <div className="enq-section-title">
                  TECHNICAL & DISPATCH NOTES
                </div>

                <p className="enq-notes">
                  {selectedEnquiry.requirement}
                </p>

                <button
                  className="text-button"
                  onClick={() => setShowNoteModal(true)}
                >
                  <Plus size={13} />
                  Add note
                </button>
              </div>


              {/* TIMELINE */}
              <div className="enq-section">
                <div className="enq-section-title enq-timeline-header">
                  <span>
                    AUDIT & ACTIVITY TIMELINE
                  </span>

                  <button
                    className="text-button"
                    onClick={() => setShowNoteModal(true)}
                  >
                    + Add note
                  </button>
                </div>

                <div className="enq-timeline">
                  {selectedEnquiry.timeline.length > 0 ? (
                    selectedEnquiry.timeline.map(
                      (event, index) => (
                        <div
                          className="enq-timeline-item"
                          key={index}
                        >
                          <div className="enq-timeline-dot" />

                          <div className="enq-timeline-content">
                            <strong>
                              {formatTimelineDate(event.date)}
                            </strong>

                            <p>{event.text}</p>

                            {event.createdBy && (
                              <small>
                                By {event.createdBy}
                              </small>
                            )}
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-muted text-sm">
                      No activity recorded yet.
                    </p>
                  )}
                </div>
              </div>

            </div>

              <div className="enq-detail-footer">
                <button className="btn btn-primary">
                  <Send size={14} />
                  Generate Quote
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  title="Delete enquiry"
                  disabled={saving}
                  onClick={handleDeleteEnquiry}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {showNewModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            !saving && setShowNewModal(false)
          }
        >
          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{ maxWidth: 700 }}
          >
            <div className="modal-header">
              <div>
                <h3>New enquiry</h3>

                <p className="text-muted text-sm">
                  Create a new customer/project enquiry.
                </p>
              </div>

              <button
                className="icon-button"
                disabled={saving}
                onClick={() =>
                  setShowNewModal(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">
                    Customer name *
                  </label>

                  <input
                    className="input"
                    value={
                      newEnquiry.customerName
                    }
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        customerName:
                          e.target.value,
                      })
                    }
                    placeholder="Enter customer name"
                  />
                </div>

                {/* ROLE */}

                <div className="form-group">
                  <label className="form-label">
                    Customer role
                  </label>

                  <input
                    className="input"
                    value={
                      newEnquiry.customerRole
                    }
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        customerRole:
                          e.target.value,
                      })
                    }
                    placeholder="Procurement Head"
                  />
                </div>

                {/* COMPANY */}

                <div className="form-group">
                  <label className="form-label">
                    Company
                  </label>

                  <input
                    className="input"
                    value={newEnquiry.company}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        company:
                          e.target.value,
                      })
                    }
                    placeholder="Enter company name"
                  />
                </div>

                {/* PHONE */}

                <div className="form-group">
                  <label className="form-label">
                    Phone
                  </label>

                  <input
                    className="input"
                    value={newEnquiry.phone}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>

                {/* EMAIL */}

                <div className="form-group">
                  <label className="form-label">
                    Email
                  </label>

                  <input
                    className="input"
                    value={newEnquiry.email}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        email: e.target.value,
                      })
                    }
                    placeholder="customer@company.com"
                  />
                </div>

                {/* PROJECT */}

                <div className="form-group">
                  <label className="form-label">
                    Project
                  </label>

                  <input
                    className="input"
                    value={newEnquiry.project}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        project:
                          e.target.value,
                      })
                    }
                    placeholder="Project name"
                  />
                </div>

                {/* LOCATION */}

                <div className="form-group">
                  <label className="form-label">
                    Location
                  </label>

                  <input
                    className="input"
                    value={newEnquiry.location}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        location:
                          e.target.value,
                      })
                    }
                    placeholder="City, State"
                  />
                </div>

                {/* PROJECT REF */}

                <div className="form-group">
                  <label className="form-label">
                    Project reference
                  </label>

                  <input
                    className="input"
                    value={
                      newEnquiry.projectRef
                    }
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        projectRef:
                          e.target.value,
                      })
                    }
                    placeholder="Project reference"
                  />
                </div>

                {/* PRODUCT */}

                <div className="form-group">
                  <label className="form-label">
                    Product
                  </label>

                  <select
                    className="select"
                    value={newEnquiry.product}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        product:
                          e.target.value,
                      })
                    }
                  >
                    {PRODUCT_OPTIONS.map(
                      (product) => (
                        <option
                          key={product}
                        >
                          {product}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* QUANTITY */}

                <div className="form-group">
                  <label className="form-label">
                    Quantity
                  </label>

                  <input
                    className="input"
                    value={newEnquiry.quantity}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        quantity:
                          e.target.value,
                      })
                    }
                    placeholder="2,500 Kg"
                  />
                </div>

                {/* VALUE */}

                <div className="form-group">
                  <label className="form-label">
                    Estimated value
                  </label>

                  <input
                    className="input"
                    type="number"
                    value={
                      newEnquiry.estimatedValue
                    }
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        estimatedValue:
                          e.target.value,
                      })
                    }
                    placeholder="225000"
                  />
                </div>

                {/* SOURCE */}

                <div className="form-group">
                  <label className="form-label">
                    Source
                  </label>

                  <select
                    className="select"
                    value={newEnquiry.source}
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        source:
                          e.target.value,
                      })
                    }
                  >
                    {SOURCE_OPTIONS.map(
                      (source) => (
                        <option
                          key={source}
                        >
                          {source}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* PRIORITY */}

                <div className="form-group">
                  <label className="form-label">
                    Priority
                  </label>

                  <select
                    className="select"
                    value={
                      newEnquiry.priority
                    }
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        priority:
                          e.target.value,
                      })
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>

                {/* ASSIGNED */}

                <div className="form-group">
                  <label className="form-label">
                    Assigned to
                  </label>

                  <input
                    className="input"
                    value={
                      newEnquiry.assignedTo
                    }
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        assignedTo:
                          e.target.value,
                      })
                    }
                    placeholder="Sales executive"
                  />
                </div>

                {/* ASSIGNED ROLE */}

                <div className="form-group">
                  <label className="form-label">
                    Assigned role
                  </label>

                  <input
                    className="input"
                    value={
                      newEnquiry.assignedRole
                    }
                    onChange={(e) =>
                      setNewEnquiry({
                        ...newEnquiry,
                        assignedRole:
                          e.target.value,
                      })
                    }
                    placeholder="Sales Executive"
                  />
                </div>
              </div>

              {/* REQUIREMENT */}

              <div className="form-group">
                <label className="form-label">
                  Requirement / notes
                </label>

                <textarea
                  className="textarea"
                  value={
                    newEnquiry.requirement
                  }
                  onChange={(e) =>
                    setNewEnquiry({
                      ...newEnquiry,
                      requirement:
                        e.target.value,
                    })
                  }
                  placeholder="Describe the customer's requirement..."
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                disabled={saving}
                onClick={() =>
                  setShowNewModal(false)
                }
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={handleCreateEnquiry}
              >
                <Plus size={15} />

                {saving
                  ? "Creating..."
                  : "Create enquiry"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNoteModal && selectedEnquiry && (
        <div
          className="modal-overlay"
          onClick={() =>
            !saving && setShowNoteModal(false)
          }
        >
          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{ maxWidth: 520 }}
          >
            <div className="modal-header">
              <div>
                <h3>Add timeline note</h3>

                <p className="text-muted text-sm">
                  Add activity to{" "}
                  {selectedEnquiry.id}.
                </p>
              </div>

              <button
                className="icon-button"
                disabled={saving}
                onClick={() =>
                  setShowNoteModal(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">
                  Note
                </label>

                <textarea
                  className="textarea"
                  value={noteText}
                  onChange={(e) =>
                    setNoteText(
                      e.target.value
                    )
                  }
                  placeholder="Enter follow-up, quotation, dispatch or customer communication details..."
                  rows={5}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                disabled={saving}
                onClick={() =>
                  setShowNoteModal(false)
                }
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={handleAddNote}
              >
                <Plus size={15} />

                {saving
                  ? "Adding..."
                  : "Add note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Enquiries;