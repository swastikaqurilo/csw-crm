import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
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
  MapPin,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  User,
  Truck,
  Receipt,
} from "lucide-react";

import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} from "../api/api";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ALLOWED_ROLES = ["customer", "supplier", "partner", "other", ""];
const CONTACTS_PER_PAGE = 10;

/* GST state codes (used to auto-fill State Code when a state is picked) */
const GST_STATES = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman and Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
};

const GSTIN_PATTERN = "^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$";

const emptyForm = () => ({
  name: "",
  company: "",
  role: "",
  email: "",
  phone: "",
  status: "active",

  billingAddress: "",
  gstin: "",
  state: "",
  stateCode: "",

  shippingName: "",
  shippingCompany: "",
  shippingAddress: "",
  shippingGstin: "",
  shippingState: "",
  shippingStateCode: "",
});

const ROLE_BADGE_STYLES = {
  customer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  supplier: "border-sky-200 bg-sky-50 text-sky-700",
  partner: "border-violet-200 bg-violet-50 text-violet-700",
  other: "border-slate-200 bg-slate-50 text-slate-600",
};

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
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

const normalizeString = (v) => (typeof v === "string" ? v : "");

/* "+91 98765 43210" / "098765-43210" → "9876543210" (schema wants 10 digits) */
const normalizePhone = (v = "") => {
  let digits = String(v).replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
};

/* Build a compact pager array like [1, "…", 4, 5, 6, "…", 20] */
function buildPager(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Tiny presentational pieces                                         */
/* ------------------------------------------------------------------ */

function RoleBadge({ role }) {
  if (!role) return <span className="text-sm text-slate-400">—</span>;
  const style = ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.other;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${style}`}
    >
      {role}
    </span>
  );
}

function StatusPill({ status }) {
  const active = status === "active";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-300"
        }`}
      />
      <span className={active ? "text-emerald-700" : "text-slate-500"}>
        {active ? "Active" : "Inactive"}
      </span>
    </span>
  );
}

