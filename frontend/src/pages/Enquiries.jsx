import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  UserRound,
  CalendarDays,
  RotateCcw,
  Download,
  Plus,
  X,
  IndianRupee,
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
  Clock3,
  BriefcaseBusiness,
  Trash2,
  RefreshCw,
  Eye,
  Save,
  Pencil,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

import {
  getEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
} from "../api/api";
import { toast } from "react-toastify";

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

const UNIT_OPTIONS = ["kg", "MT", "Bundle", "Coil", "Roll", "Nos"];

const GST_RATE = 0.09;

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

function createEmptyQuoteItem() {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    gauge: "",
    qty: "",
    unit: "kg",
    rate: "",
    discountPct: "0",
  };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const inputCls =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm";

function ModalField({ label, hint, required = false, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}
function threeDigitWords(n) {
  if (n < 100) return twoDigitWords(n);
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigitWords(n % 100) : "");
}
function numberToIndianWords(num) {
  if (num === 0) return "Zero";
  let n = Math.floor(num);
  let words = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  if (crore) words += threeDigitWords(crore) + " Crore ";
  if (lakh) words += threeDigitWords(lakh) + " Lakh ";
  if (thousand) words += threeDigitWords(thousand) + " Thousand ";
  if (hundred) words += threeDigitWords(hundred);
  return words.trim();
}
function amountInWords(value) {
  const rounded = Math.round(value || 0);
  if (rounded === 0) return "Zero Rupees Only";
  return `${numberToIndianWords(rounded)} Rupees Only`;
}

function formatDate(date) {
  if (!date) return "—";
  const v = new Date(date);
  if (Number.isNaN(v.getTime())) return date;
  return v.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatCurrency(value) {
  if (value === undefined || value === null || value === "") return "₹0";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}
function formatTimelineDate(date) {
  if (!date) return "—";
  const v = new Date(date);
  if (Number.isNaN(v.getTime())) return date;
  return v.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function getInitials(value) {
  if (!value || value === "—") return "?";
  return value.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
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
    createdAt: item.createdAt,
    phone: item.phone || "—",
    email: item.email || "—",
    projectRef: item.projectRef || "—",
    requirement: item.requirement || "No requirement notes added.",
    timeline: Array.isArray(item.timeline) ? item.timeline : [],
    raw: item,
  };
}

function buildPager(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
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
  product: "",
  quantity: "",
  estimatedValue: "",
  status: "New",
  priority: "Medium",
  source: "Website",
  assignedTo: "",
  assignedRole: "",
  requirement: "",
};

function EnquiryStatus({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "New"}
    </span>
  );
}

function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        PRIORITY_STYLES[priority] || PRIORITY_STYLES.Medium
      }`}
    >
      {priority}
    </span>
  );
}

function SortableHeader({ label, sortKey, sort, onSort, className = "", align = "left" }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-4 py-3 text-${align} text-[10px] font-bold uppercase tracking-wider text-slate-400 ${className}`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 transition hover:text-slate-700 ${
          active ? "text-slate-700" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon size={11} className={active ? "opacity-100" : "opacity-40"} />
      </button>
    </th>
  );
}

