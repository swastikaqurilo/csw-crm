import { useEffect, useMemo, useState } from "react";
import {
Search,
Plus,
MoreHorizontal,
Mail,
Phone,
Building2,
Users,
UserCheck,
X,
Trash2,
Pencil,
} from "lucide-react";

import {
getContacts,
createContact,
updateContact,
deleteContact,
} from "../api/api";

function Contacts() {
const [contacts, setContacts] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

const [search, setSearch] = useState("");
const [companyFilter, setCompanyFilter] = useState("All Companies");

const [page, setPage] = useState(1);
const contactsPerPage = 5;

const [showModal, setShowModal] = useState(false);
const [editingContact, setEditingContact] = useState(null);
const [openMenu, setOpenMenu] = useState(null);

const [formData, setFormData] = useState({
name: "",
company: "",
role: "",
email: "",
phone: "",
status: "active",
});

const loadContacts = async () => {
try {
setLoading(true);
setError("");


  const response = await getContacts({
    page: 1,
    limit: 1000,
  });

  if (response.data.success) {
    setContacts(response.data.data || []);
  } else {
    setError("Failed to load contacts.");
  }
} catch (err) {
  console.error("Get contacts error:", err);
  setError(
    err.response?.data?.message ||
      "Unable to connect to the contacts API."
  );
} finally {
  setLoading(false);
}
};

useEffect(() => {
loadContacts();
}, []);

const companies = useMemo(() => {
return [
...new Set(
contacts
.map((contact) => contact.company)
.filter(Boolean)
),
].sort();
}, [contacts]);

const filteredContacts = useMemo(() => {
const searchValue = search.toLowerCase().trim();

return contacts.filter((contact) => {
  const matchesSearch =
    !searchValue ||
    contact.name?.toLowerCase().includes(searchValue) ||
    contact.company?.toLowerCase().includes(searchValue) ||
    contact.email?.toLowerCase().includes(searchValue) ||
    contact.phone?.toLowerCase().includes(searchValue) ||
    contact.contactId?.toLowerCase().includes(searchValue);

  const matchesCompany =
    companyFilter === "All Companies" ||
    contact.company === companyFilter;

  return matchesSearch && matchesCompany;
});
}, [contacts, search, companyFilter]);

const totalPages = Math.max(
1,
Math.ceil(filteredContacts.length / contactsPerPage)
);

const currentPage = Math.min(page, totalPages);

const paginatedContacts = filteredContacts.slice(
(currentPage - 1) * contactsPerPage,
currentPage * contactsPerPage
);

useEffect(() => {
setPage(1);
}, [search, companyFilter]);

const totalContacts = contacts.length;

const totalCompanies = new Set(
contacts.map((contact) => contact.company).filter(Boolean)
).size;

const activeContacts = contacts.filter(
(contact) => contact.status === "active"
).length;

const recentlyContacted = contacts.filter((contact) => {
if (!contact.lastContact) return false;

const contactDate = new Date(contact.lastContact);
const today = new Date();

const difference =
  (today - contactDate) / (1000 * 60 * 60 * 24);

return difference <= 7;

}).length;

const handleInputChange = (e) => {
const { name, value } = e.target;

setFormData((prev) => ({
  ...prev,
  [name]: value,
}));

};

const openCreateModal = () => {
setEditingContact(null);

setFormData({
  name: "",
  company: "",
  role: "",
  email: "",
  phone: "",
  status: "active",
});

setShowModal(true);

};

const openEditModal = (contact) => {
setEditingContact(contact);

setFormData({
  name: contact.name || "",
  company: contact.company || "",
  role: contact.role || "",
  email: contact.email || "",
  phone: contact.phone || "",
  status: contact.status || "active",
});

setOpenMenu(null);
setShowModal(true);

};

const closeModal = () => {
setShowModal(false);
setEditingContact(null);
};

const handleSubmit = async (e) => {
e.preventDefault();

try {
  setError("");

  if (editingContact) {
    await updateContact(editingContact._id, formData);
  } else {
    await createContact(formData);
  }

  closeModal();
  await loadContacts();
} catch (err) {
  console.error("Save contact error:", err);

  setError(
    err.response?.data?.message ||
      "Failed to save contact."
  );
}
};

const handleDelete = async (contact) => {
const confirmed = window.confirm(
`Are you sure you want to delete ${contact.name}?`
);

if (!confirmed) return;

try {
  setError("");

  await deleteContact(contact._id);

  setOpenMenu(null);
  await loadContacts();
} catch (err) {
  console.error("Delete contact error:", err);

  setError(
    err.response?.data?.message ||
      "Failed to delete contact."
  );
}

};

const formatDate = (date) => {
if (!date) return "—";

const parsedDate = new Date(date);

if (Number.isNaN(parsedDate.getTime())) {
  return "—";
}

return parsedDate.toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

};

return ( <div className="dashboard">

  <div className="page-heading">
    <div>
      <h1>Contacts</h1>
      <p>
        Manage people and companies connected to your enquiries.
      </p>
    </div>

    <button
      className="primary-button"
      onClick={openCreateModal}
    >
      <Plus size={16} />
      New Contact
    </button>
  </div>

  {/* ERROR */}
  {error && (
    <div className="error-message">
      {error}
    </div>
  )}

  {/* STATS */}
  <div className="stats-grid">

    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">
          <Users size={18} />
        </div>
      </div>

      <div className="stat-value">
        {loading ? "—" : totalContacts}
      </div>

      <div className="stat-title">
        Total Contacts
      </div>
    </div>

    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">
          <Building2 size={18} />
        </div>
      </div>

      <div className="stat-value">
        {loading ? "—" : totalCompanies}
      </div>

      <div className="stat-title">
        Companies
      </div>
    </div>

    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">
          <UserCheck size={18} />
        </div>
      </div>

      <div className="stat-value">
        {loading ? "—" : activeContacts}
      </div>

      <div className="stat-title">
        Active Contacts
      </div>
    </div>

    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">
          <Phone size={18} />
        </div>
      </div>

      <div className="stat-value">
        {loading ? "—" : recentlyContacted}
      </div>

      <div className="stat-title">
        Recently Contacted
      </div>
    </div>

  </div>

  {/* CONTACTS CARD */}
  <div className="enquiries-card">

    {/* TOOLBAR */}
    <div className="enquiries-toolbar">

      <div className="enquiry-search">
        <Search size={17} />

        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="enquiry-filters">

        <select
          className="filter-select"
          value={companyFilter}
          onChange={(e) =>
            setCompanyFilter(e.target.value)
          }
        >
          <option>All Companies</option>

          {companies.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>

      </div>

    </div>

    {/* TABLE */}
    <div className="table-container">

      <table>

        <thead>
          <tr>
            <th>Contact</th>
            <th>Company</th>
            <th>Role</th>
            <th>Contact Details</th>
            <th>Enquiries</th>
            <th>Last Contact</th>
            <th></th>
          </tr>
        </thead>

        <tbody>

          {loading ? (
            <tr>
              <td colSpan="7">
                <div className="empty-state">
                  Loading contacts...
                </div>
              </td>
            </tr>
          ) : paginatedContacts.length === 0 ? (
            <tr>
              <td colSpan="7">
                <div className="empty-state">
                  No contacts found.
                </div>
              </td>
            </tr>
          ) : (
            paginatedContacts.map((contact) => (

              <tr key={contact._id}>

                {/* CONTACT */}
                <td>
                  <div className="flex items-center gap-3">

                    <div className="user-avatar">
                      {contact.name?.charAt(0)?.toUpperCase()}
                    </div>

                    <div className="enquiry-person">
                      <strong>
                        {contact.name}
                      </strong>

                      <span>
                        {contact.contactId}
                      </span>
                    </div>

                  </div>
                </td>

                {/* COMPANY */}
                <td>
                  <strong>
                    {contact.company || "—"}
                  </strong>
                </td>

                {/* ROLE */}
                <td>
                  {contact.role || "—"}
                </td>

                {/* CONTACT DETAILS */}
                <td>
                  <div className="flex flex-col gap-1">

                    {contact.email && (
                      <span className="flex items-center gap-2 text-xs">
                        <Mail size={12} />
                        {contact.email}
                      </span>
                    )}

                    {contact.phone && (
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Phone size={12} />
                        {contact.phone}
                      </span>
                    )}

                  </div>
                </td>

                {/* ENQUIRIES */}
                <td>
                  <strong>
                    {contact.enquiries ?? 0}
                  </strong>
                </td>

                {/* LAST CONTACT */}
                <td>
                  {formatDate(contact.lastContact)}
                </td>

                {/* ACTION */}
                <td>

                  <div style={{ position: "relative" }}>

                    <button
                      className="table-action"
                      onClick={() =>
                        setOpenMenu(
                          openMenu === contact._id
                            ? null
                            : contact._id
                        )
                      }
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {openMenu === contact._id && (
                      <div
                        className="contact-action-menu"
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          zIndex: 20,
                          minWidth: "150px",
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow:
                            "0 8px 24px rgba(0,0,0,0.10)",
                          padding: "6px",
                        }}
                      >

                        <button
                          onClick={() =>
                            openEditModal(contact)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                            padding: "9px 10px",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            borderRadius: "6px",
                          }}
                        >
                          <Pencil size={14} />
                          Edit Contact
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(contact)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                            padding: "9px 10px",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            borderRadius: "6px",
                          }}
                        >
                          <Trash2 size={14} />
                          Delete Contact
                        </button>

                      </div>
                    )}

                  </div>

                </td>

              </tr>

            ))
          )}

        </tbody>

      </table>

    </div>

    {/* FOOTER */}
    <div className="pagination">

      <span>
        {filteredContacts.length === 0
          ? "Showing 0 contacts"
          : `Showing ${
              (currentPage - 1) * contactsPerPage + 1
            }–${Math.min(
              currentPage * contactsPerPage,
              filteredContacts.length
            )} of ${filteredContacts.length} contacts`}
      </span>

      <div className="pagination-buttons">

        <button
          disabled={currentPage === 1}
          onClick={() =>
            setPage((prev) => Math.max(prev - 1, 1))
          }
        >
          Previous
        </button>

        {Array.from(
          { length: totalPages },
          (_, index) => index + 1
        )
          .slice(0, 5)
          .map((pageNumber) => (
            <button
              key={pageNumber}
              className={
                currentPage === pageNumber
                  ? "pagination-active"
                  : ""
              }
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}

        <button
          disabled={currentPage === totalPages}
          onClick={() =>
            setPage((prev) =>
              Math.min(prev + 1, totalPages)
            )
          }
        >
          Next
        </button>

      </div>

    </div>

  </div>

  {/* NEW CONTACT MODAL */}
{showModal && (

  <div className="contact-modal-overlay">
    <div
      className="contact-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="contact-modal-header">
        <div>
          <h2>
            {editingContact ? "Edit Contact" : "New Contact"}
          </h2>
          <p>
            {editingContact
              ? "Update the contact information below."
              : "Add a new contact to your CRM."}
          </p>
        </div>
    <button
      type="button"
      className="contact-modal-close"
      onClick={closeModal}
    >
      <X size={18} />
    </button>
  </div>

  <form onSubmit={handleSubmit}>
    <div className="contact-form-grid">
      <div className="contact-form-group">
        <label>
          Contact Name <span>*</span>
        </label>

        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="e.g. Rajesh Kumar"
          required
        />
      </div>
      <div className="contact-form-group">
        <label>
          Company <span>*</span>
        </label>

        <input
          type="text"
          name="company"
          value={formData.company}
          onChange={handleInputChange}
          placeholder="e.g. ABC Infrastructure"
          required
        />
      </div>
      <div className="contact-form-group">
        <label>Role / Designation</label>

        <input
          type="text"
          name="role"
          value={formData.role}
          onChange={handleInputChange}
          placeholder="e.g. Procurement Manager"
        />
      </div>
      <div className="contact-form-group">
        <label>
          Email <span>*</span>
        </label>

        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="name@company.com"
          required
        />
      </div>
      <div className="contact-form-group">
        <label>Phone Number</label>

        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleInputChange}
          placeholder="+91 98765 43210"
        />
      </div>
      <div className="contact-form-group">
        <label>Status</label>

        <select
          name="status"
          value={formData.status}
          onChange={handleInputChange}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

    </div>
    <div className="contact-modal-footer">
      <button
        type="button"
        className="contact-cancel-btn"
        onClick={closeModal}
      >
        Cancel
      </button>

      <button
        type="submit"
        className="contact-save-btn"
      >
        {editingContact
          ? "Update Contact"
          : "Create Contact"}
      </button>
    </div>
  </form>
</div>

  </div>
)}

</div>
);
}

export default Contacts;