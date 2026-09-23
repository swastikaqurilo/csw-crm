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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
    contacts
      .map((contact) => contact.company)
      .filter(Boolean)
  ).size;

  const activeContacts = contacts.filter(
    (contact) => contact.status === "active"
  ).length;

  const recentlyContacted = contacts.filter((contact) => {
    if (!contact.lastContact) return false;

    const contactDate = new Date(contact.lastContact);

    if (Number.isNaN(contactDate.getTime())) {
      return false;
    }

    const today = new Date();

    const difference =
      (today - contactDate) / (1000 * 60 * 60 * 24);

    return difference >= 0 && difference <= 7;
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
    setOpenMenu(null);
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
        await updateContact(
          editingContact._id,
          formData
        );
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

  const getInitials = (name = "") => {
    const words = name.trim().split(/\s+/);

    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }

    return name.charAt(0).toUpperCase() || "?";
  };

  const resetFilters = () => {
    setSearch("");
    setCompanyFilter("All Companies");
    setPage(1);
  };

  const hasFilters =
    search.trim() || companyFilter !== "All Companies";

  return (
    <div className="min-h-full bg-[#f5f7fa] px-5 py-6 lg:px-7">

      {/* PAGE HEADER */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            CRM / Contacts
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Contacts
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage people and companies connected to your enquiries.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00345f] hover:shadow-md active:scale-[0.98]"
        >
          <Plus size={17} />
          New Contact
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="rounded-md p-1 text-red-500 transition hover:bg-red-100 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="mb-5 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users size={19} />
            </div>

            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Directory
            </span>
          </div>

          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : totalContacts}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            Total Contacts
          </div>
        </div>

        <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="mb-5 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Building2 size={19} />
            </div>

            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Accounts
            </span>
          </div>

          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : totalCompanies}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            Companies
          </div>
        </div>

        <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="mb-5 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <UserCheck size={19} />
            </div>

            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Status
            </span>
          </div>

          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : activeContacts}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            Active Contacts
          </div>
        </div>

        <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="mb-5 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Phone size={19} />
            </div>

            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Activity
            </span>
          </div>

          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : recentlyContacted}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            Recently Contacted
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">

            <div className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 px-4 text-slate-400 transition focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm">
              <Search size={17} className="shrink-0" />

              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={companyFilter}
              onChange={(e) =>
                setCompanyFilter(e.target.value)
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option>All Companies</option>

              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={15} />
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={loadContacts}
            disabled={loading}
            title="Refresh contacts"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">

            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Contact
                </th>

                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Company
                </th>

                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Role
                </th>

                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Contact Details
                </th>

                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Enquiries
                </th>

                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Last Contact
                </th>

                <th className="w-16 px-5 py-3.5"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {loading ? (
                <tr>
                  <td colSpan="7">
                    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002244]" />

                      <p className="text-sm font-medium text-slate-500">
                        Loading contacts...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedContacts.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Users size={21} />
                      </div>

                      <h3 className="text-sm font-semibold text-slate-800">
                        No contacts found
                      </h3>

                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        {hasFilters
                          ? "Try adjusting your search or company filter."
                          : "Create your first contact to start building your directory."}
                      </p>

                      {!hasFilters && (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#002244] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#00345f]"
                        >
                          <Plus size={15} />
                          New Contact
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((contact) => (
                  <tr
                    key={contact._id}
                    className="group transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#002244] text-xs font-bold text-white shadow-sm">
                          {getInitials(contact.name)}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {contact.name || "Unnamed Contact"}
                          </div>

                          <div className="mt-0.5 text-xs font-medium text-slate-400">
                            {contact.contactId || "—"}
                          </div>
                        </div>

                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Building2
                          size={15}
                          className="text-slate-400"
                        />

                        <span>
                          {contact.company || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">
                        {contact.role || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">

                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex max-w-[220px] items-center gap-2 truncate text-xs font-medium text-slate-600 transition hover:text-[#002244]"
                          >
                            <Mail
                              size={13}
                              className="shrink-0 text-slate-400"
                            />

                            <span className="truncate">
                              {contact.email}
                            </span>
                          </a>
                        ) : null}

                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-[#002244]"
                          >
                            <Phone
                              size={13}
                              className="shrink-0 text-slate-400"
                            />

                            <span>{contact.phone}</span>
                          </a>
                        ) : null}

                        {!contact.email && !contact.phone && (
                          <span className="text-xs text-slate-400">
                            No contact details
                          </span>
                        )}

                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {contact.enquiries ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">
                        {formatDate(contact.lastContact)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="relative inline-block">

                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu === contact._id
                                ? null
                                : contact._id
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                          aria-label="Contact actions"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {openMenu === contact._id && (
                          <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl shadow-slate-200/60">

                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(contact)
                              }
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil
                                size={14}
                                className="text-slate-400"
                              />
                              Edit Contact
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(contact)
                              }
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
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
        {!loading && filteredContacts.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">

            <span className="text-xs font-medium text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {(currentPage - 1) * contactsPerPage + 1}
              </span>
              –
              <span className="font-semibold text-slate-700">
                {Math.min(
                  currentPage * contactsPerPage,
                  filteredContacts.length
                )}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {filteredContacts.length}
              </span>{" "}
              contacts
            </span>

            <div className="flex items-center gap-1.5">

              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() =>
                  setPage((prev) =>
                    Math.max(prev - 1, 1)
                  )
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <div className="hidden items-center gap-1 sm:flex">
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                )
                  .slice(0, 5)
                  .map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${
                        currentPage === pageNumber
                          ? "bg-[#002244] text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setPage((prev) =>
                    Math.min(prev + 1, totalPages)
                  )
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>

            </div>
          </div>
        )}
      </div>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#002244]/10 text-[#002244]">
                    {editingContact ? (
                      <Pencil size={15} />
                    ) : (
                      <Plus size={17} />
                    )}
                  </div>

                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {editingContact
                      ? "Edit Contact"
                      : "New Contact"}
                  </h2>
                </div>

                <p className="text-sm text-slate-500">
                  {editingContact
                    ? "Update the contact information below."
                    : "Add a new contact to your CRM."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>

            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Contact Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Rajesh Kumar"
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Company <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="e.g. ABC Infrastructure"
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Role / Designation
                  </label>

                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    placeholder="e.g. Procurement Manager"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Email <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@company.com"
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Phone Number
                  </label>

                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">

                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00345f] hover:shadow-md active:scale-[0.98]"
                >
                  {editingContact ? (
                    <>
                      <Pencil size={15} />
                      Update Contact
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Contact
                    </>
                  )}
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
