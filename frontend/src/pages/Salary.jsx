import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, X, CheckCircle2, Clock3, Split, Wallet,
  CreditCard, Smartphone, FileText, Inbox, HandCoins, ReceiptText, Merge,
  ChevronLeft, ChevronRight, Info, AlertTriangle, Loader2, Banknote,
  IndianRupee, TrendingUp, Users, CircleDollarSign,
} from "lucide-react";
import {
  getSalaries, getSalaryById, createSalary, updateSalary, deleteSalary,
  recordSalaryPayment, recordSalaryAdvance, deleteSalaryAdvance,
  getWorkers, generateSalaries,
} from "../api/api";
import DateFilter from "../components/DateFilter";

const INPUT = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10 disabled:bg-slate-50 disabled:text-slate-500";
const TEXTAREA = "min-h-[64px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10";
const BTN = "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a1e3f]/30 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = `${BTN} bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white shadow-sm hover:from-[#0a1e3f] hover:to-[#06142b]`;
const SECONDARY = `${BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const DANGER = `${BTN} bg-red-600 text-white hover:bg-red-700`;
const ROWBTN = "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition";
const BTN_ADV = `${ROWBTN} border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100`;
const BTN_PAY = `${ROWBTN} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`;

const PAGE_SIZE = 10;
const SIZES = ["2kg", "5kg", "8kg", "10kg"];
const SIZE_KG = { "2kg": 2, "5kg": 5, "8kg": 8, "10kg": 10 };
const STATUS_FILTERS = ["All", "Pending", "Partial", "Paid"];
const MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "NEFT", "RTGS", "Other"];
const REF_REQ = ["UPI", "Bank Transfer", "Cheque", "NEFT", "RTGS"];
const ADVANCE_DAYS = [25, 26];
const MODE_ICONS = { UPI: Smartphone, Cash: Wallet, Cheque: FileText };
const STATUS_STYLES = {
  Paid: ["bg-emerald-50 text-emerald-700 border-emerald-200", CheckCircle2],
  Partial: ["bg-sky-50 text-sky-700 border-sky-200", Split],
  Pending: ["bg-amber-50 text-amber-700 border-amber-200", Clock3],
};
const AVATAR_TONES = [
  "from-sky-100 to-sky-200 text-sky-800",
  "from-emerald-100 to-emerald-200 text-emerald-800",
  "from-amber-100 to-amber-200 text-amber-800",
  "from-indigo-100 to-indigo-200 text-indigo-800",
  "from-rose-100 to-rose-200 text-rose-800",
  "from-teal-100 to-teal-200 text-teal-800",
];
const avatarTone = (name = "") =>
  AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const TH2 = "whitespace-nowrap px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const pad = (n) => String(n).padStart(2, "0");
const toInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthRange = (y, m) => ({ from: toInputDate(new Date(y, m, 1)), to: toInputDate(new Date(y, m + 1, 0)) });
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const today = () => toInputDate(new Date());
const advanceOf = (s) => Number(s.advanceAmount || 0);
const remainingOf = (s) => Math.max(0, Math.round(((s.netSalary || 0) - (s.paidAmount || 0) - advanceOf(s)) * 100) / 100);
const typeOf = (s) => s.payType || s.worker?.payType || "Fixed";
const errMsg = (err, fb) => err?.response?.data?.message || fb;

/* ================================================================
 *  PRIMITIVES
 * ================================================================ */
const Badge = ({ className = "", children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>{children}</span>
);
const StatusBadge = ({ status }) => {
  const [cls, Icon] = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return <Badge className={cls}><Icon size={12} />{status || "Pending"}</Badge>;
};
const TypeBadge = ({ type }) => (
  <Badge className={type === "Variable" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-slate-100 text-slate-600 ring-slate-200"}>{type}</Badge>
);
const Progress = ({ value, max }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
const Field = ({ label, hint, className = "", children }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
  </label>
);
const Note = ({ tone = "info", children }) => {
  const isWarn = tone === "warn";
  const Icon = isWarn ? AlertTriangle : Info;
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-5 ${isWarn ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
};
/* Compact stat used inside modals / dense grids */
const Stat = ({ label, value, sub, tone = "text-slate-900" }) => (
  <div className="bg-white p-4">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className={`mt-1 truncate text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
  </div>
);
const GRID_COLS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };
const Grid = ({ cols = 3, children }) => (
  <div className={`grid gap-px overflow-hidden rounded-lg bg-slate-100 ${GRID_COLS[cols]}`}>{children}</div>
);

