import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, X, CalendarDays, CheckCircle2, AlertTriangle,
  Loader2, ChevronLeft, ChevronRight, Info, UserCheck, UserX, RefreshCw, Save,
  Inbox, ReceiptText, Users, Wallet, Layers, History,
} from "lucide-react";
import {
  getWorkers, createWorker, updateWorker, deleteWorker,
  getAttendance, saveAttendance, getSalaries, getAttendanceHistory,
} from "../api/api";

const PAGE_SIZE = 10;
const HIST_PAGE_SIZE = 8;
const RATE_MIN = 2, RATE_MAX = 3;
const PHONE_RE = /^[0-9+\-\s()]*$/;
const RATE_FIELDS = [
  { key: "rate2kg", label: "2 kg", kg: 2 },
  { key: "rate5kg", label: "5 kg", kg: 5 },
  { key: "rate8kg", label: "8 kg", kg: 8 },
  { key: "rate10kg", label: "10 kg", kg: 10 },
];
const SALARY_STATUS = {
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Partial: "bg-sky-50 text-sky-700 ring-sky-200",
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
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
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayISO = () => toInputDate(new Date());
const shiftDate = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  return toInputDate(new Date(y, m - 1, d + days));
};
const parseDate = (v) => {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, day] = v.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v) => {
  const d = parseDate(v);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
const fmtWeekday = (v) => {
  const d = parseDate(v);
  return d ? d.toLocaleDateString("en-IN", { weekday: "long" }) : "";
};
const fmtTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const str = (v) => (v == null ? "" : String(v));
const errMsg = (err, fb) => {
  const d = err?.response?.data;
  return Array.isArray(d?.errors) && d.errors.length ? d.errors.join(", ") : d?.message || fb;
};
const idsKey = (list) => list.map((a) => a._id).sort().join(",");
const recordDateISO = (rec) => toInputDate(rec?.date ?? rec?.attendanceDate ?? rec?.createdAt);

const blankForm = () => ({
  name: "", phone: "", role: "", department: "",
  joiningDate: todayISO(), status: "Active", payType: "Fixed",
  fixedPay: { amount: "", cycle: "Monthly" },
  variablePay: { rate2kg: "", rate5kg: "", rate8kg: "", rate10kg: "" },
});

const INPUT = "h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500";
const inp = (err) => `${INPUT} ${err ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : "border-slate-300 focus:border-[#0a1e3f] focus:ring-[#0a1e3f]/10"}`;
const BTN = "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a1e3f]/30 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = `${BTN} bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white shadow-sm hover:from-[#0a1e3f] hover:to-[#06142b]`;
const SECONDARY = `${BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const DANGER = `${BTN} bg-red-600 text-white hover:bg-red-700`;

const Badge = ({ className = "", children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>{children}</span>
);
const TypeBadge = ({ type }) => (
  <Badge className={type === "Variable" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-slate-100 text-slate-600 ring-slate-200"}>{type}</Badge>
);
const StatusBadge = ({ status }) => {
  const active = status !== "Inactive";
  return (
    <Badge className={active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}>
      {active ? <CheckCircle2 size={12} /> : <X size={12} />}
      {active ? "Active" : "Inactive"}
    </Badge>
  );
};
const SalaryStatusBadge = ({ status }) => (
  <Badge className={SALARY_STATUS[status] || SALARY_STATUS.Pending}>{status || "Pending"}</Badge>
);
const Field = ({ label, hint, error, className = "", children }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
    {children}
    {error ? <span className="mt-1 block text-xs text-red-600">{error}</span>
      : hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
  </label>
);
const Note = ({ tone = "info", children }) => {
  const warn = tone === "warn";
  const Icon = warn ? AlertTriangle : Info;
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-5 ${warn ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
      <Icon size={14} className="mt-0.5 shrink-0" /><div>{children}</div>
    </div>
  );
};

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
    indigo: {
      top: "bg-gradient-to-r from-indigo-400 to-violet-600",
      icon: "from-indigo-50 to-violet-100 text-indigo-700",
      value: "text-indigo-700",
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
            {loading ? (
              <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" />
            ) : (
              value
            )}
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

const Row = ({ label, value, tone = "text-slate-900" }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`text-sm font-medium tabular-nums ${tone}`}>{value}</span>
  </div>
);
const Segmented = ({ options, value, onChange, label, disabled }) => (
  <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" role="group" aria-label={label}>
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        disabled={disabled}
        aria-pressed={value === v}
        onClick={() => onChange(v)}
        className={`h-8 rounded-md px-3 text-sm font-medium transition disabled:opacity-50 ${value === v ? "bg-gradient-to-b from-[#0f2a52] to-[#0a1e3f] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
      >
        {text}
      </button>
    ))}
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
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X size={18} /></button>
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