function confirmToast(message) {
  return new Promise((resolve) => {
    const id = toast.info(
      () => (
        <div className="w-full">
          <p className="mb-3 text-sm text-slate-700">{message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { resolve(false); toast.dismiss(id); }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { resolve(true); toast.dismiss(id); }}
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

  const [showNewModal, setShowNewModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingEnquiryId, setEditingEnquiryId] = useState(null);

  const [newEnquiry, setNewEnquiry] = useState(EMPTY_ENQUIRY);
  const [noteText, setNoteText] = useState("");

  /* ---- row actions menu ---- */
  const [openRowMenu, setOpenRowMenu] = useState(null);
  const [rowMenuCoords, setRowMenuCoords] = useState({ top: 0, right: 0 });
  const rowMenuRef = useRef(null);

  /* ---- density & sorting ---- */
  const [density, setDensity] = useState("standard");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });

  /* ---- quotation builder ---- */
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteMode, setQuoteMode] = useState("edit");
  const [quoteStatus, setQuoteStatus] = useState("Draft");
  const [quoteDate, setQuoteDate] = useState("");
  const [quoteValidTill, setQuoteValidTill] = useState("");
  const [quoteGstin, setQuoteGstin] = useState("");
  const [quoteAddress, setQuoteAddress] = useState("");
  const [quoteItems, setQuoteItems] = useState([createEmptyQuoteItem()]);
  const [quoteTerms, setQuoteTerms] = useState({
    payment: "50% advance, balance before dispatch",
    delivery: "7–10 working days from confirmation",
    freight: "Extra as per actuals",
    validity: "15 days from quote date",
    notes: "",
  });

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */
  const loadEnquiries = async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "All Statuses") params.status = statusFilter;
      if (sourceFilter !== "All Sources") params.source = sourceFilter;

      const response = await getEnquiries(params);
      const data = response?.data?.data || [];
      const mapped = data.map(mapEnquiry);

      setEnquiries(mapped);
      setTotal(response?.data?.total || 0);
      setPages(response?.data?.pages || 1);

      if (selectedId) {
        const stillExists = mapped.some((it) => it.id === selectedId);
        if (!stillExists) setSelectedId(null);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Failed to load enquiries. Make sure your backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, sourceFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else loadEnquiries();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!openRowMenu) return;
    const onDoc = (e) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target)) {
        setOpenRowMenu(null);
      }
    };
    const onScroll = () => setOpenRowMenu(null);
    const onResize = () => setOpenRowMenu(null);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [openRowMenu]);

  const selectedEnquiry = useMemo(
    () => enquiries.find((it) => it.id === selectedId) || null,
    [enquiries, selectedId]
  );

  const sortedEnquiries = useMemo(() => {
    const arr = [...enquiries];
    const { key, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av, bv;
      switch (key) {
        case "id":
          av = a.id || ""; bv = b.id || ""; break;
        case "customer":
          av = (a.customer || "").toLowerCase(); bv = (b.customer || "").toLowerCase(); break;
        case "company":
          av = (a.company || "").toLowerCase(); bv = (b.company || "").toLowerCase(); break;
        case "product":
          av = (a.product || "").toLowerCase(); bv = (b.product || "").toLowerCase(); break;
        case "value":
          av = Number(a.estimatedValue) || 0; bv = Number(b.estimatedValue) || 0; break;
        case "priority": {
          const order = { Low: 1, Medium: 2, High: 3 };
          av = order[a.priority] || 0; bv = order[b.priority] || 0; break;
        }
        case "status":
          av = (a.status || "").toLowerCase(); bv = (b.status || "").toLowerCase(); break;
        case "createdAt":
        default:
          av = new Date(a.createdAt || 0).getTime();
          bv = new Date(b.createdAt || 0).getTime();
          break;
      }
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });
    return arr;
  }, [enquiries, sort]);

  const stats = useMemo(() => ({
    newCount: enquiries.filter((i) => i.status === "New").length,
    progressCount: enquiries.filter(
      (i) => i.status === "In Progress" || i.status === "In Discussion"
    ).length,
    convertedCount: enquiries.filter((i) => i.status === "Converted").length,
    totalValue: enquiries.reduce((sum, i) => sum + (Number(i.estimatedValue) || 0), 0),
  }), [enquiries]);

  const pager = useMemo(() => buildPager(page, pages), [page, pages]);

  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const handleRowMenuToggle = (e, enquiryId) => {
    if (openRowMenu === enquiryId) {
      setOpenRowMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setRowMenuCoords({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
    setOpenRowMenu(enquiryId);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All Statuses");
    setSourceFilter("All Sources");
    setDateFilter(false);
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingEnquiryId(null);
    setNewEnquiry(EMPTY_ENQUIRY);
    setShowNewModal(true);
  };

  const openEditModal = (enquiry) => {
    setEditingEnquiryId(enquiry.mongoId);
    setNewEnquiry({
      customerName: enquiry.customer === "—" ? "" : enquiry.customer,
      customerRole: enquiry.role === "—" ? "" : enquiry.role,
      company: enquiry.company === "—" ? "" : enquiry.company,
      phone: enquiry.phone === "—" ? "" : enquiry.phone,
      email: enquiry.email === "—" ? "" : enquiry.email,
      project: enquiry.project === "—" ? "" : enquiry.project,
      location: enquiry.location === "—" ? "" : enquiry.location,
      projectRef: enquiry.projectRef === "—" ? "" : enquiry.projectRef,
      product: enquiry.product === "—" ? "" : enquiry.product,
      quantity: enquiry.quantity === "—" ? "" : enquiry.quantity,
      estimatedValue: enquiry.estimatedValue ?? "",
      status: enquiry.status || "New",
      priority: enquiry.priority || "Medium",
      source: enquiry.source || "Website",
      assignedTo: enquiry.assigned === "Unassigned" ? "" : enquiry.assigned,
      assignedRole: enquiry.assignedRole || "",
      requirement: enquiry.requirement === "No requirement notes added." ? "" : enquiry.requirement,
    });
    setOpenRowMenu(null);
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    if (saving) return;
    setShowNewModal(false);
    setEditingEnquiryId(null);
    setNewEnquiry(EMPTY_ENQUIRY);
  };

  const handleCreateEnquiry = async () => {
    if (!newEnquiry.customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...newEnquiry,
        estimatedValue:
          newEnquiry.estimatedValue === "" ? 0 : Number(newEnquiry.estimatedValue),
      };

      if (editingEnquiryId) {
        await updateEnquiry(editingEnquiryId, payload);
        toast.success("Enquiry updated successfully.");
        setShowNewModal(false);
        setEditingEnquiryId(null);
        setNewEnquiry(EMPTY_ENQUIRY);
        await loadEnquiries();
      } else {
        const response = await createEnquiry(payload);
        toast.success("Enquiry created successfully.");
        const created = response?.data?.data;
        setShowNewModal(false);
        setNewEnquiry(EMPTY_ENQUIRY);
        await loadEnquiries();
        if (created?.enquiryNumber) setSelectedId(created.enquiryNumber);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save enquiry.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedEnquiry?.mongoId) return;
    try {
      setSaving(true);
      await updateEnquiry(selectedEnquiry.mongoId, { status: newStatus });
      await loadEnquiries();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update enquiry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEnquiry = async (enquiry = null) => {
    const target = enquiry || selectedEnquiry;
    if (!target?.mongoId) return;

    const confirmed = await confirmToast(
      `Are you sure you want to delete ${target.id}?`
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      await deleteEnquiry(target.mongoId);
      toast.success("Enquiry deleted.");
      setOpenRowMenu(null);
      if (selectedEnquiry?.mongoId === target.mongoId) setSelectedId(null);
      await loadEnquiries();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete enquiry.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedEnquiry?.mongoId) return;
    if (!noteText.trim()) {
      toast.error("Please enter a note.");
      return;
    }
    try {
      setSaving(true);

      const res = await fetch(`/api/enquiries/${selectedEnquiry.mongoId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText.trim(), createdBy: "System" }),
      });

      if (!res.ok) throw new Error("Failed to add note");
      toast.success("Note added.");
      setNoteText("");
      setShowNoteModal(false);

      const enquiryResponse = await getEnquiryById(selectedEnquiry.mongoId);
      const updated = mapEnquiry(enquiryResponse.data.data);
      setEnquiries((cur) =>
        cur.map((it) => (it.mongoId === updated.mongoId ? updated : it))
      );
    } catch (err) {
      toast.error("Failed to add note.");
    } finally {
      setSaving(false);
    }
  };

  const exportEnquiries = () => {
    if (!enquiries.length) {
      toast.error("There are no enquiries to export.");
      return;
    }
    const headers = [
      "Enquiry ID", "Customer", "Company", "Project", "Location", "Product",
      "Quantity", "Estimated Value", "Status", "Priority", "Source",
      "Assigned To", "Created",
    ];
    const rows = enquiries.map((item) => [
      item.id, item.customer, item.company, item.project, item.location,
      item.product, item.quantity, item.estimatedValue, item.status,
      item.priority, item.source, item.assigned, item.created,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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

  const closeDetailModal = () => setSelectedId(null);

  /* ------------------------------------------------------------------ */
  /*  Quotation builder                                                  */
  /* ------------------------------------------------------------------ */
  const quoteNumber = selectedEnquiry ? `QT-${selectedEnquiry.id}` : "QT-DRAFT";

  const quoteComputed = useMemo(() => {
    const rows = quoteItems.map((item) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      const discountPct = Number(item.discountPct) || 0;
      const lineBase = qty * rate;
      const lineDiscount = lineBase * (discountPct / 100);
      const lineTotal = lineBase - lineDiscount;
      return { ...item, lineBase, lineDiscount, lineTotal };
    });
    const subtotal = rows.reduce((s, r) => s + r.lineBase, 0);
    const discountTotal = rows.reduce((s, r) => s + r.lineDiscount, 0);
    const taxable = subtotal - discountTotal;
    const cgst = taxable * GST_RATE;
    const sgst = taxable * GST_RATE;
    const rawTotal = taxable + cgst + sgst;
    const grandTotal = Math.round(rawTotal);
    const roundOff = grandTotal - rawTotal;
    return { rows, subtotal, discountTotal, taxable, cgst, sgst, roundOff, grandTotal };
  }, [quoteItems]);

  const openQuoteModal = (enquiry = null) => {
    const target = enquiry || selectedEnquiry;
    if (!target) return;
    if (enquiry) setSelectedId(enquiry.id);

    const today = new Date();
    const validTill = new Date();
    validTill.setDate(validTill.getDate() + 15);

    setQuoteStatus("Draft");
    setQuoteMode("edit");
    setQuoteDate(today.toISOString().split("T")[0]);
    setQuoteValidTill(validTill.toISOString().split("T")[0]);
    setQuoteGstin("");
    setQuoteAddress(target.location !== "—" ? target.location : "");
    setQuoteItems([
      {
        ...createEmptyQuoteItem(),
        description: target.product !== "—" ? target.product : "",
      },
    ]);
    setQuoteTerms({
      payment: "50% advance, balance before dispatch",
      delivery: "7–10 working days from confirmation",
      freight: "Extra as per actuals",
      validity: "15 days from quote date",
      notes: "",
    });
    setOpenRowMenu(null);
    setShowQuoteModal(true);
  };

  const closeQuoteModal = () => setShowQuoteModal(false);

  const updateQuoteItem = (id, field, value) =>
    setQuoteItems((cur) => cur.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  const addQuoteItem = () => setQuoteItems((cur) => [...cur, createEmptyQuoteItem()]);
  const removeQuoteItem = (id) =>
    setQuoteItems((cur) => (cur.length > 1 ? cur.filter((it) => it.id !== id) : cur));

  const handleSaveQuoteDraft = () => {
    setQuoteStatus("Draft");
    toast.success("Quotation saved as draft.");
  };

  const handleSendQuote = () => {
    if (!quoteItems.some((it) => it.description.trim() && Number(it.qty) > 0)) {
      toast.error("Add at least one item with a quantity before sending.");
      return;
    }
    setQuoteStatus("Sent");
    toast.success("Quotation marked as sent.");
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
  const isCompact = density === "compact";

  return (
    <div className="w-full space-y-5">
      {/* HEADER */}
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
            onClick={openCreateModal}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00345f]"
          >
            <Plus size={16} />
            New enquiry
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total enquiries"
          value={total}
          meta="Active records"
          icon={ClipboardList}
          iconClass="bg-slate-100 text-slate-600"
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
        <StatCard
          label="Pipeline value"
          value={formatCurrency(stats.totalValue)}
          meta="Current page"
          icon={IndianRupee}
          iconClass="bg-blue-50 text-blue-600"
        />
      </div>

      {/* FILTERS */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search enquiry, customer, project or product..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#315b89] focus:bg-white focus:ring-3 focus:ring-blue-50"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#315b89]"
          >
            <option>All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#315b89]"
          >
            <option>All Sources</option>
            {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>

          <button
            type="button"
            onClick={() => setDateFilter((v) => !v)}
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

      {/* MAIN GRID */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Enquiry queue</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {total}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Click an enquiry to view its details, or use ⋯ for quick actions.
            </p>
          </div>

          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setDensity("standard")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                density === "standard"
                  ? "bg-white text-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                density === "compact"
                  ? "bg-white text-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={loadEnquiries}
              className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-600"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full min-w-[900px] border-collapse">
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={10} className="px-5 py-4">
                      <div className="h-4 w-full max-w-[900px] animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : sortedEnquiries.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <Search size={20} />
              </div>
              <h4 className="text-sm font-semibold text-slate-700">No enquiries found</h4>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                Try changing your search or filters, or create a new enquiry.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#002244] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#00345f]"
              >
                <Plus size={14} />
                New enquiry
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <SortableHeader label="Enquiry" sortKey="id" sort={sort} onSort={handleSort} className="pl-5" />
                  <SortableHeader label="Customer" sortKey="customer" sort={sort} onSort={handleSort} />
                  {!isCompact && (
                    <SortableHeader label="Company" sortKey="company" sort={sort} onSort={handleSort} />
                  )}
                  {!isCompact && <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Project</th>}
                  <SortableHeader label="Product" sortKey="product" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Value" sortKey="value" sort={sort} onSort={handleSort} align="right" />
                  {!isCompact && (
                    <SortableHeader label="Priority" sortKey="priority" sort={sort} onSort={handleSort} />
                  )}
                  <SortableHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                  {!isCompact && (
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned</th>
                  )}
                  <th className="w-14 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedEnquiries.map((item) => {
                  const selected = selectedId === item.id;
                  const rowPad = isCompact ? "py-2.5" : "py-4";
                  return (
                    <tr
                      key={item.mongoId}
                      onClick={() => setSelectedId(item.id)}
                      className={`cursor-pointer transition ${
                        selected ? "bg-blue-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className={`px-5 ${rowPad}`}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              selected ? "bg-[#002244] text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {getInitials(item.id)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold text-[#315b89]">
                              {item.id}
                            </span>
                            <div className="mt-0.5 whitespace-nowrap text-[11px] text-slate-400">
                              {item.created}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className={`px-4 ${rowPad}`}>
                        <div className="max-w-[180px]">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {item.customer}
                          </div>
                          {!isCompact && (
                            <div className="mt-0.5 truncate text-xs text-slate-400">
                              {item.role}
                            </div>
                          )}
                        </div>
                      </td>

                      {!isCompact && (
                        <td className={`px-4 ${rowPad}`}>
                          <div className="flex max-w-[150px] items-center gap-2">
                            <Building2 size={14} className="shrink-0 text-slate-400" />
                            <span className="truncate text-sm text-slate-600">{item.company}</span>
                          </div>
                        </td>
                      )}

                      <td className={`px-4 ${rowPad}`}>
                        <div className="max-w-[140px] truncate text-sm text-slate-600">
                          {item.product}
                        </div>
                      </td>

                      <td className={`px-4 ${rowPad} text-right`}>
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-800">
                          {item.value}
                        </span>
                      </td>

                      {!isCompact && (
                        <td className={`px-4 ${rowPad}`}>
                          <PriorityBadge priority={item.priority} />
                        </td>
                      )}

                      <td className={`px-4 ${rowPad}`}>
                        <EnquiryStatus status={item.status} />
                      </td>

                      {!isCompact && (
                        <td className={`px-4 ${rowPad}`}>
                          <div className="flex max-w-[160px] items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">
                              {getInitials(item.assigned)}
                            </div>
                            <span className="truncate text-xs text-slate-600">
                              {item.assigned}
                            </span>
                          </div>
                        </td>
                      )}

                      <td className={`px-4 ${rowPad} text-right`}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowMenuToggle(e, item.mongoId);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Enquiry actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>
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
            of <strong className="font-semibold text-slate-700">{total}</strong>
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

            {pager.map((p, i) =>
              p === "…" ? (
                <span key={`e-${i}`} className="px-1 text-xs text-slate-400">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition ${
                    page === p
                      ? "bg-[#002244] text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              )
            )}

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

      {/* ROW ACTIONS MENU */}
      {openRowMenu && (
        <div
          ref={rowMenuRef}
          role="menu"
          style={{ position: "fixed", top: rowMenuCoords.top, right: rowMenuCoords.right }}
          className="z-[60] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl shadow-slate-200/60"
        >
          {(() => {
            const target = enquiries.find((e) => e.mongoId === openRowMenu);
            if (!target) return null;
            return (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => { setSelectedId(target.id); setOpenRowMenu(null); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Eye size={14} className="text-slate-400" />
                  View details
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => openEditModal(target)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={14} className="text-slate-400" />
                  Edit enquiry
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => openQuoteModal(target)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Send size={14} className="text-slate-400" />
                  Generate quote
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => handleDeleteEnquiry(target)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* DETAILS MODAL */}
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
                  <span className="font-mono text-xs font-bold text-[#315b89]">{selectedEnquiry.id}</span>
                  <EnquiryStatus status={selectedEnquiry.status} />
                </div>
                <h2 className="text-base font-bold text-slate-900">Enquiry details</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Created {selectedEnquiry.created} · {selectedEnquiry.source}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close"
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
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400">Quantity</span>
                          <strong className="text-sm text-slate-700">
                            {selectedEnquiry.quantity || "Not specified"}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide text-slate-400">Estimated value</span>
                          <strong className="flex items-center gap-1 text-sm text-slate-700">
                            <IndianRupee size={13} className="text-emerald-500" />
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
                    <ContactLine icon={Building2} value={selectedEnquiry.company} />
                    <ContactLine icon={Phone} value={selectedEnquiry.phone} />
                    <ContactLine icon={Mail} value={selectedEnquiry.email} />
                    <ContactLine icon={FileText} value={`Project: ${selectedEnquiry.projectRef}`} />
                  </div>
                </DetailSection>

                <DetailSection title="Project information">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoItem label="Project" value={selectedEnquiry.project} />
                    <InfoItem label="Location" value={selectedEnquiry.location} />
                    <InfoItem label="Source" value={selectedEnquiry.source} />
                    <InfoItem
                      label="Priority"
                      value={<PriorityBadge priority={selectedEnquiry.priority} />}
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
                        {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
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
                        <div key={index} className="relative flex gap-3 pb-4 last:pb-0">
                          <div className="relative flex w-4 shrink-0 justify-center">
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-[#315b89] ring-4 ring-blue-50" />
                            {index !== selectedEnquiry.timeline.length - 1 && (
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
                    <p className="text-xs text-slate-400">No activity recorded yet.</p>
                  )}
                </DetailSection>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                onClick={() => { closeDetailModal(); openEditModal(selectedEnquiry); }}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => openQuoteModal(selectedEnquiry)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#002244] px-3 text-xs font-semibold text-white transition hover:bg-[#00345f]"
              >
                <Send size={14} />
                Generate quote
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleDeleteEnquiry(selectedEnquiry)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title="Delete enquiry"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => !saving && closeNewModal()}
        >
          <div
            className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#002244]">
                  {editingEnquiryId ? (
                    <Pencil size={17} className="text-white" />
                  ) : (
                    <Plus size={18} className="text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold tracking-tight text-slate-900">
                    {editingEnquiryId ? "Edit enquiry" : "New enquiry"}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {editingEnquiryId
                      ? "Update the enquiry details below."
                      : "Capture a new customer or project enquiry."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={closeNewModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <UserRound size={15} className="text-[#002244]" />
                    <h4 className="text-sm font-semibold text-slate-900">Customer</h4>
                    <span className="text-[11px] font-normal text-slate-400">
                      Primary contact details
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <ModalField label="Customer name" required>
                        <input
                          className={inputCls}
                          value={newEnquiry.customerName}
                          onChange={(e) =>
                            setNewEnquiry({ ...newEnquiry, customerName: e.target.value })
                          }
                          placeholder="e.g. Rajesh Kumar"
                          autoFocus
                        />
                      </ModalField>
                    </div>

                    <ModalField label="Role / designation">
                      <input
                        className={inputCls}
                        value={newEnquiry.customerRole}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, customerRole: e.target.value })
                        }
                        placeholder="e.g. Procurement Head"
                      />
                    </ModalField>

                    <ModalField label="Company">
                      <input
                        className={inputCls}
                        value={newEnquiry.company}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, company: e.target.value })
                        }
                        placeholder="e.g. ABC Infrastructure Ltd."
                      />
                    </ModalField>

                    <ModalField label="Phone">
                      <input
                        className={inputCls}
                        type="tel"
                        inputMode="tel"
                        value={newEnquiry.phone}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, phone: e.target.value })
                        }
                        placeholder="+91 98765 43210"
                      />
                    </ModalField>

                    <ModalField label="Email">
                      <input
                        className={inputCls}
                        type="email"
                        inputMode="email"
                        value={newEnquiry.email}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, email: e.target.value })
                        }
                        placeholder="customer@company.com"
                      />
                    </ModalField>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <BriefcaseBusiness size={15} className="text-[#002244]" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Requirement
                    </h4>
                    <span className="text-[11px] font-normal text-slate-400">
                      What the customer needs
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
                    <ModalField
                      label="Product"
                      hint="e.g. GI Wire, Barbed Wire, Concertina Wire…"
                    >
                      <input
                        className={inputCls}
                        value={newEnquiry.product}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, product: e.target.value })
                        }
                        placeholder="Enter product name"
                      />
                    </ModalField>

                    <ModalField label="Quantity">
                      <input
                        className={inputCls}
                        value={newEnquiry.quantity}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, quantity: e.target.value })
                        }
                        placeholder="e.g. 2,500 Kg"
                      />
                    </ModalField>

                    <div className="sm:col-span-2">
                      <ModalField
                        label="Estimated value (₹)"
                        hint="Rough deal size at this stage"
                      >
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                            ₹
                          </span>
                          <input
                            className={`${inputCls} pl-8`}
                            type="number"
                            inputMode="decimal"
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
                        </div>
                      </ModalField>
                    </div>

                    <div className="sm:col-span-2">
                      <ModalField
                        label="Requirement notes"
                        hint="Material specs, gauge, delivery expectations…"
                      >
                        <textarea
                          className={`${inputCls} min-h-[110px] resize-y py-2.5`}
                          value={newEnquiry.requirement}
                          onChange={(e) =>
                            setNewEnquiry({ ...newEnquiry, requirement: e.target.value })
                          }
                          placeholder="Describe the customer's requirement in detail…"
                        />
                      </ModalField>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <IndianRupee size={15} className="text-[#002244]" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Sales &amp; assignment
                    </h4>
                    <span className="text-[11px] font-normal text-slate-400">
                      Pipeline tracking
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
                    <ModalField label="Source">
                      <select
                        className={inputCls}
                        value={newEnquiry.source}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, source: e.target.value })
                        }
                      >
                        {SOURCE_OPTIONS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </ModalField>

                    <ModalField label="Priority">
                      <select
                        className={inputCls}
                        value={newEnquiry.priority}
                        onChange={(e) =>
                          setNewEnquiry({ ...newEnquiry, priority: e.target.value })
                        }
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </ModalField>

                    {editingEnquiryId && (
                      <ModalField label="Status">
                        <select
                          className={inputCls}
                          value={newEnquiry.status}
                          onChange={(e) =>
                            setNewEnquiry({ ...newEnquiry, status: e.target.value })
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </ModalField>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <p className="hidden text-xs text-slate-500 sm:block">
                {editingEnquiryId
                  ? "Changes save immediately."
                  : "You can edit these details later."}
              </p>

              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeNewModal}
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 sm:flex-none"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCreateEnquiry}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#002244] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00345f] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      {editingEnquiryId ? "Updating…" : "Creating…"}
                    </>
                  ) : editingEnquiryId ? (
                    <>
                      <Save size={15} />
                      Save changes
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create enquiry
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTE MODAL */}
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
                <h3 className="text-base font-bold text-slate-900">Add timeline note</h3>
                <p className="mt-1 text-xs text-slate-400">Add activity to {selectedEnquiry.id}.</p>
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

      {/* QUOTATION MODAL */}
      {showQuoteModal && selectedEnquiry && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"
          onClick={closeQuoteModal}
        >
          <div
            className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">New Quotation</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      quoteStatus === "Sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {quoteStatus}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-slate-400">
                  {quoteNumber} · Linked to {selectedEnquiry.id} · {selectedEnquiry.customer}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuoteMode((m) => (m === "edit" ? "preview" : "edit"))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                >
                  <Eye size={14} />
                  {quoteMode === "edit" ? "Preview" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuoteDraft}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                >
                  <Save size={14} />
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={handleSendQuote}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#002244] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00345f]"
                >
                  <Send size={14} />
                  Send
                </button>
                <button
                  type="button"
                  onClick={closeQuoteModal}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close quotation"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {quoteMode === "edit" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="text-xs font-semibold text-slate-500">Bill to</h3>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#002244] text-xs font-bold text-white">
                          {getInitials(selectedEnquiry.customer)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {selectedEnquiry.customer}
                          </div>
                          <div className="truncate text-xs text-slate-400">
                            {selectedEnquiry.company}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField label="GSTIN">
                          <input
                            className="form-input"
                            value={quoteGstin}
                            onChange={(e) => setQuoteGstin(e.target.value)}
                            placeholder="22AAAAA0000A1Z5"
                          />
                        </FormField>
                        <FormField label="Address">
                          <input
                            className="form-input"
                            value={quoteAddress}
                            onChange={(e) => setQuoteAddress(e.target.value)}
                            placeholder="City, State"
                          />
                        </FormField>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="text-xs font-semibold text-slate-500">Quote details</h3>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                        <span>Quote number</span>
                        <span className="font-mono font-semibold text-slate-700">{quoteNumber}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField label="Quote date" required>
                          <input
                            type="date"
                            className="form-input"
                            value={quoteDate}
                            onChange={(e) => setQuoteDate(e.target.value)}
                          />
                        </FormField>
                        <FormField label="Valid till" required>
                          <input
                            type="date"
                            className="form-input"
                            value={quoteValidTill}
                            onChange={(e) => setQuoteValidTill(e.target.value)}
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-500">Items</h3>
                    </div>
                    <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                        <colgroup>
                          <col />
                          <col className="w-20" />
                          <col className="w-16" />
                          <col className="w-24" />
                          <col className="w-28" />
                          <col className="w-20" />
                          <col className="w-32" />
                          <col className="w-10" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/60">
                            <th className="px-3 py-2.5 text-xs font-medium text-slate-500">Description</th>
                            <th className="px-2 py-2.5 text-xs font-medium text-slate-500">Gauge</th>
                            <th className="px-2 py-2.5 text-xs font-medium text-slate-500">Qty</th>
                            <th className="px-2 py-2.5 text-xs font-medium text-slate-500">Unit</th>
                            <th className="px-2 py-2.5 text-right text-xs font-medium text-slate-500">Rate</th>
                            <th className="px-2 py-2.5 text-right text-xs font-medium text-slate-500">Disc %</th>
                            <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">Total</th>
                            <th className="px-2 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {quoteComputed.rows.map((row) => (
                            <tr key={row.id}>
                              <td className="px-3 py-2">
                                <input
                                  className="form-input"
                                  value={row.description}
                                  onChange={(e) => updateQuoteItem(row.id, "description", e.target.value)}
                                  placeholder="GI Wire, Barbed Wire..."
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  className="form-input"
                                  value={row.gauge}
                                  onChange={(e) => updateQuoteItem(row.id, "gauge", e.target.value)}
                                  placeholder="12"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input"
                                  value={row.qty}
                                  onChange={(e) => updateQuoteItem(row.id, "qty", e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <select
                                  className="form-input"
                                  value={row.unit}
                                  onChange={(e) => updateQuoteItem(row.id, "unit", e.target.value)}
                                >
                                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input text-right"
                                  value={row.rate}
                                  onChange={(e) => updateQuoteItem(row.id, "rate", e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="form-input text-right"
                                  value={row.discountPct}
                                  onChange={(e) => updateQuoteItem(row.id, "discountPct", e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-800">
                                {formatCurrency(row.lineTotal)}
                              </td>
                              <td className="px-2 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeQuoteItem(row.id)}
                                  disabled={quoteItems.length === 1}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={addQuoteItem}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#315b89] hover:underline"
                    >
                      <Plus size={13} />
                      Add item
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <div className="w-full max-w-sm space-y-1.5 rounded-lg border border-slate-200 p-4">
                      <TotalRow label="Subtotal" value={formatCurrency(quoteComputed.subtotal)} />
                      <TotalRow label="Discount" value={`- ${formatCurrency(quoteComputed.discountTotal)}`} />
                      <TotalRow label="Taxable" value={formatCurrency(quoteComputed.taxable)} />
                      <TotalRow label="CGST 9%" value={formatCurrency(quoteComputed.cgst)} />
                      <TotalRow label="SGST 9%" value={formatCurrency(quoteComputed.sgst)} />
                      <TotalRow label="Round off" value={formatCurrency(quoteComputed.roundOff)} />
                      <div className="my-1.5 border-t border-slate-200" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">Grand total</span>
                        <span className="text-base font-bold tabular-nums text-slate-900">
                          {formatCurrency(quoteComputed.grandTotal)}
                        </span>
                      </div>
                      <p className="pt-1 text-right text-[11px] italic text-slate-400">
                        {amountInWords(quoteComputed.grandTotal)}
                      </p>
                    </div>
                  </div>

                  <DetailSection title="Terms & conditions">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Payment">
                        <input
                          className="form-input"
                          value={quoteTerms.payment}
                          onChange={(e) => setQuoteTerms({ ...quoteTerms, payment: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Delivery">
                        <input
                          className="form-input"
                          value={quoteTerms.delivery}
                          onChange={(e) => setQuoteTerms({ ...quoteTerms, delivery: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Freight">
                        <input
                          className="form-input"
                          value={quoteTerms.freight}
                          onChange={(e) => setQuoteTerms({ ...quoteTerms, freight: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Validity">
                        <input
                          className="form-input"
                          value={quoteTerms.validity}
                          onChange={(e) => setQuoteTerms({ ...quoteTerms, validity: e.target.value })}
                        />
                      </FormField>
                    </div>
                    <div className="mt-3">
                      <FormField label="Notes">
                        <textarea
                          className="form-input min-h-[70px] resize-y py-2.5"
                          value={quoteTerms.notes}
                          onChange={(e) => setQuoteTerms({ ...quoteTerms, notes: e.target.value })}
                          placeholder="Any additional notes for the customer..."
                        />
                      </FormField>
                    </div>
                  </DetailSection>
                </div>
              ) : (
                <QuotePreview
                  quoteNumber={quoteNumber}
                  quoteDate={quoteDate}
                  quoteValidTill={quoteValidTill}
                  quoteGstin={quoteGstin}
                  quoteAddress={quoteAddress}
                  enquiry={selectedEnquiry}
                  computed={quoteComputed}
                  terms={quoteTerms}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small presentational components                                    */
/* ------------------------------------------------------------------ */

function TotalRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>{label}</span>
      <span className="tabular-nums text-slate-700">{value}</span>
    </div>
  );
}

function QuotePreview({
  quoteNumber, quoteDate, quoteValidTill, quoteGstin, quoteAddress,
  enquiry, computed, terms,
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-8 text-sm">
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Quotation</h2>
          <p className="mt-1 font-mono text-xs text-slate-400">{quoteNumber}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Date: {formatDate(quoteDate)}</div>
          <div>Valid till: {formatDate(quoteValidTill)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bill to</p>
          <p className="mt-1 font-semibold text-slate-800">{enquiry.customer}</p>
          <p className="text-xs text-slate-500">{enquiry.company}</p>
          {quoteAddress && <p className="text-xs text-slate-500">{quoteAddress}</p>}
          {quoteGstin && <p className="mt-1 text-xs text-slate-500">GSTIN: {quoteGstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reference</p>
          <p className="mt-1 text-xs text-slate-500">Enquiry {enquiry.id}</p>
          <p className="text-xs text-slate-500">{enquiry.project}</p>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-300 text-slate-500">
            <th className="py-2 text-left font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Rate</th>
            <th className="py-2 text-right font-medium">Disc</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {computed.rows.map((row) => (
            <tr key={row.id}>
              <td className="py-2 text-slate-700">
                {row.description || "—"}
                {row.gauge && <span className="text-slate-400"> · Gauge {row.gauge}</span>}
              </td>
              <td className="py-2 text-right tabular-nums text-slate-600">
                {row.qty || 0} {row.unit}
              </td>
              <td className="py-2 text-right tabular-nums text-slate-600">{formatCurrency(row.rate)}</td>
              <td className="py-2 text-right tabular-nums text-slate-600">{row.discountPct || 0}%</td>
              <td className="py-2 text-right tabular-nums font-medium text-slate-800">
                {formatCurrency(row.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-56 space-y-1 text-xs">
          <TotalRow label="Subtotal" value={formatCurrency(computed.subtotal)} />
          <TotalRow label="Discount" value={`- ${formatCurrency(computed.discountTotal)}`} />
          <TotalRow label="CGST 9%" value={formatCurrency(computed.cgst)} />
          <TotalRow label="SGST 9%" value={formatCurrency(computed.sgst)} />
          <TotalRow label="Round off" value={formatCurrency(computed.roundOff)} />
          <div className="my-1 border-t border-slate-300" />
          <div className="flex items-center justify-between text-sm font-bold text-slate-900">
            <span>Grand total</span>
            <span className="tabular-nums">{formatCurrency(computed.grandTotal)}</span>
          </div>
        </div>
      </div>

      <p className="mt-1 text-right text-[11px] italic text-slate-400">
        {amountInWords(computed.grandTotal)}
      </p>

      <div className="mt-6 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500">
        <p><strong className="text-slate-600">Payment:</strong> {terms.payment || "—"}</p>
        <p><strong className="text-slate-600">Delivery:</strong> {terms.delivery || "—"}</p>
        <p><strong className="text-slate-600">Freight:</strong> {terms.freight || "—"}</p>
        <p><strong className="text-slate-600">Validity:</strong> {terms.validity || "—"}</p>
        {terms.notes && (
          <p className="mt-2"><strong className="text-slate-600">Notes:</strong> {terms.notes}</p>
        )}
      </div>

      <p className="mt-6 text-center text-[11px] text-slate-400">
        Thank you for the opportunity to quote.
      </p>
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
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
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
      <div className="mt-1 truncate text-xs font-medium text-slate-700">{value}</div>
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