/* Premium KPI / stat card — matches Raw Materials style */
const StatCard = ({ label, value, sub, icon: Icon, tone = "navy", loading }) => {
  const tones = {
    navy: {
      top: "bg-gradient-to-r from-slate-500 to-[#0a1e3f]",
      icon: "from-slate-100 to-slate-200 text-[#0a1e3f]",
      value: "text-[#0a1e3f]",
    },
    emerald: {
      top: "bg-gradient-to-r from-emerald-400 to-teal-600",
      icon: "from-emerald-50 to-teal-100 text-emerald-700",
      value: "text-emerald-700",
    },
    amber: {
      top: "bg-gradient-to-r from-amber-400 to-orange-500",
      icon: "from-amber-50 to-orange-100 text-amber-700",
      value: "text-amber-700",
    },
    sky: {
      top: "bg-gradient-to-r from-sky-400 to-blue-600",
      icon: "from-sky-50 to-blue-100 text-sky-700",
      value: "text-sky-700",
    },
  };
  const t = tones[tone] || tones.navy;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${t.top}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tabular-nums tracking-tight !text-black">
            {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-slate-100" /> : value}
          </p>
          {sub && (
            <p className="mt-1.5 truncate text-xs text-slate-500">{loading ? "…" : sub}</p>
          )}
        </div>
        {Icon && (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.icon} transition-transform duration-200 group-hover:scale-105`}>
            <Icon size={18} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
};
const Row = ({ label, value, strong, tone = "text-slate-900" }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`text-sm tabular-nums ${strong ? "font-semibold" : "font-medium"} ${tone}`}>{value}</span>
  </div>
);

function Modal({ title, subtitle, onClose, busy, width = "max-w-xl", footer, children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) closeRef.current(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [busy]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className={`flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

function Toasts({ items, dismiss }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {items.map((t) => {
        const isErr = t.type === "error";
        const Icon = isErr ? AlertTriangle : CheckCircle2;
        return (
          <div key={t.id} role="status" className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg ${isErr ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1 leading-5">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}

function MoneyModal({ kind, target, onClose, onDone, toast }) {
  const isAdv = kind === "advance";
  const [form, setForm] = useState({ amount: "", date: today(), paymentMode: "Cash", transactionId: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const remaining = remainingOf(target);
  const needsRef = REF_REQ.includes(form.paymentMode);
  const label = isAdv ? "advance" : "payment";
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast("error", "Enter an amount greater than 0.");
    if (amount - remaining > 0.001) return toast("error", `Amount can't exceed the balance of ${money(remaining)}.`);
    if (needsRef && !form.transactionId.trim()) return toast("error", `Add a reference ID for ${form.paymentMode}.`);
    try {
      setSaving(true);
      const base = { amount, paymentMode: form.paymentMode, transactionId: form.transactionId.trim(), notes: form.notes.trim() };
      if (isAdv) {
        await recordSalaryAdvance(target._id, { ...base, date: form.date });
        toast("success", `${money(amount)} advance recorded for ${target.worker?.name || "worker"}.`);
      } else {
        await recordSalaryPayment(target._id, { ...base, paymentDate: form.date });
        toast("success", `${money(amount)} paid to ${target.worker?.name || "worker"}.`);
      }
      onDone();
    } catch (err) { toast("error", errMsg(err, `Couldn't record the ${label}. Try again.`)); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={isAdv ? `Give advance to ${target.worker?.name || "worker"}` : `Pay ${target.worker?.name || "worker"}`}
      subtitle={`${fmtDate(target.periodStart)} to ${fmtDate(target.periodEnd)}`}
      busy={saving}
      onClose={onClose}
      footer={<>
        <button type="button" className={SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" form="money-form" className={PRIMARY} disabled={saving}>{saving ? "Saving…" : `Record ${label}`}</button>
      </>}
    >
      {isAdv && !ADVANCE_DAYS.includes(new Date().getDate()) && (
        <div className="mb-4">
          <Note tone="warn">Advances are usually given on the 25th or 26th. Today is {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. You can still record one, but double-check it's intended.</Note>
        </div>
      )}
      <div className="mb-4">
        <Grid cols={4}>
          <Stat label="Net salary" value={money(target.netSalary)} />
          <Stat label="Advance" value={money(advanceOf(target))} tone="text-amber-700" />
          <Stat label="Paid" value={money(target.paidAmount)} tone="text-emerald-700" />
          <Stat label="Balance" value={money(remaining)} tone="text-amber-700" />
        </Grid>
      </div>
      <form id="money-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)">
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" min="0.01" step="0.01" max={remaining} className={INPUT} name="amount" value={form.amount} onChange={set} placeholder="0" required />
            <button type="button" className={`${SECONDARY} shrink-0 px-3`} onClick={() => setForm((f) => ({ ...f, amount: String(remaining) }))}>Full</button>
          </div>
        </Field>
        <Field label={isAdv ? "Date given" : "Payment date"}>
          <input type="date" className={INPUT} name="date" value={form.date} onChange={set} required />
        </Field>
        <Field label="Mode">
          <select className={INPUT} name="paymentMode" value={form.paymentMode} onChange={set}>
            {MODES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label={needsRef ? "Reference ID" : "Reference ID (optional)"}>
          <input className={INPUT} name="transactionId" value={form.transactionId} onChange={set} required={needsRef} maxLength={150} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className={TEXTAREA} name="notes" value={form.notes} onChange={set} rows={2} maxLength={500} placeholder="Optional" />
        </Field>
      </form>
    </Modal>
  );
}

const blankForm = (start, end) => ({
  worker: "", periodStart: start, periodEnd: end,
  basicSalary: "", allowances: "0", deductions: "0", notes: "", overrideBasic: false,
});

function Salary() {
  const [salaries, setSalaries] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cursor, setCursor] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const [formState, setFormState] = useState(null);   // { editing, data }
  const [view, setView] = useState(null);
  const [moneyModal, setMoneyModal] = useState(null); // { kind, target }
  const [gen, setGen] = useState(null);               // { stage, start, end, results, message }

  /* ---------- toasts ---------- */
  const toast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* ---------- fetch ---------- */
  const reqId = useRef(0);
  const fetchSalaries = useCallback(async () => {
    const id = ++reqId.current;
    try {
      setLoading(true); setListError("");
      const res = await getSalaries({
        page, limit: PAGE_SIZE,
        ...(query ? { search: query } : {}),
        ...(statusFilter !== "All" ? { paymentStatus: statusFilter } : {}),
        ...(dateFrom ? { fromDate: dateFrom } : {}),
        ...(dateTo ? { toDate: dateTo } : {}),
      });
      if (id !== reqId.current) return;
      const body = res?.data || {};
      const list = body.salaries || [];
      setSalaries(list);
      setMeta({ total: body.pagination?.total ?? list.length, totalPages: Math.max(body.pagination?.totalPages || 1, 1) });
    } catch (err) {
      if (id !== reqId.current) return;
      setListError(errMsg(err, "Couldn't load salaries. Check the server connection and retry."));
      setSalaries([]);
    } finally { if (id === reqId.current) setLoading(false); }
  }, [page, query, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    (async () => {
      try {
        const res = await getWorkers({ limit: 500 });
        const body = res?.data || {};
        setWorkers(body.workers || body.data || (Array.isArray(body) ? body : []));
      } catch (err) { console.error("Failed to fetch workers:", err); }
    })();
  }, []);

  const activeWorkers = useMemo(() => workers.filter((w) => w.status !== "Inactive"), [workers]);
  const fixedWorkers = useMemo(() => activeWorkers.filter((w) => w.payType === "Fixed"), [activeWorkers]);

  /* ---------- summary ---------- */
  const totals = useMemo(() => {
    let net = 0, paid = 0, advance = 0, open = 0;
    for (const s of salaries) {
      net += Number(s.netSalary || 0);
      paid += Number(s.paidAmount || 0);
      advance += advanceOf(s);
      if (s.paymentStatus !== "Paid") open += 1;
    }
    return { net, paid, advance, outstanding: Math.max(0, net - paid - advance), open };
  }, [salaries]);

  /* ---------- filters ---------- */
  const stepMonth = (delta) => {
    const now = new Date();
    const base = cursor || { y: now.getFullYear(), m: now.getMonth() };
    const d = new Date(base.y, base.m + delta, 1);
    const { from, to } = monthRange(d.getFullYear(), d.getMonth());
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setDateFrom(from); setDateTo(to); setPage(1);
  };
  const monthLabel = cursor
    ? new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "All periods";
  const hasFilters = Boolean(query || statusFilter !== "All" || dateFrom || dateTo);
  const resetFilters = () => {
    setSearch(""); setQuery(""); setStatusFilter("All");
    setDateFrom(""); setDateTo(""); setCursor(null); setPage(1);
  };

  /* ---------- generate ---------- */
  const openGenerate = () => {
    const now = new Date();
    const { from, to } = cursor ? monthRange(cursor.y, cursor.m) : monthRange(now.getFullYear(), now.getMonth());
    setGen({ stage: "form", start: from, end: to, results: [], message: "" });
  };
  const closeGenerate = () => { if (gen?.stage !== "running") setGen(null); };
  const presetMonth = (back) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const { from, to } = monthRange(d.getFullYear(), d.getMonth());
    setGen((g) => ({ ...g, start: from, end: to }));
  };
  const runGenerate = async () => {
    if (!gen.start || !gen.end) return toast("error", "Choose both period dates.");
    if (gen.start > gen.end) return toast("error", "Period start can't be after period end.");
    try {
      setGen((g) => ({ ...g, stage: "running" }));
      const res = await generateSalaries({ periodStart: gen.start, periodEnd: gen.end });
      const body = res?.data || {};
      setGen((g) => ({ ...g, stage: "done", results: body.salaries || [], message: body.message || "" }));
      fetchSalaries();
    } catch (err) {
      toast("error", errMsg(err, "Couldn't generate salaries. Try again."));
      setGen((g) => ({ ...g, stage: "form" }));
    }
  };
  const showGenerated = () => {
    setSearch(""); setQuery(""); setStatusFilter("All"); setCursor(null);
    setDateFrom(gen.start); setDateTo(gen.end); setPage(1); setGen(null);
  };

  /* ---------- create / edit ---------- */
  const openCreate = () => {
    const now = new Date();
    const { from, to } = monthRange(now.getFullYear(), now.getMonth());
    setFormState({ editing: null, data: blankForm(from, to) });
  };
  const openEdit = (s) => setFormState({
    editing: s,
    data: {
      worker: s.worker?._id || "",
      periodStart: toInputDate(s.periodStart),
      periodEnd: toInputDate(s.periodEnd),
      basicSalary: String(s.basicSalary ?? ""),
      allowances: String(s.allowances ?? 0),
      deductions: String(s.deductions ?? 0),
      notes: s.notes || "",
      overrideBasic: false,
    },
  });
  const closeForm = () => { if (!saving) setFormState(null); };
  const onFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormState((s) => ({ ...s, data: { ...s.data, [name]: type === "checkbox" ? checked : value } }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    const { editing, data: f } = formState;
    const allowances = Number(f.allowances || 0);
    const deductions = Number(f.deductions || 0);
    const basic = editing && !f.overrideBasic ? Number(editing.basicSalary) : Number(f.basicSalary);

    if (!editing) {
      if (!f.worker) return toast("error", "Choose a worker.");
      if (!f.periodStart || !f.periodEnd) return toast("error", "Choose the salary period.");
      if (f.periodStart > f.periodEnd) return toast("error", "Period start can't be after period end.");
    }
    if (![basic, allowances, deductions].every((n) => Number.isFinite(n) && n >= 0))
      return toast("error", "Amounts must be numbers of 0 or more.");

    const net = Math.max(0, basic + allowances - deductions);
    if (editing && net < (editing.paidAmount || 0))
      return toast("error", `Net salary (${money(net)}) can't be lower than the ${money(editing.paidAmount)} already paid.`);

    try {
      setSaving(true);
      if (editing) {
        const payload = { allowances, deductions, notes: f.notes.trim() };
        if (f.overrideBasic) payload.basicSalary = basic;
        await updateSalary(editing._id, payload);
        toast("success", "Salary updated.");
      } else {
        await createSalary({ worker: f.worker, periodStart: f.periodStart, periodEnd: f.periodEnd, basicSalary: basic, allowances, deductions, notes: f.notes.trim() });
        toast("success", "Salary record created.");
      }
      setFormState(null);
      fetchSalaries();
    } catch (err) { toast("error", errMsg(err, "Couldn't save the salary. Try again.")); }
    finally { setSaving(false); }
  };

  /* ---------- delete salary ---------- */
  const askDelete = (s) => setConfirm({
    title: "Delete salary record?",
    body: `This removes ${s.worker?.name || "this worker"}'s record for ${fmtDate(s.periodStart)} to ${fmtDate(s.periodEnd)}. You can generate it again afterwards.`,
    label: "Delete record",
    onConfirm: async () => {
      try {
        setSaving(true);
        await deleteSalary(s._id);
        toast("success", "Salary record deleted.");
        setConfirm(null);
        fetchSalaries();
      } catch (err) { toast("error", errMsg(err, "Couldn't delete the salary record.")); }
      finally { setSaving(false); }
    },
  });

  /* ---------- view ---------- */
  const openView = (s) => {
    setView(s);
    getSalaryById(s._id)
      .then((res) => {
        const full = res?.data?.salary;
        if (full) setView((prev) => (prev && prev._id === full._id ? full : prev));
      })
      .catch(() => {});
  };

  /* ---------- delete advance ---------- */
  const askDeleteAdvance = (salary, advanceId, amount) => setConfirm({
    title: "Delete advance?",
    body: `This removes the ${money(amount)} advance from ${salary.worker?.name || "this worker"}'s record. The balance will go back up by that amount.`,
    label: "Delete advance",
    onConfirm: async () => {
      try {
        setSaving(true);
        await deleteSalaryAdvance(salary._id, advanceId);
        toast("success", "Advance deleted.");
        setConfirm(null);
        if (view && view._id === salary._id) {
          const res = await getSalaryById(salary._id);
          const full = res?.data?.salary;
          if (full) setView(full);
        }
        fetchSalaries();
      } catch (err) { toast("error", errMsg(err, "Couldn't delete the advance.")); }
      finally { setSaving(false); }
    },
  });

  /* ---------- derived ---------- */
  const firstShown = meta.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, meta.total);
  const settled = totals.paid + totals.advance;
  const genCounts = gen && {
    created: gen.results.filter((r) => r.status === "created").length,
    updated: gen.results.filter((r) => r.status === "updated").length,
    skipped: gen.results.filter((r) => r.status === "skipped").length,
  };

  /* ================================================================
   *  RENDER
   * ================================================================ */
  return (
    <div className="w-full space-y-5 pb-10">
      <Toasts items={toasts} dismiss={dismissToast} />

      {/* ---------- header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0a1e3f]">Salary</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Generate pay for each period, record payments and advances, and see what is still owed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY} onClick={openCreate}><Plus size={16} />Add manual salary</button>
          <button type="button" className={PRIMARY} onClick={openGenerate}><Merge size={16} />Generate salaries</button>
        </div>
      </div>

      {/* ---------- error ---------- */}
      {listError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{listError}</span>
          <button type="button" onClick={fetchSalaries} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      {/* ---------- summary KPI cards ---------- */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Net payroll"
            value={money(totals.net)}
            sub={`${salaries.length} of ${meta.total} record${meta.total === 1 ? "" : "s"} on this page`}
            icon={IndianRupee}
            tone="navy"
            loading={loading}
          />
          <StatCard
            label="Paid out"
            value={money(totals.paid)}
            sub={totals.advance > 0 ? `+ ${money(totals.advance)} in advances` : "No advances this page"}
            icon={CircleDollarSign}
            tone="emerald"
            loading={loading}
          />
          <StatCard
            label="Still owed"
            value={money(totals.outstanding)}
            sub={totals.outstanding > 0 ? "Outstanding balance" : "All settled"}
            icon={TrendingUp}
            tone="amber"
            loading={loading}
          />
          <StatCard
            label="Awaiting payment"
            value={totals.open}
            sub="Pending or part-paid records"
            icon={Users}
            tone="sky"
            loading={loading}
          />
        </div>

        {/* Settlement progress bar */}
        <div className="rounded-xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Settlement progress</p>
            <p className="text-xs font-medium tabular-nums text-slate-600">
              {loading
                ? "…"
                : totals.net > 0
                  ? `${Math.round((settled / totals.net) * 100)}% settled`
                  : "Nothing to pay yet"}
            </p>
          </div>
          <Progress value={settled} max={totals.net} />
          {meta.total > salaries.length && (
            <p className="mt-2 text-[11px] text-slate-400">Based on records visible on this page only</p>
          )}
        </div>
      </section>

      {/* ---------- filters ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-1">
          <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
          <span className="min-w-[116px] text-center text-sm font-medium text-slate-800">{monthLabel}</span>
          <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><ChevronRight size={16} /></button>
        </div>

        <DateFilter from={dateFrom} to={dateTo} accent="#0a1e3f" onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setCursor(null); setPage(1); }} />

        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by worker name" aria-label="Search by worker name" className={`${INPUT} pl-9`} />
        </div>

        <div className="flex rounded-lg border border-slate-300 bg-white p-1" role="group" aria-label="Payment status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatusFilter(s); setPage(1); }}
              aria-pressed={statusFilter === s}
              className={`h-8 rounded-md px-3 text-sm font-medium transition ${statusFilter === s ? "bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
            >{s}</button>
          ))}
        </div>

        {hasFilters && (
          <button type="button" onClick={resetFilters} className="text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900">Clear filters</button>
        )}
      </div>

      {/* ---------- table ---------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
        {/* card header */}
        <div className="flex flex-col gap-1 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-slate-900">Salary records</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{meta.total}</span>
          </div>
          <p className="text-xs text-slate-400">Click any row to view full details</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 bg-white text-left">
            <thead>
              <tr className="bg-white">
                <th className={`${TH2} border-b border-slate-200`}>Worker</th>
                <th className={`${TH2} border-b border-slate-200`}>Pay type</th>
                <th className={`${TH2} border-b border-slate-200 text-right`}>Net salary</th>
                <th className={`${TH2} w-48 border-b border-slate-200`}>Paid</th>
                <th className={`${TH2} border-b border-slate-200 text-right`}>Balance</th>
                <th className={`${TH2} border-b border-slate-200`}>Status</th>
                <th className={`${TH2} border-b border-slate-200 text-right`}>Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    <td colSpan={7} className="border-b border-slate-100 px-5 py-4 last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                          <div className="h-2.5 w-56 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="hidden h-3 w-24 animate-pulse rounded bg-slate-100 sm:block" />
                        <div className="hidden h-3 w-24 animate-pulse rounded bg-slate-100 md:block" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : salaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <Inbox size={24} className="text-slate-400" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-800">
                      {hasFilters ? "No salary records match these filters" : "No salary records yet"}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                      {hasFilters ? "Widen the period or clear the filters." : "Generate salaries for a period and they will show up here."}
                    </p>
                    <div className="mt-5 flex justify-center gap-2">
                      {hasFilters && <button type="button" className={SECONDARY} onClick={resetFilters}>Clear filters</button>}
                      <button type="button" className={PRIMARY} onClick={openGenerate}><Merge size={16} />Generate salaries</button>
                    </div>
                  </td>
                </tr>
              ) : (
                salaries.map((s) => {
                  const remaining = remainingOf(s);
                  const advance = advanceOf(s);
                  const canAct = remaining > 0;
                  const name = s.worker?.name || "Unknown worker";
                  return (
                    <tr
                      key={s._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openView(s)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openView(s); } }}
                      className="group cursor-pointer bg-white transition-colors duration-150 hover:bg-slate-50/70 focus-visible:bg-slate-50 focus-visible:outline-none"
                    >
                      {/* worker */}
                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0">
                        <div className="flex items-center gap-3.5">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold ring-2 ring-white shadow-sm ${avatarTone(name)}`}>
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[200px] truncate text-sm font-semibold text-slate-900">{name}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</span>
                          </span>
                        </div>
                      </td>

                      {/* pay type */}
                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0"><TypeBadge type={typeOf(s)} /></td>

                      {/* net */}
                      <td className="border-b border-slate-100 px-5 py-4 text-right group-last:border-0">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">{money(s.netSalary)}</span>
                        {advance > 0 && (
                          <span className="mt-0.5 block text-[11px] tabular-nums text-amber-600">incl. {money(advance)} advance</span>
                        )}
                      </td>

                      {/* paid + progress */}
                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold tabular-nums text-emerald-700">{money(s.paidAmount)}</span>
                          <span className="text-[11px] font-medium tabular-nums text-slate-400">
                            {s.netSalary > 0 ? Math.min(100, Math.round((((s.paidAmount || 0) + advance) / s.netSalary) * 100)) : 0}%
                          </span>
                        </div>
                        <div className="mt-2"><Progress value={(s.paidAmount || 0) + advance} max={s.netSalary || 0} /></div>
                      </td>

                      {/* balance */}
                      <td className="border-b border-slate-100 px-5 py-4 text-right group-last:border-0">
                        {remaining > 0 ? (
                          <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-sm font-semibold tabular-nums text-amber-700 ring-1 ring-inset ring-amber-100">
                            {money(remaining)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 size={14} />Settled
                          </span>
                        )}
                      </td>

                      {/* status */}
                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0"><StatusBadge status={s.paymentStatus} /></td>

                      {/* actions */}
                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {canAct ? (
                            <>
                              <button type="button" onClick={() => setMoneyModal({ kind: "advance", target: s })} className={BTN_ADV} title="Record advance (usually on 25th or 26th)"><Banknote size={13} />Advance</button>
                              <button type="button" onClick={() => setMoneyModal({ kind: "payment", target: s })} className={BTN_PAY}><HandCoins size={13} />Pay</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => openView(s)} className={`${ROWBTN} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
                              <ReceiptText size={13} />Details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* footer / pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-500">
            Showing <span className="font-semibold tabular-nums text-slate-800">{firstShown}–{lastShown}</span> of{" "}
            <span className="font-semibold tabular-nums text-slate-800">{meta.total}</span>
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className={`${SECONDARY} h-9 px-3`} disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={14} />Previous
            </button>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium tabular-nums text-slate-700">
              {page} <span className="text-slate-400">/ {meta.totalPages}</span>
            </span>
            <button type="button" className={`${SECONDARY} h-9 px-3`} disabled={page >= meta.totalPages || loading} onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}>
              Next<ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {gen && (
        <Modal
          title="Generate salaries"
          subtitle={gen.stage === "done" ? `${fmtDate(gen.start)} to ${fmtDate(gen.end)}` : "Calculates pay from attendance (fixed) or production (variable)."}
          width="max-w-2xl"
          busy={gen.stage === "running"}
          onClose={closeGenerate}
          footer={gen.stage === "done" ? (
            <>
              <button type="button" className={SECONDARY} onClick={() => setGen(null)}>Close</button>
              <button type="button" className={PRIMARY} onClick={showGenerated}>Show these salaries</button>
            </>
          ) : (
            <>
              <button type="button" className={SECONDARY} onClick={closeGenerate} disabled={gen.stage === "running"}>Cancel</button>
              <button type="button" className={PRIMARY} onClick={runGenerate} disabled={gen.stage === "running"}>
                {gen.stage === "running" ? <><Loader2 size={16} className="animate-spin" />Generating…</> : <><Merge size={16} />Generate</>}
              </button>
            </>
          )}
        >
          {gen.stage === "done" ? (
            gen.results.length === 0 ? (
              <Note>{gen.message || "No active workers matched this period."}</Note>
            ) : (
              <div className="space-y-4">
                <Grid cols={3}>
                  <Stat label="Created" value={genCounts.created} tone="text-emerald-700" />
                  <Stat label="Recalculated" value={genCounts.updated} tone="text-sky-700" />
                  <Stat label="Skipped" value={genCounts.skipped} tone="text-amber-700" />
                </Grid>
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {gen.results.map((r, i) => {
                    const net = r.salary?.netSalary;
                    const chip = r.status === "created" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : r.status === "updated" ? "bg-sky-50 text-sky-700 ring-sky-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200";
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                          {r.status === "skipped"
                            ? <p className="text-xs text-amber-700">{r.reason || "Skipped"}</p>
                            : Number(net) === 0
                              ? <p className="text-xs text-amber-700">Net salary is ₹0. Check attendance, pay amount or per-reel rates.</p>
                              : <p className="text-xs tabular-nums text-slate-500">Net {money(net)}</p>}
                        </div>
                        <Badge className={chip}>{r.status === "updated" ? "recalculated" : r.status}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Period start">
                    <input type="date" className={INPUT} value={gen.start} onChange={(e) => setGen((g) => ({ ...g, start: e.target.value }))} disabled={gen.stage === "running"} />
                  </Field>
                  <Field label="Period end">
                    <input type="date" className={INPUT} value={gen.end} onChange={(e) => setGen((g) => ({ ...g, end: e.target.value }))} disabled={gen.stage === "running"} />
                  </Field>
                </div>
                <div className="mt-2 flex gap-2">
                  {[["This month", 0], ["Last month", 1]].map(([label, back]) => (
                    <button key={label} type="button" onClick={() => presetMonth(back)} className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900">{label}</button>
                  ))}
                </div>
              </div>
              <Note>
                Salaries are generated for all {activeWorkers.length} active workers. Existing records for this period are recalculated, keeping their allowances, deductions, and advances. Records that already have payments are skipped. Fixed pay uses the monthly amount divided by 30 per absent day.
              </Note>
            </div>
          )}
        </Modal>
      )}

      {formState && (() => {
        const { editing, data: f } = formState;
        const basic = editing && !f.overrideBasic ? Number(editing.basicSalary) || 0 : Number(f.basicSalary) || 0;
        const net = Math.max(0, basic + (Number(f.allowances) || 0) - (Number(f.deductions) || 0));
        const underPaid = editing && net < (editing.paidAmount || 0);
        return (
          <Modal
            title={editing ? "Edit salary" : "Add manual salary"}
            subtitle={editing
              ? `${editing.worker?.name || "Worker"}, ${fmtDate(editing.periodStart)} to ${fmtDate(editing.periodEnd)}`
              : "For one-off entries. Regular payroll is quicker with Generate salaries."}
            busy={saving}
            onClose={closeForm}
            footer={<>
              <button type="button" className={SECONDARY} onClick={closeForm} disabled={saving}>Cancel</button>
              <button type="submit" form="salary-form" className={PRIMARY} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create salary"}</button>
            </>}
          >
            <form id="salary-form" onSubmit={submitForm} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!editing && <>
                <Field label="Worker" className="sm:col-span-2" hint="Manual records can only be created for fixed-pay workers.">
                  <select className={INPUT} name="worker" value={f.worker} onChange={onFormChange} required>
                    <option value="">Select a worker</option>
                    {fixedWorkers.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </Field>
                <Field label="Period start"><input type="date" className={INPUT} name="periodStart" value={f.periodStart} onChange={onFormChange} required /></Field>
                <Field label="Period end"><input type="date" className={INPUT} name="periodEnd" value={f.periodEnd} onChange={onFormChange} required /></Field>
              </>}

              {editing && (
                <div className="sm:col-span-2">
                  <Note>The period is fixed once a record exists. To change it, delete the record and generate it again. Basic salary comes from attendance or production, so use allowances and deductions for adjustments.</Note>
                </div>
              )}

              <Field label="Basic salary (₹)" hint={editing && !f.overrideBasic ? "Calculated automatically" : undefined}>
                <input type="number" inputMode="decimal" min="0" step="0.01" className={INPUT} name="basicSalary"
                  value={editing && !f.overrideBasic ? String(editing.basicSalary ?? "") : f.basicSalary}
                  onChange={onFormChange} disabled={Boolean(editing) && !f.overrideBasic} placeholder="0" required />
              </Field>
              <Field label="Allowances (₹)">
                <input type="number" inputMode="decimal" min="0" step="0.01" className={INPUT} name="allowances" value={f.allowances} onChange={onFormChange} />
              </Field>
              <Field label="Deductions (₹)" className="sm:col-span-2">
                <input type="number" inputMode="decimal" min="0" step="0.01" className={INPUT} name="deductions" value={f.deductions} onChange={onFormChange} />
              </Field>

              {editing && (
                <label className="flex items-start gap-2 text-sm text-slate-600 sm:col-span-2">
                  <input type="checkbox" className="mt-0.5" name="overrideBasic" checked={f.overrideBasic} onChange={onFormChange} />
                  <span>
                    Override basic salary manually
                    <span className="block text-xs text-slate-400">Generating this period again will replace the override.</span>
                  </span>
                </label>
              )}

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">Net salary</p>
                  {editing && editing.paidAmount > 0 && <p className="text-xs text-slate-500">{money(editing.paidAmount)} already paid</p>}
                </div>
                <p className={`text-lg font-semibold tabular-nums ${underPaid ? "text-red-600" : "text-slate-900"}`}>{money(net)}</p>
              </div>

              <Field label="Notes" className="sm:col-span-2">
                <textarea className={TEXTAREA} name="notes" value={f.notes} onChange={onFormChange} rows={3} maxLength={1000} placeholder="Optional" />
              </Field>
            </form>
          </Modal>
        );
      })()}

      {/* ================================================================
       *  MONEY MODAL (payment + advance)
       * ================================================================ */}
      {moneyModal && (
        <MoneyModal
          kind={moneyModal.kind}
          target={moneyModal.target}
          toast={toast}
          onClose={() => setMoneyModal(null)}
          onDone={() => { setMoneyModal(null); fetchSalaries(); }}
        />
      )}

      {view && (() => {
        const advance = advanceOf(view);
        const canDelete = !(view.paidAmount > 0) && advance === 0;
        const closeAnd = (fn) => { const t = view; setView(null); fn(t); };
        return (
          <Modal
            title={view.worker?.name || "Salary record"}
            subtitle={`${fmtDate(view.periodStart)} to ${fmtDate(view.periodEnd)}`}
            width="max-w-3xl"
            onClose={() => setView(null)}
            footer={<>
              <button type="button" className={`${DANGER} mr-auto`} disabled={!canDelete}
                title={canDelete ? "Delete this salary record" : "Records with payments or advances can't be deleted"}
                onClick={() => closeAnd(askDelete)}>
                <Trash2 size={15} />Delete
              </button>
              <button type="button" className={SECONDARY} onClick={() => closeAnd(openEdit)}><Pencil size={15} />Edit</button>
              {remainingOf(view) > 0 && <>
                <button type="button" className={SECONDARY} onClick={() => closeAnd((t) => setMoneyModal({ kind: "advance", target: t }))}><Banknote size={15} />Give advance</button>
                <button type="button" className={PRIMARY} onClick={() => closeAnd((t) => setMoneyModal({ kind: "payment", target: t }))}><HandCoins size={15} />Record payment</button>
              </>}
            </>}
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={typeOf(view)} />
                <StatusBadge status={view.paymentStatus} />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <Row label="Role" value={view.worker?.role || "—"} />
                  <Row label="Department" value={view.worker?.department || "—"} />
                  <Row label="Phone" value={view.worker?.phone || "—"} />
                  <Row label="Last payment" value={fmtDate(view.lastPaymentDate)} />
                </div>
                <div className="space-y-2.5 rounded-lg bg-slate-50 p-4">
                  <Row label="Basic salary" value={money(view.basicSalary)} />
                  <Row label="Allowances" value={`+ ${money(view.allowances)}`} />
                  <Row label="Deductions" value={`− ${money(view.deductions)}`} />
                  <div className="border-t border-slate-200 pt-2.5">
                    <Row label="Net salary" value={money(view.netSalary)} strong />
                  </div>
                  {advance > 0 && <Row label="Advance already given" value={`− ${money(advance)}`} tone="text-amber-700" />}
                  <Row label="Regular payments" value={money(view.paidAmount)} tone="text-emerald-700" />
                  <Row label="Balance" value={money(remainingOf(view))} tone="text-amber-700" />
                  <Progress value={(view.paidAmount || 0) + advance} max={view.netSalary || 0} />
                </div>
              </div>

              {typeOf(view) === "Fixed" && view.attendance?.workingDays > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Attendance</h3>
                  <Grid cols={4}>
                    <Stat label="Days in period" value={view.attendance.workingDays} />
                    <Stat label="Present" value={view.attendance.presentDays} />
                    <Stat label="Absent" value={view.attendance.absentDays} tone={view.attendance.absentDays > 0 ? "text-amber-700" : "text-slate-900"} />
                    <Stat label="Daily rate" value={money(view.attendance.dailyRate)} />
                  </Grid>
                  <p className="mt-1.5 text-xs text-slate-500">Absence deduction is already reflected in the basic salary above.</p>
                </section>
              )}

              {typeOf(view) === "Variable" && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Production</h3>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-medium text-slate-500">
                          <th className="px-3 py-2 text-left">Reel size</th>
                          <th className="px-3 py-2 text-right">Reels</th>
                          <th className="px-3 py-2 text-right">Weight</th>
                          <th className="px-3 py-2 text-right">Rate per kg</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SIZES.map((size) => {
                          const row = view.production?.[size] || {};
                          return (
                            <tr key={size} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{size.replace("kg", " kg")}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{(row.quantity || 0).toLocaleString("en-IN")}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{((row.quantity || 0) * SIZE_KG[size]).toLocaleString("en-IN")} kg</td>
                              <td className="px-3 py-2 text-right tabular-nums">{money(row.rate)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{money(row.amount)}</td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                          <td className="px-3 py-2">Total</td>
                          <td className="px-3 py-2 text-right tabular-nums">{(view.production?.totalReels || 0).toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {SIZES.reduce((sum, size) => sum + (view.production?.[size]?.quantity || 0) * SIZE_KG[size], 0).toLocaleString("en-IN")} kg
                          </td>
                          <td />
                          <td className="px-3 py-2 text-right tabular-nums">{money(view.production?.totalEarnings)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {view.advances?.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Banknote size={15} className="text-amber-500" />
                    Advances
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-700">{view.advances.length}</span>
                    <span className="ml-auto text-xs font-medium tabular-nums text-amber-700">Total {money(advance)}</span>
                  </h3>
                  <ul className="space-y-2">
                    {[...view.advances].reverse().map((a) => {
                      const ModeIcon = MODE_ICONS[a.paymentMode] || CreditCard;
                      return (
                        <li key={a._id} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/40 px-3.5 py-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><ModeIcon size={14} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold tabular-nums text-slate-900">{money(a.amount)}</span>
                              <Badge className="bg-white text-slate-500 ring-slate-200">{a.paymentMode}</Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{fmtDate(a.date)}{a.transactionId ? `, ref ${a.transactionId}` : ""}</p>
                            {a.notes && <p className="mt-0.5 truncate text-xs text-slate-400">{a.notes}</p>}
                          </div>
                          <button type="button" onClick={() => askDeleteAdvance(view, a._id, a.amount)} className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Delete advance" aria-label="Delete advance"><Trash2 size={14} /></button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {view.notes && (
                <section>
                  <h3 className="mb-1.5 text-sm font-semibold text-slate-800">Notes</h3>
                  <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm leading-6 text-slate-600">{view.notes}</p>
                </section>
              )}

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ReceiptText size={15} className="text-slate-500" />
                  Payment history
                  {view.payments?.length > 0 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{view.payments.length}</span>
                  )}
                </h3>
                {!view.payments?.length ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">No payments recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {[...view.payments].reverse().map((p) => {
                      const ModeIcon = MODE_ICONS[p.paymentMode] || CreditCard;
                      return (
                        <li key={p._id} className="flex items-start gap-3 rounded-lg border border-slate-200 px-3.5 py-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><ModeIcon size={14} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold tabular-nums text-slate-900">{money(p.amount)}</span>
                              <Badge className="bg-white text-slate-500 ring-slate-200">{p.paymentMode}</Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{fmtDate(p.paymentDate)}{p.transactionId ? `, ref ${p.transactionId}` : ""}</p>
                            {p.notes && <p className="mt-0.5 truncate text-xs text-slate-400">{p.notes}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </Modal>
        );
      })()}

      {/* ---------- confirm ---------- */}
      {confirm && (
        <Modal
          title={confirm.title}
          width="max-w-md"
          busy={saving}
          onClose={() => setConfirm(null)}
          footer={<>
            <button type="button" className={SECONDARY} onClick={() => setConfirm(null)} disabled={saving}>Cancel</button>
            <button type="button" className={DANGER} onClick={confirm.onConfirm} disabled={saving}>{saving ? "Working…" : confirm.label}</button>
          </>}
        >
          <p className="text-sm leading-6 text-slate-600">{confirm.body}</p>
        </Modal>
      )}
    </div>
  );
}

export default Salary;