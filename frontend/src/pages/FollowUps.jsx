import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Send,
  Download,
  X,
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

function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [enquiries, setEnquiries] = useState([]);

  const [activeTab, setActiveTab] = useState("Today");
  
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [priorityFilter, setPriorityFilter] = useState("All Priorities");
  const [stateFilter, setStateFilter] = useState("Pending Execution");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingFollowUp, setEditingFollowUp] = useState(null);

  // const [selectedDate, setSelectedDate] = useState(
  //   new Date().toISOString().split("T")[0]
  // );

  const [formData, setFormData] = useState({
    contact: "",
    enquiry: "",
    type: "Call",
    subject: "",
    notes: "",
    scheduledAt: "",
    status: "Pending",
    priority: "Medium",
  });

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
      console.error("Failed to load contacts", err);
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
      console.error("Failed to load enquiries", err);
    }
  };

  useEffect(() => {
    fetchFollowUps();
    fetchContacts();
    fetchEnquiries();
  }, []);

  const getCustomerName = (followUp) => {
    return followUp.contact?.name || "Unknown Contact";
  };

  const getCompanyName = (followUp) => {
    return followUp.contact?.company || "No Company";
  };

  const getEnquiryNumber = (followUp) => {
    return (
      followUp.enquiry?.enquiryNumber ||
      "No Enquiry"
    );
  };

  const formatDateTime = (date) => {
    if (!date) return "No date";

    const d = new Date(date);

    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getColor = (item) => {
    if (item.priority === "High") return "red";
    if (item.priority === "Medium") return "orange";
    return "amber";
  };

  const getInitials = (name) => {
    if (!name) return "?";

    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const isToday = (date) => {
    const today = new Date();
    const target = new Date(date);

    return (
      today.getFullYear() === target.getFullYear() &&
      today.getMonth() === target.getMonth() &&
      today.getDate() === target.getDate()
    );
  };

  const isCompleted = (item) =>
    item.status === "Completed";

  const isOverdue = (item) => {
    if (item.status !== "Pending") return false;

    return new Date(item.scheduledAt) < new Date();
  };

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      const today = isToday(item.scheduledAt);
      const completed = isCompleted(item);
      const overdue = isOverdue(item);

      let tabMatch = true;

      if (activeTab === "Today") {
        tabMatch = today && !completed;
      }

      if (activeTab === "Upcoming") {
        tabMatch =
          new Date(item.scheduledAt) > new Date() &&
          !completed;
      }

      if (activeTab === "Overdue") {
        tabMatch = overdue;
      }

      if (activeTab === "Completed") {
        tabMatch = completed;
      }

      const typeMatch =
        typeFilter === "All Types" ||
        item.type === typeFilter;

      const priorityMatch =
        priorityFilter === "All Priorities" ||
        item.priority === priorityFilter;

      let stateMatch = true;

      if (stateFilter === "Pending Execution") {
        stateMatch = item.status === "Pending";
      }

      if (stateFilter === "Completed") {
        stateMatch = item.status === "Completed";
      }

      if (stateFilter === "Rescheduled") {
        stateMatch = false;
      }

      return (
        tabMatch &&
        typeMatch &&
        priorityMatch &&
        stateMatch
      );
    });
  }, [
    followUps,
    activeTab,
    typeFilter,
    priorityFilter,
    stateFilter,
  ]);

  const todayFollowUps = followUps.filter(
    (item) =>
      isToday(item.scheduledAt) &&
      item.status !== "Cancelled"
  );

  const completedToday = todayFollowUps.filter(
    (item) => item.status === "Completed"
  );

  const commitmentRate =
    todayFollowUps.length > 0
      ? Math.round(
          (completedToday.length /
            todayFollowUps.length) *
            100
        )
      : 0;

  const scheduledCallsMeetings = followUps.filter(
    (item) =>
      item.status === "Pending" &&
      ["Call", "Meeting"].includes(item.type)
  ).length;

  const openCreateModal = () => {
    setEditingId(null);

    setFormData({
      contact: contacts[0]?._id || "",
      enquiry: "",
      type: "Call",
      subject: "",
      notes: "",
      scheduledAt: "",
      status: "Pending",
      priority: "Medium",
    });

    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);

    setFormData({
      contact: item.contact?._id || item.contact || "",
      enquiry: item.enquiry?._id || item.enquiry || "",
      type: item.type || "Call",
      subject: item.subject || "",
      notes: item.notes || "",
      scheduledAt: item.scheduledAt
        ? new Date(item.scheduledAt)
            .toISOString()
            .slice(0, 16)
        : "",
      status: item.status || "Pending",
      priority: item.priority || "Medium",
    });

    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
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

      await fetchFollowUps();
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
          "Failed to save follow-up."
      );
    }
  };
  const markCompleted = async (item) => {
    try {
      await updateFollowup(item._id, {
        status: "Completed",
        completedAt: new Date().toISOString(),
      });

      await fetchFollowUps();
    } catch (err) {
      console.error(err);

      alert("Failed to mark follow-up as completed.");
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

      alert("Failed to delete follow-up.");
    }
  };

  return (
    <div className="followups-page">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <div className="fu-breadcrumb">
            SALES OPERATIONS & EXECUTION{" "}
            <span>•</span> IST Soft Active
          </div>

          <h1>Follow-ups</h1>

          <p>
            Stay on top of customer conversations and
            pending actions.
          </p>
        </div>

        <div className="fu-header-right">
          <div className="fu-metric">
            <span className="fu-metric-label">
              Commitment Rate
            </span>

            <strong>{commitmentRate}%</strong>
          </div>
{/* 
          <div className="fu-metric">
            <span className="fu-metric-label">
              Target Pipeline
            </span>

            <strong>₹5.3L</strong>
          </div> */}

          <button
            className="btn btn-primary"
            onClick={openCreateModal}
          >
            <Plus size={16} />
            Schedule follow-up
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="fu-tabs-row">
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`tab ${
                activeTab === tab ? "active" : ""
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* <div className="fu-date-selector">
          <label htmlFor="followup-date">Date</label>

          <input
            id="followup-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />

          <span className="fu-date-today">
            {selectedDate === new Date().toISOString().split("T")[0]
              ? "Today"
              : ""}
          </span>
        </div> */}
      </div>

      {/* FILTERS */}
      <div className="fu-filters">
        <div className="fu-filter-group">
          <label>Follow-up Type</label>

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value)
            }
          >
            <option>All Types</option>
            <option>Call</option>
            <option>Email</option>
            <option>Meeting</option>
            <option>WhatsApp</option>
            <option>Other</option>
          </select>
        </div>

        <div className="fu-filter-group">
          <label>Priority</label>

          <select
            className="filter-select"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value)
            }
          >
            <option>All Priorities</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>

        <div className="fu-filter-group">
          <label>State</label>

          <select
            className="filter-select"
            value={stateFilter}
            onChange={(e) =>
              setStateFilter(e.target.value)
            }
          >
            <option>Pending Execution</option>
            <option>Completed</option>
          </select>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="fu-workspace">
        {/* LEFT */}
        <div className="fu-list">
          {loading ? (
            <div className="card">
              Loading follow-ups...
            </div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="card">
              No follow-ups found.
            </div>
          ) : (
            filteredFollowUps.map((item) => {
              const color = getColor(item);

              return (
                <div
                  key={item._id}
                  className={`fu-card fu-card-${color}`}
                >
                  {/* TOP */}
                  <div className="fu-card-top">
                    <div className="fu-card-badges">
                      <span
                        className={`fu-type-badge fu-type-${color}`}
                      >
                        {item.type === "Call" && (
                          <Phone size={12} />
                        )}

                        {item.type === "Meeting" && (
                          <Calendar size={12} />
                        )}

                        {item.type !== "Call" &&
                          item.type !== "Meeting" && (
                            <FileText size={12} />
                          )}

                        {item.type}
                      </span>

                      <span
                        className={`badge ${
                          item.priority === "High"
                            ? "badge-danger"
                            : item.priority === "Medium"
                            ? "badge-warning"
                            : "badge-neutral"
                        }`}
                      >
                        {item.priority} Priority
                      </span>

                      <span className="badge badge-neutral">
                        {item.status}
                      </span>
                    </div>

                    <div className="fu-card-time">
                      <Clock size={13} />
                      {formatDateTime(
                        item.scheduledAt
                      )}
                    </div>
                  </div>

                  {/* CUSTOMER */}
                  <div className="fu-card-customer">
                    <div className="fu-customer-label">
                      CUSTOMER & ACCOUNT
                    </div>

                    <strong>
                      {getCustomerName(item)} /{" "}
                      {getCompanyName(item)}
                    </strong>
                  </div>

                  {/* COMMERCIAL */}
                  <div className="fu-card-linkage">
                    <div>
                      <div className="fu-customer-label">
                        COMMERCIAL LINKAGE
                      </div>

                      <div className="fu-linkage-value">
                        <span className="font-mono text-brand">
                          {getEnquiryNumber(item)}
                        </span>

                        {item.subject && (
                          <span className="text-muted">
                            {" "}
                            · {item.subject}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AGENDA */}
                  <div className="fu-card-agenda">
                    <div className="fu-customer-label">
                      ACTION AGENDA
                    </div>

                    <p>
                      {item.notes ||
                        "No notes added for this follow-up."}
                    </p>
                  </div>

                  {/* FOOTER */}
                  <div className="fu-card-footer">
                    <div className="fu-assigned">
                      <div className="avatar avatar-sm">
                        {getInitials(getCustomerName(item))}
                      </div>

                      <span>
                        Contact:{" "}
                        <strong>
                          {getCustomerName(item)}
                        </strong>
                      </span>
                    </div>
                   <div className="fu-card-actions">
                      {item.type === "Call" && (
                        <button className="btn btn-primary btn-sm">
                          <Phone size={13} />
                          Call Now
                        </button>
                      )}

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          openEditModal(item)
                        }
                      >
                        Edit
                      </button>

                      {item.status === "Pending" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            markCompleted(item)
                          }
                        >
                          <CheckCircle2 size={13} />
                          Mark Completed
                        </button>
                      )}

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          handleDelete(item._id)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside className="fu-sidebar">

  {/* SLA */}
  <div className="card fu-sla-card">
    <div className="fu-sla-card-header">
      <h3>Daily Conversion SLA</h3>

      <span className="badge badge-brand">
        TARGET 100%
      </span>
    </div>

    <div className="fu-sla-card-body">
      <div className="fu-sla-circle">
        <svg viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-ink-100)"
            strokeWidth="10"
          />

          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth="10"
            strokeDasharray={`${
              (commitmentRate / 100) *
              2 *
              Math.PI *
              52
            } ${2 * Math.PI * 52}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>

        <div className="fu-sla-value">
          <strong>{commitmentRate}%</strong>

          <span>
            {completedToday.length} OF{" "}
            {todayFollowUps.length} DONE
          </span>
        </div>
      </div>
    </div>
  </div>


  {/* SUMMARY */}
  <div className="card fu-side-card">
    <div className="fu-side-card-header">
      <h3>Follow-up Summary</h3>
    </div>

    <div className="fu-side-card-body">

      <div className="fu-side-row">
        <div>
          <div className="fu-card-section-label">
            Calls & Meetings
          </div>

          <strong className="fu-side-number">
            {scheduledCallsMeetings}
          </strong>

          <span className="fu-side-unit">
            Scheduled
          </span>
        </div>

        <div className="fu-side-metric-right">
          <div className="fu-card-section-label">
            Commercial & Payments
          </div>

          <strong className="fu-side-amount">
            ₹65,000
          </strong>
        </div>
      </div>

      <div className="fu-side-divider" />

      <div className="fu-side-row">
        <div>
          <div className="fu-card-section-label">
            Total Follow-ups
          </div>

          <strong className="fu-side-number">
            {followUps.length}
          </strong>
        </div>
      </div>

    </div>
  </div>


  {/* QUICK ACTIONS */}
  <div className="card fu-side-card">
    <div className="fu-side-card-header">
      <h3>Quick Actions</h3>
    </div>

    <div className="fu-side-card-body">
      <div className="fu-quick-actions">

        <button className="btn btn-secondary btn-sm">
          <Send size={13} />
          Send Bulk Payment Reminders
        </button>

        <button className="btn btn-secondary btn-sm">
          <Download size={13} />
          Export Daily Follow-up Ledger
        </button>

      </div>
    </div>
  </div>

</aside>
      </div>

    {showModal && (
      <div
        className="contact-modal-overlay"
        onClick={() => setShowModal(false)}
      >
        <div
          className="contact-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="contact-modal-header">
            <div>
              <h2>Schedule Follow-up</h2>
              <p>Create a new follow-up for a customer or enquiry.</p>
            </div>

            <button
              type="button"
              className="contact-modal-close"
              onClick={() => setShowModal(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit}>
            <div className="contact-form-grid">

              {/* Contact */}
              <div className="contact-form-group">
                <label>
                  Contact <span>*</span>
                </label>

                <select
                  value={formData.contact}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contact: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select contact</option>

                  {contacts.map((contact) => (
                    <option key={contact._id} value={contact._id}>
                      {contact.name} — {contact.company}
                    </option>
                  ))}
                </select>
              </div>

              {/* Enquiry */}
              <div className="contact-form-group">
                <label>Enquiry</label>

                <select
                  value={formData.enquiry}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enquiry: e.target.value,
                    })
                  }
                >
                  <option value="">Select enquiry</option>

                  {enquiries.map((enquiry) => (
                    <option key={enquiry._id} value={enquiry._id}>
                      {enquiry.enquiryNumber} — {enquiry.customerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div className="contact-form-group">
                <label>
                  Follow-up Type <span>*</span>
                </label>

                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value,
                    })
                  }
                  required
                >
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Priority */}
              <div className="contact-form-group">
                <label>Priority</label>

                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value,
                    })
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              {/* Subject */}
              <div className="contact-form-group full-width">
                <label>
                  Subject <span>*</span>
                </label>

                <input
                  type="text"
                  placeholder="e.g. Discuss GI wire requirement"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      subject: e.target.value,
                    })
                  }
                  required
                />
              </div>

              {/* Date & Time */}
              <div className="contact-form-group">
                <label>
                  Scheduled Date & Time <span>*</span>
                </label>

                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scheduledAt: e.target.value,
                    })
                  }
                  required
                />
              </div>

              {/* Status */}
              <div className="contact-form-group">
                <label>Status</label>

                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Notes */}
              <div className="contact-form-group full-width">
                <label>Notes</label>

                <textarea
                  rows="4"
                  placeholder="Add agenda, discussion points or additional notes..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notes: e.target.value,
                    })
                  }
                />
              </div>

            </div>

            {/* FOOTER */}
            <div className="contact-modal-footer">
              <button
                type="button"
                className="contact-cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="contact-save-btn"
              >
                Schedule Follow-up
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