function PayCell({ worker }) {
  if (worker.payType === "Fixed") {
    return (
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-sm font-semibold tabular-nums text-slate-900">{money(worker.fixedPay?.amount)}</span>
        <span className="text-xs text-slate-400">/ {(worker.fixedPay?.cycle || "Monthly").toLowerCase()}</span>
      </div>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {RATE_FIELDS.map((f) => {
        const v = worker.variablePay?.[f.key];
        const has = v != null;
        return (
          <span
            key={f.key}
            title={has ? `${f.label} reel, per kg` : `No ${f.label} rate set`}
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ring-1 ring-inset ${has ? "bg-white text-slate-700 ring-slate-200" : "bg-white text-slate-300 ring-slate-100"}`}
          >
            {f.label} {has ? money(v) : "—"}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Attendance history table                                          */
/* ------------------------------------------------------------------ */
function AttendanceHistory({ hist, onReload, onOpenDate, busy }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <History size={18} className="text-slate-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Attendance history</h2>
            <p className="text-xs text-slate-500">Every day that has been marked, newest first. Open a day to correct it.</p>
          </div>
        </div>
        <button type="button" className={`${SECONDARY} h-9 px-3`} onClick={() => onReload(hist.page)}
          disabled={hist.loading || busy} title="Refresh history">
          <RefreshCw size={14} className={hist.loading ? "animate-spin" : ""} />Refresh
        </button>
      </div>

      {hist.error ? (
        <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-red-700">
          <span>{hist.error}</span>
          <button type="button" onClick={() => onReload(1)} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 bg-white text-left">
            <thead>
              <tr className="bg-white">
                <th className={`${TH2} border-b border-slate-200`}>Date</th>
                <th className={`${TH2} border-b border-slate-200`}>Present</th>
                <th className={`${TH2} border-b border-slate-200`}>Absent</th>
                <th className={`${TH2} border-b border-slate-200`}>Who was absent</th>
                <th className={`${TH2} border-b border-slate-200`}>Marked at</th>
                <th className={`${TH2} border-b border-slate-200 text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {hist.loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    <td colSpan={6} className="border-b border-slate-100 px-5 py-4">
                      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : hist.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <CalendarDays size={20} className="text-slate-400" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">No attendance marked yet</p>
                    <p className="mt-1 text-sm text-slate-500">Save a day above and it will show up here.</p>
                  </td>
                </tr>
              ) : (
                hist.items.map((rec, idx) => {
                  const iso = recordDateISO(rec);
                  const absentList = Array.isArray(rec.absentWorkers) ? rec.absentWorkers : [];
                  const absentN = absentList.length;
                  const allPresent = Boolean(rec.allPresent);
                  const presentN =
                    rec.presentCount ??
                    (Array.isArray(rec.presentWorkers) ? rec.presentWorkers.length : null) ??
                    (rec.totalWorkers != null ? Math.max(0, rec.totalWorkers - absentN) : null);
                  const isToday = iso === todayISO();
                  return (
                    <tr key={rec._id || iso || idx} className="group bg-white transition-colors duration-150 hover:bg-slate-50/70">
                      <td className="border-b border-slate-100 px-5 py-3.5 group-last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap text-sm font-semibold text-slate-900">{fmtDate(iso || rec.date)}</span>
                          {isToday && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">Today</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{fmtWeekday(iso || rec.date)}</p>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3.5 text-sm tabular-nums group-last:border-0">
                        {presentN != null ? (
                          <span className="font-semibold text-slate-900">{presentN}</span>
                        ) : allPresent ? (
                          <span className="font-medium text-emerald-700">All present</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3.5 text-sm tabular-nums group-last:border-0">
                        {absentN === 0
                          ? <span className="text-slate-400">0</span>
                          : <span className="font-semibold text-red-700">{absentN}</span>}
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3.5 group-last:border-0">
                        {absentN === 0 ? (
                          <span className="text-sm text-slate-400">Nobody</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {absentList.slice(0, 3).map((w, i) => (
                              <span key={w?._id || i} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
                                {w?.name || w?.workerName || "Unknown"}
                              </span>
                            ))}
                            {absentN > 3 && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">+{absentN - 3} more</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3.5 text-xs text-slate-500 group-last:border-0">
                        {fmtTime(rec.updatedAt || rec.createdAt)}
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3.5 text-right group-last:border-0">
                        <button type="button" onClick={() => onOpenDate(iso)} disabled={busy || !iso}
                          className={`${SECONDARY} h-8 px-2.5 text-xs`} title="Open this day in the editor above">
                          <Pencil size={13} />Open
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!hist.error && hist.items.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-500">
            Page <span className="font-semibold tabular-nums text-slate-800">{hist.page}</span> of{" "}
            <span className="font-semibold tabular-nums text-slate-800">{hist.totalPages}</span>
            {hist.total > 0 && <> · <span className="font-semibold tabular-nums text-slate-800">{hist.total}</span> day{hist.total === 1 ? "" : "s"} marked</>}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className={`${SECONDARY} h-9 px-3`}
              disabled={hist.loading || hist.page <= 1} onClick={() => onReload(hist.page - 1)}>
              <ChevronLeft size={14} />Newer
            </button>
            <button type="button" className={`${SECONDARY} h-9 px-3`}
              disabled={hist.loading || hist.page >= hist.totalPages} onClick={() => onReload(hist.page + 1)}>
              Older<ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Workers() {
  /* ---------- list ---------- */
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [payFilter, setPayFilter] = useState("All");
  const [page, setPage] = useState(1);

  /* ---------- shared ---------- */
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  /* ---------- modals (grouped) ---------- */
  const [formState, setFormState] = useState(null);
  const [viewState, setViewState] = useState(null);
  const [picker, setPicker] = useState(null);

  /* ---------- attendance (one object) ---------- */
  const [att, setAtt] = useState({
    date: todayISO(), allPresent: true, absent: [],
    saved: { exists: false, allPresent: true, ids: "" },
    loading: true, failed: false, saving: false,
  });

  /* ---------- attendance history ---------- */
  const [hist, setHist] = useState({
    items: [], loading: true, error: "", page: 1, totalPages: 1, total: 0,
  });

  /* ---------- toasts ---------- */
  const toast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* ---------- load workers ---------- */
  const loadWorkers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const all = [];
      let p = 1, totalPages = 1;
      do {
        const { data } = await getWorkers({ page: p, limit: 100 });
        if (!data?.success) throw new Error(data?.message || "Failed to load workers");
        all.push(...(data.data || []));
        totalPages = data.pagination?.totalPages || 1;
        p += 1;
      } while (p <= totalPages && p <= 20);
      setWorkers(all);
    } catch (err) {
      setLoadError(errMsg(err, err?.message || "Couldn't load workers."));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  /* ---------- load attendance for the selected day ---------- */
  const attReq = useRef(0);
  const loadAttendance = useCallback(async () => {
    const id = ++attReq.current;
    try {
      setAtt((a) => ({ ...a, loading: true, failed: false }));
      const { data } = await getAttendance(att.date);
      if (id !== attReq.current) return;
      const rec = data?.success ? data.data : null;
      if (rec) {
        const list = (rec.absentWorkers || []).map((w) => ({ _id: w._id, name: w.name, role: w.role }));
        setAtt((a) => ({
          ...a, allPresent: Boolean(rec.allPresent), absent: list,
          saved: { exists: true, allPresent: Boolean(rec.allPresent), ids: rec.allPresent ? "" : idsKey(list) },
          loading: false,
        }));
      } else {
        setAtt((a) => ({
          ...a, allPresent: true, absent: [],
          saved: { exists: false, allPresent: true, ids: "" }, loading: false,
        }));
      }
    } catch (err) {
      if (id !== attReq.current) return;
      setAtt((a) => ({ ...a, failed: true, loading: false }));
      toast("error", errMsg(err, "Couldn't load attendance for this date."));
    }
  }, [att.date, toast]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  /* ---------- load attendance history ---------- */
  const loadHistory = useCallback(async (targetPage = 1) => {
    const wanted = Math.max(1, Number(targetPage) || 1);
    try {
      setHist((h) => ({ ...h, loading: true, error: "" }));
      const { data } = await getAttendanceHistory({ page: wanted, limit: HIST_PAGE_SIZE });
      const payload = data?.data ?? {};
      const items = Array.isArray(payload)
        ? payload
        : (payload.attendance || payload.records || payload.history || []);
      const pg = data?.pagination || payload.pagination || {};
      setHist({
        items,
        loading: false,
        error: "",
        page: pg.page || wanted,
        totalPages: Math.max(1, pg.totalPages || 1),
        total: pg.total ?? items.length,
      });
    } catch (err) {
      setHist((h) => ({ ...h, loading: false, error: errMsg(err, "Couldn't load attendance history.") }));
    }
  }, []);

  useEffect(() => { loadHistory(1); }, [loadHistory]);

  /* ---------- derived ---------- */
  const stats = useMemo(() => {
    let active = 0, fixed = 0, variable = 0;
    for (const w of workers) {
      if (w.status !== "Inactive") active += 1;
      if (w.payType === "Fixed") fixed += 1;
      else if (w.payType === "Variable") variable += 1;
    }
    return { total: workers.length, active, fixed, variable };
  }, [workers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers.filter((w) =>
      (statusFilter === "All" || (w.status || "Active") === statusFilter) &&
      (payFilter === "All" || w.payType === payFilter) &&
      (!q || [w.name, w.workerId, w.phone, w.role, w.department].some((v) => String(v || "").toLowerCase().includes(q)))
    );
  }, [workers, search, statusFilter, payFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = Boolean(search.trim() || statusFilter !== "All" || payFilter !== "All");
  const resetFilters = () => { setSearch(""); setStatusFilter("All"); setPayFilter("All"); setPage(1); };

  const eligible = useMemo(
    () => workers.filter((w) => w.status !== "Inactive" && (!w.joiningDate || toInputDate(w.joiningDate) <= att.date)),
    [workers, att.date]
  );
  const eligibleIds = useMemo(() => new Set(eligible.map((w) => w._id)), [eligible]);

  const pickerList = useMemo(() => {
    const map = new Map(eligible.map((w) => [w._id, w]));
    att.absent.forEach((a) => { if (!map.has(a._id)) map.set(a._id, a); });
    const q = (picker?.search || "").trim().toLowerCase();
    return [...map.values()].filter((w) =>
      !q || String(w.name || "").toLowerCase().includes(q) || String(w.workerId || "").toLowerCase().includes(q)
    );
  }, [eligible, att.absent, picker?.search]);

  const absentEligible = att.absent.filter((a) => eligibleIds.has(a._id)).length;
  const presentCount = Math.max(0, eligible.length - (att.allPresent ? 0 : absentEligible));
  const dirty = !att.loading && !att.failed &&
    (att.allPresent !== att.saved.allPresent || (att.allPresent ? "" : idsKey(att.absent)) !== att.saved.ids);

  /* ---------- attendance actions ---------- */
  const goToDate = (next) => {
    if (!next || next > todayISO() || next === att.date) return;
    if (dirty) {
      setConfirm({
        title: "Discard unsaved attendance?",
        body: `You have unsaved changes for ${fmtDate(att.date)}.`,
        label: "Discard changes", tone: "danger",
        onConfirm: () => { setAtt((a) => ({ ...a, date: next })); setConfirm(null); },
      });
      return;
    }
    setAtt((a) => ({ ...a, date: next }));
  };

  const openHistoryDate = (iso) => {
    if (!iso) return;
    goToDate(iso);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setMode = (mode) => {
    if (mode === "present") setAtt((a) => ({ ...a, allPresent: true }));
    else {
      setAtt((a) => ({ ...a, allPresent: false }));
      if (att.absent.length === 0) setPicker({ open: true, search: "" });
    }
  };
  const toggleAbsent = (w) => setAtt((a) => ({
    ...a,
    absent: a.absent.some((x) => x._id === w._id)
      ? a.absent.filter((x) => x._id !== w._id)
      : [...a.absent, { _id: w._id, name: w.name, role: w.role }],
  }));
  const closePicker = () => {
    setPicker(null);
    setAtt((a) => (a.absent.length === 0 ? { ...a, allPresent: true } : a));
  };
  const saveAtt = async () => {
    if (!att.allPresent && att.absent.length === 0)
      return toast("error", "Choose who is absent, or switch to Everyone present.");
    try {
      setAtt((a) => ({ ...a, saving: true }));
      await saveAttendance({ date: att.date, allPresent: att.allPresent, absentWorkerIds: att.allPresent ? [] : att.absent.map((a) => a._id) });
      setAtt((a) => ({ ...a, saving: false, saved: { exists: true, allPresent: a.allPresent, ids: a.allPresent ? "" : idsKey(a.absent) } }));
      toast("success", `Attendance saved for ${fmtDate(att.date)}.`);
      loadHistory(1);
    } catch (err) {
      setAtt((a) => ({ ...a, saving: false }));
      toast("error", errMsg(err, "Couldn't save attendance."));
    }
  };

  /* ---------- worker form ---------- */
  const openCreate = () => setFormState({ editing: null, data: blankForm(), errors: {} });
  const openEdit = (w) => setFormState({
    editing: w,
    errors: {},
    data: {
      name: w.name || "", phone: w.phone || "", role: w.role || "", department: w.department || "",
      joiningDate: toInputDate(w.joiningDate), status: w.status || "Active", payType: w.payType || "Fixed",
      fixedPay: { amount: str(w.fixedPay?.amount), cycle: w.fixedPay?.cycle || "Monthly" },
      variablePay: Object.fromEntries(RATE_FIELDS.map((f) => [f.key, str(w.variablePay?.[f.key])])),
    },
  });
  const closeForm = () => { if (!saving) setFormState(null); };

  const set = (path, value, errorKey) => setFormState((s) => {
    if (!s) return s;
    let data;
    if (Array.isArray(path)) {
      const [group, key] = path;
      data = { ...s.data, [group]: { ...s.data[group], [key]: value } };
    } else {
      data = { ...s.data, [path]: value };
    }
    const errors = { ...s.errors, [errorKey || (Array.isArray(path) ? path[1] : path)]: undefined, variable: undefined };
    return { ...s, data, errors };
  });

  const validate = (form) => {
    const e = {};
    const name = form.name.trim();
    if (!name) e.name = "Name is required.";
    else if (name.length > 150) e.name = "Name is too long (150 characters max).";
    if (form.phone.length > 20) e.phone = "Phone is too long (20 characters max).";
    else if (!PHONE_RE.test(form.phone)) e.phone = "Use digits, spaces and + - ( ) only.";
    if (form.role.length > 100) e.role = "Role is too long (100 characters max).";
    if (form.department.length > 100) e.department = "Department is too long (100 characters max).";
    if (!form.joiningDate) e.joiningDate = "Joining date is required.";

    if (form.payType === "Fixed") {
      const amt = form.fixedPay.amount;
      if (amt === "" || !Number.isFinite(Number(amt)) || Number(amt) < 0)
        e.fixedAmount = "Enter a pay amount of 0 or more.";
    } else {
      let any = false;
      for (const f of RATE_FIELDS) {
        const v = form.variablePay[f.key];
        if (v === "") continue;
        any = true;
        const n = Number(v);
        if (!Number.isFinite(n) || n < RATE_MIN || n > RATE_MAX) e[f.key] = `₹${RATE_MIN} to ₹${RATE_MAX}`;
      }
      if (!any) e.variable = "Enter at least one rate.";
    }
    return e;
  };

  const submitForm = async (ev) => {
    ev.preventDefault();
    const { editing, data: f } = formState;
    const errors = validate(f);
    setFormState((s) => ({ ...s, errors }));
    if (Object.keys(errors).length) return;

    const rate = (v) => (v !== "" ? Number(v) : null);
    const isFixed = f.payType === "Fixed";
    const payload = {
      name: f.name.trim(), phone: f.phone.trim(), role: f.role.trim(), department: f.department.trim(),
      joiningDate: f.joiningDate, status: f.status, payType: f.payType,
      ...(isFixed
        ? { fixedPay: { amount: Number(f.fixedPay.amount), cycle: f.fixedPay.cycle || "Monthly" } }
        : { variablePay: Object.fromEntries(RATE_FIELDS.map((r) => [r.key, rate(f.variablePay[r.key])])) }),
    };

    try {
      setSaving(true);
      if (editing) await updateWorker(editing._id, payload);
      else await createWorker(payload);
      toast("success", editing ? "Worker updated." : "Worker added.");
      setFormState(null);
      loadWorkers();
    } catch (err) {
      toast("error", errMsg(err, "Couldn't save the worker. Try again."));
    } finally { setSaving(false); }
  };

  /* ---------- status + delete ---------- */
  const setStatus = async (w, next) => {
    try {
      setSaving(true);
      await updateWorker(w._id, { status: next });
      toast("success", `${w.name} is now ${next.toLowerCase()}.`);
      await loadWorkers();
      return true;
    } catch (err) {
      toast("error", errMsg(err, "Couldn't update the status."));
      return false;
    } finally { setSaving(false); }
  };

  const askDelete = (w) => setConfirm({
    title: `Delete ${w.name}?`,
    body: "Deleting removes the worker for good. Their past salary records and production entries will then show an unknown worker. Marking them inactive keeps that history and leaves them out of new salaries.",
    label: "Delete permanently", tone: "danger",
    alt: w.status !== "Inactive"
      ? { label: "Mark inactive instead", onClick: async () => { if (await setStatus(w, "Inactive")) setConfirm(null); } }
      : undefined,
    onConfirm: async () => {
      try {
        setSaving(true);
        await deleteWorker(w._id);
        toast("success", "Worker deleted.");
        setConfirm(null);
        loadWorkers();
      } catch (err) { toast("error", errMsg(err, "Couldn't delete the worker.")); }
      finally { setSaving(false); }
    },
  });

  /* ---------- view ---------- */
  const openView = useCallback(async (w) => {
    setViewState({ worker: w, salaries: [], loading: true });
    try {
      const res = await getSalaries({ worker: w._id, limit: 5, page: 1 });
      setViewState((v) => (v && v.worker._id === w._id ? { ...v, salaries: res?.data?.salaries || [], loading: false } : v));
    } catch {
      setViewState((v) => (v && v.worker._id === w._id ? { ...v, loading: false } : v));
    }
  }, []);
  const closeView = () => { if (!saving) setViewState(null); };

  /* ---------- form previews ---------- */
  const form = formState?.data;
  const monthlyAmount = form ? Number(form.fixedPay.amount) : 0;
  const dailyRate = form && form.payType === "Fixed" && form.fixedPay.cycle === "Monthly" && monthlyAmount > 0
    ? monthlyAmount / 30 : null;

  const pillText = att.loading ? "Loading" : att.failed ? "Couldn't load"
    : dirty ? "Unsaved changes" : att.saved.exists ? "Saved" : "Not marked yet";
  const pillClass = att.failed ? "bg-red-50 text-red-700 ring-red-200"
    : dirty ? "bg-sky-50 text-sky-700 ring-sky-200"
    : att.saved.exists ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <div className="w-full space-y-5 pb-10">
      <Toasts items={toasts} dismiss={dismissToast} />

      {/* ---------- header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0a1e3f]">Workers</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Mark daily attendance and keep worker details and pay structure up to date.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`${SECONDARY} w-10 px-0`} onClick={loadWorkers} aria-label="Refresh workers" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button type="button" className={PRIMARY} onClick={openCreate}><Plus size={16} />Add worker</button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <button type="button" onClick={loadWorkers} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      {/* ================================================================
       *  SUMMARY KPI CARDS  (now at the top)
       * ================================================================ */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total workers"
          value={stats.total}
          sub="Everyone on the roster"
          icon={Users}
          tone="navy"
          loading={loading}
        />
        <StatCard
          label="Active"
          value={stats.active}
          sub={stats.total - stats.active > 0 ? `${stats.total - stats.active} inactive` : "All active"}
          icon={UserCheck}
          tone="emerald"
          loading={loading}
        />
        <StatCard
          label="Fixed pay"
          value={stats.fixed}
          sub="Monthly / weekly salary"
          icon={Wallet}
          tone="sky"
          loading={loading}
        />
        <StatCard
          label="Variable pay"
          value={stats.variable}
          sub="Paid by production"
          icon={Layers}
          tone="indigo"
          loading={loading}
        />
      </section>

      {/* ================================================================
       *  DAILY ATTENDANCE
       * ================================================================ */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={18} className="text-slate-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Daily attendance</h2>
              <p className="text-xs text-slate-500">Each absence takes one day off a fixed-pay worker's salary.</p>
            </div>
          </div>
          <Badge className={pillClass}>{pillText}</Badge>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-1.5">
              <button type="button" className={`${SECONDARY} w-10 px-0`} aria-label="Previous day"
                onClick={() => goToDate(shiftDate(att.date, -1))} disabled={att.saving}>
                <ChevronLeft size={16} />
              </button>
              <input type="date" aria-label="Attendance date" className={`${inp(false)} w-44`}
                value={att.date} max={todayISO()} disabled={att.saving}
                onChange={(e) => goToDate(e.target.value)} />
              <button type="button" className={`${SECONDARY} w-10 px-0`} aria-label="Next day"
                onClick={() => goToDate(shiftDate(att.date, 1))} disabled={att.saving || att.date >= todayISO()}>
                <ChevronRight size={16} />
              </button>
              {att.date !== todayISO() && (
                <button type="button" className="ml-1 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                  onClick={() => goToDate(todayISO())}>Today</button>
              )}
            </div>

            <Segmented label="Attendance" value={att.allPresent ? "present" : "absent"} onChange={setMode}
              disabled={att.loading || att.failed || att.saving}
              options={[["present", "Everyone present"], ["absent", "Some absent"]]} />

            <div className="flex items-center gap-3 lg:ml-auto">
              {att.failed && (
                <button type="button" onClick={loadAttendance} className="text-sm font-medium text-red-600 underline underline-offset-2">Retry</button>
              )}
              <button type="button" className={PRIMARY} onClick={saveAtt}
                disabled={att.loading || att.failed || att.saving || (att.saved.exists && !dirty)}>
                {att.saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {att.saving ? "Saving…" : "Save attendance"}
              </button>
            </div>
          </div>

          {att.allPresent ? (
            <p className="text-sm text-slate-600">
              {att.loading ? "Loading attendance…"
                : `All ${eligible.length} active worker${eligible.length === 1 ? "" : "s"} present.`}
            </p>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{presentCount}</span> present,{" "}
                  <span className="font-semibold text-red-700">{att.absent.length}</span> absent
                </p>
                <button type="button" onClick={() => setPicker({ open: true, search: "" })}
                  className="text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
                  {att.absent.length === 0 ? "Choose absent workers" : "Edit"}
                </button>
              </div>
              {att.absent.length === 0 ? (
                <p className="text-sm text-slate-400">Nobody selected yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {att.absent.map((a) => (
                    <span key={a._id} className="inline-flex items-center gap-1 rounded-full bg-red-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                      {a.name}
                      <button type="button" onClick={() => toggleAbsent(a)} aria-label={`Remove ${a.name} from absent list`} className="rounded-full p-0.5 hover:bg-red-100">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!att.loading && !att.failed && !att.saved.exists && (
            <Note>Attendance hasn't been saved for this day. When salaries are generated, an unmarked day counts as everyone present.</Note>
          )}
        </div>
      </section>

      {/* ================================================================
       *  ATTENDANCE HISTORY
       * ================================================================ */}
      <AttendanceHistory
        hist={hist}
        busy={att.saving || saving}
        onReload={loadHistory}
        onOpenDate={openHistoryDate}
      />

      {/* ---------- filters ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, worker ID, phone or role" aria-label="Search workers"
            className={`${inp(false)} pl-9`} />
        </div>
        <Segmented label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={[["All", "All"], ["Active", "Active"], ["Inactive", "Inactive"]]} />
        <Segmented label="Pay type" value={payFilter} onChange={(v) => { setPayFilter(v); setPage(1); }}
          options={[["All", "Any pay"], ["Fixed", "Fixed"], ["Variable", "Variable"]]} />
        {hasFilters && (
          <button type="button" onClick={resetFilters} className="text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900">Clear filters</button>
        )}
      </div>

      {/* ---------- worker table ---------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-1 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-slate-900">Worker directory</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{filtered.length}</span>
          </div>
          <p className="text-xs text-slate-400">Click any row to view full details</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 bg-white text-left">
            <thead>
              <tr className="bg-white">
                <th className={`${TH2} border-b border-slate-200`}>Worker</th>
                <th className={`${TH2} border-b border-slate-200`}>Contact</th>
                <th className={`${TH2} border-b border-slate-200`}>Joined</th>
                <th className={`${TH2} border-b border-slate-200`}>Pay</th>
                <th className={`${TH2} border-b border-slate-200`}>Status</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    <td colSpan={5} className="border-b border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                          <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="hidden h-3 w-28 animate-pulse rounded bg-slate-100 sm:block" />
                        <div className="hidden h-3 w-24 animate-pulse rounded bg-slate-100 md:block" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-20 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <Inbox size={24} className="text-slate-400" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-800">
                      {hasFilters ? "No workers match these filters" : "No workers yet"}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                      {hasFilters ? "Try a different search or clear the filters." : "Add your first worker to start tracking attendance and pay."}
                    </p>
                    <div className="mt-5 flex justify-center gap-2">
                      {hasFilters && <button type="button" className={SECONDARY} onClick={resetFilters}>Clear filters</button>}
                      <button type="button" className={PRIMARY} onClick={openCreate}><Plus size={16} />Add worker</button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((w) => {
                  const active = w.status !== "Inactive";
                  const name = w.name || "Unknown";
                  return (
                    <tr
                      key={w._id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${name}`}
                      onClick={() => openView(w)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openView(w); } }}
                      className={`group cursor-pointer bg-white transition-colors duration-150 hover:bg-slate-50/70 focus-visible:bg-slate-50 focus-visible:outline-none ${active ? "" : "opacity-70"}`}
                    >
                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0">
                        <div className="flex items-center gap-3.5">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold shadow-sm ring-2 ring-white ${avatarTone(name)}`}>
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate text-sm font-semibold text-slate-900">{name}</p>
                            <p className="mt-0.5 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-500">
                              {w.workerId || "No ID"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0">
                        <p className="text-sm font-medium text-slate-800">{w.role || "—"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {w.phone || "No phone"}{w.department && ` · ${w.department}`}
                        </p>
                      </td>

                      <td className="whitespace-nowrap border-b border-slate-100 px-5 py-4 text-sm text-slate-700 group-last:border-0">
                        {fmtDate(w.joiningDate)}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0">
                        <TypeBadge type={w.payType} />
                        <PayCell worker={w} />
                      </td>

                      <td className="border-b border-slate-100 px-5 py-4 group-last:border-0">
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold tabular-nums text-slate-800">
              {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
            </span>{" "}
            of <span className="font-semibold tabular-nums text-slate-800">{filtered.length}</span>
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className={`${SECONDARY} h-9 px-3`} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft size={14} />Previous
            </button>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium tabular-nums text-slate-700">
              {safePage} <span className="text-slate-400">/ {totalPages}</span>
            </span>
            <button type="button" className={`${SECONDARY} h-9 px-3`} disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              Next<ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {viewState && (() => {
        const { worker: view, salaries: viewSalaries, loading: viewLoading } = viewState;
        return (
          <Modal
            title={view.name}
            subtitle={view.workerId || "No worker ID"}
            width="max-w-2xl"
            busy={saving}
            onClose={closeView}
            footer={<>
              <button type="button" className={`${DANGER} mr-auto`} disabled={saving}
                onClick={() => { const t = view; closeView(); askDelete(t); }}>
                <Trash2 size={15} />Delete
              </button>
              <button type="button" className={SECONDARY} disabled={saving}
                onClick={async () => {
                  const next = view.status === "Inactive" ? "Active" : "Inactive";
                  if (await setStatus(view, next)) closeView();
                }}>
                {view.status === "Inactive" ? <><UserCheck size={15} />Mark Active</> : <><UserX size={15} />Mark Inactive</>}
              </button>
              <button type="button" className={PRIMARY} disabled={saving}
                onClick={() => { const t = view; closeView(); openEdit(t); }}>
                <Pencil size={15} />Edit
              </button>
            </>}
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={view.status} />
                <TypeBadge type={view.payType} />
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
                  <Row label="Phone" value={view.phone || "—"} />
                  <Row label="Role" value={view.role || "—"} />
                  <Row label="Department" value={view.department || "—"} />
                  <Row label="Joined" value={fmtDate(view.joiningDate)} />
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pay structure</h3>
                {view.payType === "Fixed" ? (
                  <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <Row label={`Fixed amount (${(view.fixedPay?.cycle || "monthly").toLowerCase()})`} value={money(view.fixedPay?.amount)} />
                    {view.fixedPay?.cycle === "Monthly" && Number(view.fixedPay?.amount) > 0 && (
                      <Row label="Daily rate (monthly ÷ 30)" value={money(Number(view.fixedPay.amount) / 30)} tone="text-slate-600" />
                    )}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-medium text-slate-500">
                          <th className="px-3 py-2 text-left">Reel size</th>
                          <th className="px-3 py-2 text-right">Per kg</th>
                          <th className="px-3 py-2 text-right">Per reel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {RATE_FIELDS.map((f) => {
                          const v = view.variablePay?.[f.key];
                          const has = v != null;
                          return (
                            <tr key={f.key} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{f.label} reel</td>
                              <td className="px-3 py-2 text-right tabular-nums">{has ? money(v) : <span className="text-slate-400">—</span>}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{has ? money(Number(v) * f.kg) : <span className="text-slate-400">—</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <ReceiptText size={14} />Recent salaries
                </h3>
                {viewLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
                  </div>
                ) : viewSalaries.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">No salary records yet for this worker.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                    {viewSalaries.map((s) => {
                      const balance = Math.max(0, (s.netSalary || 0) - (s.paidAmount || 0) - (s.advanceAmount || 0));
                      return (
                        <li key={s._id} className="flex items-center gap-3 px-3.5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</p>
                            <p className="text-xs tabular-nums text-slate-500">
                              Net {money(s.netSalary)}
                              {balance > 0 && <span className="text-amber-700"> · {money(balance)} due</span>}
                            </p>
                          </div>
                          <SalaryStatusBadge status={s.paymentStatus} />
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

      {formState && (
        <Modal
          title={formState.editing ? "Edit worker" : "Add worker"}
          subtitle={formState.editing ? formState.editing.workerId || "Update details, pay structure or status." : "A worker ID is generated automatically."}
          width="max-w-2xl"
          busy={saving}
          onClose={closeForm}
          footer={<>
            <button type="button" className={SECONDARY} onClick={closeForm} disabled={saving}>Cancel</button>
            <button type="submit" form="worker-form" className={PRIMARY} disabled={saving}>
              {saving ? "Saving…" : formState.editing ? "Save changes" : "Add worker"}
            </button>
          </>}
        >
          <form id="worker-form" onSubmit={submitForm} noValidate className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" error={formState.errors.name} className="sm:col-span-2">
                  <input className={inp(formState.errors.name)} value={form.name} autoFocus
                    onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ravi Kumar" />
                </Field>
                <Field label="Phone" error={formState.errors.phone}>
                  <input className={inp(formState.errors.phone)} value={form.phone} inputMode="tel"
                    onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                </Field>
                <Field label="Joining date" error={formState.errors.joiningDate} hint="Salary is counted from this date.">
                  <input type="date" className={inp(formState.errors.joiningDate)} value={form.joiningDate}
                    onChange={(e) => set("joiningDate", e.target.value)} />
                </Field>
                <Field label="Role" error={formState.errors.role}>
                  <input className={inp(formState.errors.role)} value={form.role}
                    onChange={(e) => set("role", e.target.value)} placeholder="e.g. Machine operator" />
                </Field>
                <Field label="Department" error={formState.errors.department}>
                  <input className={inp(formState.errors.department)} value={form.department}
                    onChange={(e) => set("department", e.target.value)} placeholder="e.g. Production" />
                </Field>
                <Field label="Status" hint="Inactive workers are left out of new salaries.">
                  <select className={inp(false)} value={form.status} onChange={(e) => set("status", e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </Field>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Pay structure</h3>
                <Segmented label="Pay type" value={form.payType}
                  onChange={(v) => set("payType", v)}
                  options={[["Fixed", "Fixed"], ["Variable", "Variable"]]} />
              </div>

              {form.payType === "Fixed" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Pay amount (₹)" error={formState.errors.fixedAmount}
                      hint={dailyRate ? `About ${money(dailyRate)} per day (monthly pay ÷ 30).` : undefined}>
                      <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0"
                        className={inp(formState.errors.fixedAmount)} value={form.fixedPay.amount}
                        onChange={(e) => set(["fixedPay", "amount"], e.target.value, "fixedAmount")} />
                    </Field>
                    <Field label="Pay cycle">
                      <select className={inp(false)} value={form.fixedPay.cycle}
                        onChange={(e) => set(["fixedPay", "cycle"], e.target.value)}>
                        <option value="Monthly">Monthly</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Daily">Daily</option>
                      </select>
                    </Field>
                  </div>
                  {form.fixedPay.cycle !== "Monthly" && (
                    <Note tone="warn">Salary generation treats this amount as a monthly salary. Weekly and daily cycles are saved but aren't calculated differently yet.</Note>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {formState.errors.variable && <p className="text-xs text-red-600">{formState.errors.variable}</p>}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {RATE_FIELDS.map((f) => {
                      const raw = form.variablePay[f.key];
                      const n = Number(raw);
                      const valid = raw !== "" && n >= RATE_MIN && n <= RATE_MAX;
                      return (
                        <Field key={f.key} label={`${f.label} reel`} error={formState.errors[f.key]}
                          hint={valid ? `${money(n * f.kg)} per reel` : undefined}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                            <input type="number" inputMode="decimal" min={RATE_MIN} max={RATE_MAX} step="0.01" placeholder="0.00"
                              className={`${inp(formState.errors[f.key])} pl-7`} value={raw}
                              onChange={(e) => set(["variablePay", f.key], e.target.value)} />
                          </div>
                        </Field>
                      );
                    })}
                  </div>
                  <Note>Rates are per kg and must be between ₹{RATE_MIN} and ₹{RATE_MAX}. A size left blank pays ₹0, so fill in every size this worker makes.</Note>
                </div>
              )}
            </section>
          </form>
        </Modal>
      )}

      {picker?.open && (
        <Modal
          title="Who is absent?"
          subtitle={`${fmtDate(att.date)}. Only active workers who had joined by then are listed.`}
          width="max-w-md"
          onClose={closePicker}
          footer={<>
            <span className="mr-auto self-center text-sm text-slate-500">{att.absent.length} selected</span>
            <button type="button" className={PRIMARY} onClick={closePicker}>Done</button>
          </>}
        >
          <input className={`${inp(false)} mb-3`} placeholder="Search workers" aria-label="Search workers"
            value={picker.search} onChange={(e) => setPicker((p) => ({ ...p, search: e.target.value }))} />
          {pickerList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No workers found.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {pickerList.map((w) => {
                const checked = att.absent.some((a) => a._id === w._id);
                return (
                  <li key={w._id}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 ${checked ? "bg-red-50/60" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAbsent(w)} className="h-4 w-4 accent-red-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{w.name}</span>
                        {w.role && <span className="block truncate text-xs text-slate-500">{w.role}</span>}
                      </span>
                      {w.payType && <TypeBadge type={w.payType} />}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Absences only change fixed-pay salaries. Variable-pay workers are paid for what they produce.</p>
        </Modal>
      )}

      {confirm && (
        <Modal
          title={confirm.title}
          width="max-w-md"
          busy={saving}
          onClose={() => setConfirm(null)}
          footer={<>
            <button type="button" className={SECONDARY} onClick={() => setConfirm(null)} disabled={saving}>Cancel</button>
            {confirm.alt && (
              <button type="button" className={SECONDARY} onClick={confirm.alt.onClick} disabled={saving}>{confirm.alt.label}</button>
            )}
            <button type="button" className={confirm.tone === "danger" ? DANGER : PRIMARY} onClick={confirm.onConfirm} disabled={saving}>
              {saving ? "Working…" : confirm.label}
            </button>
          </>}
        >
          <p className="text-sm leading-6 text-slate-600">{confirm.body}</p>
        </Modal>
      )}
    </div>
  );
}

export default Workers;