function SortableHeader({ label, sortKey, sort, onSort, className = "" }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      className={`px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${className}`}
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1.5 transition hover:text-slate-700 ${
          active ? "text-slate-700" : ""
        }`}
      >
        {label}
        <Icon
          size={12}
          className={
            active ? "opacity-100" : "opacity-40 group-hover:opacity-70"
          }
        />
      </button>
    </th>
  );
}

/* Section heading used inside the modal */
function FormSection({ icon: Icon, title, hint, action, children }) {
  return (
    <section className="mt-6 first:mt-0">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={15} className="shrink-0 text-[#002244]" />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {hint && (
            <span className="hidden truncate text-[11px] text-slate-400 sm:inline">
              {hint}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function confirmToast(message) {
  return new Promise((resolve) => {
    const id = toast.info(
      ({ closeToast }) => (
        <div className="w-full">
          <p className="mb-3 text-sm text-slate-700">{message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resolve(false);
                toast.dismiss(id);
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                resolve(true);
                toast.dismiss(id);
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        closeButton: false,
        position: "top-center",
      }
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function Contacts() {
  /* ---- data ---- */
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ---- filters ---- */
  const [search, setSearch] = useState("");

  /* ---- sorting ---- */
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });

  /* ---- pagination ---- */
  const [page, setPage] = useState(1);

  /* ---- modal ---- */
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  /* ---- row actions menu ---- */
  const [openMenu, setOpenMenu] = useState(null);
  const [menuCoords, setMenuCoords] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  /* ---- guard against stale loadContacts results ---- */
  const loadTokenRef = useRef(0);

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */
  const loadContacts = useCallback(async () => {
    const token = ++loadTokenRef.current;
    try {
      setLoading(true);

      const response = await getContacts({ page: 1, limit: 1000 });

      if (token !== loadTokenRef.current) return;

      if (response?.data?.success) {
        setContacts(response.data.data || []);
      } else {
        toast.error("Failed to load contacts.");
      }
    } catch (err) {
      if (token !== loadTokenRef.current) return;
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to connect to the contacts API."
      )
    } finally {
      if (token === loadTokenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!openMenu) return;

    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    const onScroll = () => setOpenMenu(null);
    const onResize = () => setOpenMenu(null);

    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true); // capture → catches inner scrollers
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [openMenu]);

  /* ------------------------------------------------------------------ */
  /*  Derived data                                                       */
  /* ------------------------------------------------------------------ */
  const companies = useMemo(() => {
    const set = new Set();
    for (const c of contacts) {
      if (c.company) set.add(c.company);
    }
    return [...set].sort();
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return contacts.filter((c) => {
      const matchesSearch =
        !q ||
        normalizeString(c.name).toLowerCase().includes(q) ||
        normalizeString(c.company).toLowerCase().includes(q) ||
        normalizeString(c.email).toLowerCase().includes(q) ||
        normalizeString(c.phone).toLowerCase().includes(q) ||
        normalizeString(c.gstin).toLowerCase().includes(q) ||
        normalizeString(c.contactId).toLowerCase().includes(q);

      return matchesSearch;
    });
  }, [contacts, search]);

  const sortedContacts = useMemo(() => {
    const arr = [...filteredContacts];
    const { key, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      let av;
      let bv;

      switch (key) {
        case "name":
          av = normalizeString(a.name).toLowerCase();
          bv = normalizeString(b.name).toLowerCase();
          break;
        case "company":
          av = normalizeString(a.company).toLowerCase();
          bv = normalizeString(b.company).toLowerCase();
          break;
        case "role":
          av = normalizeString(a.role).toLowerCase();
          bv = normalizeString(b.role).toLowerCase();
          break;
        case "enquiries":
          av = Number(a.enquiries) || 0;
          bv = Number(b.enquiries) || 0;
          break;
        case "lastContact":
          av = a.lastContact ? new Date(a.lastContact).getTime() : 0;
          bv = b.lastContact ? new Date(b.lastContact).getTime() : 0;
          break;
        case "createdAt":
        default:
          av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
      }

      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });

    return arr;
  }, [filteredContacts, sort]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedContacts.length / CONTACTS_PER_PAGE)
  );
  const currentPage = Math.min(page, totalPages);

  const paginatedContacts = useMemo(
    () =>
      sortedContacts.slice(
        (currentPage - 1) * CONTACTS_PER_PAGE,
        currentPage * CONTACTS_PER_PAGE
      ),
    [sortedContacts, currentPage]
  );

  const pager = useMemo(
    () => buildPager(currentPage, totalPages),
    [currentPage, totalPages]
  );

  /* ---- KPI numbers ---- */
  const totalContacts = contacts.length;
  const totalCompanies = companies.length;
  const activeContacts = useMemo(
    () => contacts.filter((c) => c.status === "active").length,
    [contacts]
  );
  const recentlyContacted = useMemo(() => {
    const now = Date.now();
    return contacts.filter((c) => {
      if (!c.lastContact) return false;
      const t = new Date(c.lastContact).getTime();
      if (Number.isNaN(t)) return false;
      const days = (now - t) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7;
    }).length;
  }, [contacts]);

  /* ------------------------------------------------------------------ */
  /*  Effects                                                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    setPage(1);
  }, [search]);

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                           */
  /* ------------------------------------------------------------------ */
  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* GSTIN → always uppercase, no spaces */
  const handleGstinChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value.replace(/\s/g, "").toUpperCase(),
    }));
  };

  /* State → auto-fill the matching GST state code when it's a known state */
  const handleStateChange = (stateKey, codeKey) => (e) => {
    const value = e.target.value;
    const code = GST_STATES[value];
    setFormData((prev) => ({
      ...prev,
      [stateKey]: value,
      ...(code ? { [codeKey]: code } : {}),
    }));
  };

  const copyBillingToShipping = () => {
    setFormData((prev) => ({
      ...prev,
      shippingName: prev.shippingName || prev.name,
      shippingCompany: prev.shippingCompany || prev.company,
      shippingAddress: prev.billingAddress,
      shippingGstin: prev.gstin,
      shippingState: prev.state,
      shippingStateCode: prev.stateCode,
    }));
  };

  const handleMenuToggle = (e, contactId) => {
    if (openMenu === contactId) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuCoords({
      top: rect.bottom + 6, // 6px below the button
      right: window.innerWidth - rect.right, // align right edges
    });
    setOpenMenu(contactId);
  };

  const openCreateModal = () => {
    setEditingContact(null);
    setFormData(emptyForm()); // fresh object each time
    setShowModal(true);
    setOpenMenu(null);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || "",
      company: contact.company || "",
      role: ALLOWED_ROLES.includes(contact.role) ? contact.role : "other",
      email: contact.email || "",
      phone: contact.phone || "",
      status: contact.status || "active",

      billingAddress: contact.billingAddress || contact.address || "",
      gstin: contact.gstin || "",
      state: contact.state || "",
      stateCode: contact.stateCode || "",

      shippingName: contact.shippingName || "",
      shippingCompany: contact.shippingCompany || "",
      shippingAddress: contact.shippingAddress || contact.address || "",
      shippingGstin: contact.shippingGstin || "",
      shippingState: contact.shippingState || "",
      shippingStateCode: contact.shippingStateCode || "",
    });
    setOpenMenu(null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingContact(null);
    setFormData(emptyForm());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

   try {
      setSaving(true);

      const payload = { ...formData };

    if (editingContact) {
      await updateContact(editingContact._id, payload);
      toast.success("Contact updated successfully.");
    } else {
      await createContact(payload);
      toast.success("Contact created successfully.");
    }

    closeModal();
    await loadContacts();
  } catch (err) {
    toast.error(
      err?.response?.data?.message ||
        err?.message ||
        "Failed to save contact."
    );
  } finally {
    setSaving(false);
  }
  };

  const handleDelete = async (contact) => {
  const confirmed = await confirmToast(
    `Are you sure you want to delete ${contact.name || "this contact"}?`
  );
  if (!confirmed) return;

  try {
    await deleteContact(contact._id);
    toast.success("Contact deleted successfully.");
    setOpenMenu(null);
    await loadContacts();
  } catch (err) {
    toast.error(
      err?.response?.data?.message ||
        err?.message ||
        "Failed to delete contact."
    );
  }
};

  const resetFilters = () => {
    setSearch("");
    setPage(1);
  };

  const hasFilters = Boolean(search.trim());

  const fieldCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10 sm:text-sm";
  const areaCls =
    "w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10 sm:text-sm";
  const labelCls = "mb-1.5 block text-xs font-semibold text-slate-700";

  return (
    <div className="min-h-full bg-[#f5f7fa] px-4 py-6 sm:px-5 lg:px-7">
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

      {/* ---------- KPI CARDS ---------- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          tone="blue"
          value={loading ? "—" : totalContacts}
          label="Total Contacts"
        />
        <KpiCard
          icon={Building2}
          tone="violet"
          value={loading ? "—" : totalCompanies}
          label="Companies"
        />
        <KpiCard
          icon={UserCheck}
          tone="emerald"
          value={loading ? "—" : activeContacts}
          label="Active Contacts"
        />
        <KpiCard
          icon={Phone}
          tone="amber"
          value={loading ? "—" : recentlyContacted}
          label="Recently Contacted"
        />
      </div>

      {/* ---------- MAIN GRID ---------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 px-4 text-slate-400 transition focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm">
              <Search size={17} className="shrink-0" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400 sm:text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:text-sm"
            >
              <option>All Companies</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select> */}

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
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
              <tr className="border-b border-slate-100">
                <SortableHeader
                  label="Contact"
                  sortKey="name"
                  sort={sort}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Company"
                  sortKey="company"
                  sort={sort}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Role"
                  sortKey="role"
                  sort={sort}
                  onSort={handleSort}
                />
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Contact Details
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <SortableHeader
                  label="Enquiries"
                  sortKey="enquiries"
                  sort={sort}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Last Contact"
                  sortKey="lastContact"
                  sort={sort}
                  onSort={handleSort}
                />
                <th className="w-16 px-5 py-3" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8">
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
                  <td colSpan="8">
                    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Users size={21} />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">
                        No contacts found
                      </h3>
                      {hasFilters
                        ? "Try adjusting your search."
                        : "Create your first contact to start building your directory."}
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
                    {/* Contact */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#002244] text-xs font-bold text-white shadow-sm">
                          {getInitials(contact.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {contact.name || "Unnamed Contact"}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] font-medium text-slate-400">
                            {contact.contactId || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Building2 size={15} className="text-slate-400" />
                        <span className="truncate">
                          {contact.company || "—"}
                        </span>
                      </div>
                      {contact.gstin && (
                        <div className="mt-0.5 pl-[23px] font-mono text-[11px] text-slate-400">
                          GSTIN {contact.gstin}
                        </div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <RoleBadge role={contact.role} />
                    </td>

                    {/* Contact details */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            title={contact.email}
                            className="flex max-w-[220px] items-center gap-2 truncate text-xs font-medium text-slate-600 transition hover:text-[#002244]"
                          >
                            <Mail size={13} className="shrink-0 text-slate-400" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        )}

                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            title={contact.phone}
                            className="flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-[#002244]"
                          >
                            <Phone size={13} className="shrink-0 text-slate-400" />
                            <span>{contact.phone}</span>
                          </a>
                        )}

                        {(contact.shippingAddress || contact.address) && (
                          <div
                            className="flex max-w-[220px] items-start gap-2 text-xs text-slate-500"
                            title={contact.shippingAddress || contact.address}
                          >
                            <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                            <span className="truncate">
                              {contact.shippingAddress || contact.address}
                            </span>
                          </div>
                        )}

                        {!contact.email &&
                          !contact.phone &&
                          !contact.shippingAddress &&
                          !contact.address && (
                            <span className="text-xs text-slate-400">
                              No contact details
                            </span>
                          )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusPill status={contact.status} />
                    </td>

                    {/* Enquiries */}
                    <td className="px-5 py-4">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {contact.enquiries ?? 0}
                      </span>
                    </td>

                    {/* Last contact */}
                    <td className="px-5 py-4">
                      <span className="whitespace-nowrap text-sm text-slate-600">
                        {formatDate(contact.lastContact)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="inline-block">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleMenuToggle(e, contact._id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"
                          aria-label="Contact actions"
                          aria-haspopup="menu"
                          aria-expanded={openMenu === contact._id}
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {openMenu === contact._id && (
                          <div
                            ref={menuRef}
                            role="menu"
                            style={{
                              position: "fixed",
                              top: menuCoords.top,
                              right: menuCoords.right,
                            }}
                            className="z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl shadow-slate-200/60"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => openEditModal(contact)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil size={14} className="text-slate-400" />
                              Edit Contact
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => handleDelete(contact)}
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

        {/* Pagination */}
        {!loading && sortedContacts.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {(currentPage - 1) * CONTACTS_PER_PAGE + 1}
              </span>
              –
              <span className="font-semibold text-slate-700">
                {Math.min(
                  currentPage * CONTACTS_PER_PAGE,
                  sortedContacts.length
                )}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {sortedContacts.length}
              </span>{" "}
              contacts
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <div className="hidden items-center gap-1 sm:flex">
                {pager.map((p, i) =>
                  p === "…" ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-1 text-xs text-slate-400"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      aria-current={currentPage === p ? "page" : undefined}
                      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${
                        currentPage === p
                          ? "bg-[#002244] text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============ CREATE / EDIT MODAL ============ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#002244]/10 text-[#002244]">
                    {editingContact ? <Pencil size={15} /> : <Plus size={17} />}
                  </div>
                  <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">
                    {editingContact ? "Edit Contact" : "New Contact"}
                  </h2>
                </div>
                <p className="text-sm text-slate-500">
                  {editingContact
                    ? "Update the contact information below."
                    : "Add a new contact. Billing and shipping details fill in your invoices."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                {/* ---------- Basic info ---------- */}
                <FormSection icon={User} title="Contact information">
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <div>
                      <label className={labelCls}>
                        Contact Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="e.g. Rajesh Kumar"
                        required
                        className={fieldCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>
                        Company <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        placeholder="e.g. ABC Infrastructure"
                        required
                        className={fieldCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Role</label>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        className={fieldCls}
                      >
                        <option value="">— Select role —</option>
                        <option value="customer">Customer</option>
                        <option value="supplier">Supplier</option>
                        <option value="partner">Partner</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        inputMode="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="name@company.com"
                        required
                        className={fieldCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Phone Number</label>
                      <input
                        type="tel"
                        inputMode="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone: normalizePhone(e.target.value),
                          }))
                        }
                        placeholder="9876543210"
                        maxLength={10}
                        pattern="[6-9][0-9]{9}"
                        title="10-digit Indian mobile number starting with 6-9"
                        className={fieldCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Status</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className={fieldCls}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </FormSection>

                {/* ---------- Billing (invoice buyer) ---------- */}
                <FormSection
                  icon={Receipt}
                  title="Billing details"
                  hint="Used as the buyer on invoices"
                >
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Billing Address</label>
                      <textarea
                        name="billingAddress"
                        value={formData.billingAddress}
                        onChange={handleInputChange}
                        placeholder="Street, city, PIN"
                        rows={3}
                        className={areaCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>GSTIN</label>
                      <input
                        type="text"
                        name="gstin"
                        value={formData.gstin}
                        onChange={handleGstinChange}
                        placeholder="e.g. 07ABCDE1234F1Z5"
                        maxLength={15}
                        pattern={GSTIN_PATTERN}
                        title="15-character GSTIN, e.g. 07ABCDE1234F1Z5"
                        autoCapitalize="characters"
                        className={`${fieldCls} font-mono uppercase`}
                      />
                    </div>

                    <div className="grid grid-cols-[1fr_6rem] gap-3">
                      <div>
                        <label className={labelCls}>State</label>
                        <input
                          type="text"
                          name="state"
                          list="gst-states"
                          value={formData.state}
                          onChange={handleStateChange("state", "stateCode")}
                          placeholder="e.g. Delhi"
                          className={fieldCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>State Code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="stateCode"
                          value={formData.stateCode}
                          onChange={handleInputChange}
                          placeholder="07"
                          maxLength={2}
                          className={`${fieldCls} font-mono`}
                        />
                      </div>
                    </div>
                  </div>
                </FormSection>

                {/* ---------- Shipping (invoice consignee) ---------- */}
                <FormSection
                  icon={Truck}
                  title="Shipping details"
                  hint="Used as the consignee on invoices"
                  action={
                    <button
                      type="button"
                      onClick={copyBillingToShipping}
                      className="shrink-0 text-[11px] font-medium text-[#002244] hover:underline"
                    >
                      Same as billing
                    </button>
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <div>
                      <label className={labelCls}>Consignee Name</label>
                      <input
                        type="text"
                        name="shippingName"
                        value={formData.shippingName}
                        onChange={handleInputChange}
                        placeholder="Person receiving the goods"
                        className={fieldCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Consignee Company</label>
                      <input
                        type="text"
                        name="shippingCompany"
                        value={formData.shippingCompany}
                        onChange={handleInputChange}
                        placeholder="Company receiving the goods"
                        className={fieldCls}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>Shipping Address</label>
                      <textarea
                        name="shippingAddress"
                        value={formData.shippingAddress}
                        onChange={handleInputChange}
                        placeholder="Delivery / site address"
                        rows={3}
                        className={areaCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>GSTIN</label>
                      <input
                        type="text"
                        name="shippingGstin"
                        value={formData.shippingGstin}
                        onChange={handleGstinChange}
                        placeholder="e.g. 07ABCDE1234F1Z5"
                        maxLength={15}
                        pattern={GSTIN_PATTERN}
                        title="15-character GSTIN, e.g. 07ABCDE1234F1Z5"
                        autoCapitalize="characters"
                        className={`${fieldCls} font-mono uppercase`}
                      />
                    </div>

                    <div className="grid grid-cols-[1fr_6rem] gap-3">
                      <div>
                        <label className={labelCls}>State</label>
                        <input
                          type="text"
                          name="shippingState"
                          list="gst-states"
                          value={formData.shippingState}
                          onChange={handleStateChange(
                            "shippingState",
                            "shippingStateCode"
                          )}
                          placeholder="e.g. Delhi"
                          className={fieldCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>State Code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          name="shippingStateCode"
                          value={formData.shippingStateCode}
                          onChange={handleInputChange}
                          placeholder="07"
                          maxLength={2}
                          className={`${fieldCls} font-mono`}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-slate-500">
                    Leave shipping blank if it is the same as billing, or not
                    needed yet.
                  </p>
                </FormSection>

                {/* Shared suggestion list for both State inputs */}
                <datalist id="gst-states">
                  {Object.keys(GST_STATES).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Footer */}
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00345f] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : editingContact ? (
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

/* ------------------------------------------------------------------ */
/*  KPI card                                                           */
/* ------------------------------------------------------------------ */

const KPI_TONES = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  violet: { bg: "bg-violet-50", text: "text-violet-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
};

function KpiCard({ icon: Icon, tone, tag, value, label }) {
  const { bg, text } = KPI_TONES[tone] || KPI_TONES.blue;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-5 flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${text}`}
        >
          <Icon size={19} />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {tag}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default Contacts;