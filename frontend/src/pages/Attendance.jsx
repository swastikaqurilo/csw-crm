import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, X, CheckCircle2, AlertTriangle, Loader2, Save, Check, Clock, Search,
  CalendarDays, Pencil, ChevronLeft, ChevronRight, RefreshCw, Eye, Users,
  UserCheck, UserX, TrendingUp,
} from "lucide-react";
import { getWorkers, getAttendance, saveAttendance, getAttendanceHistory } from "../api/api";

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (v) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayISO = () => toISO(new Date());
const parseDate = (v) => {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
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
const fmtLong = (v) => {
  if (!v) return "";
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
};
const errMsg = (err, fb) => {
  const d = err?.response?.data;
  return Array.isArray(d?.errors) && d.errors.length ? d.errors.join(", ") : d?.message || fb;
};
const initials = (name = "") => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const HIST_PAGE_SIZE = 8;
const DEFAULT_LOGIN = "10:00";
const DEFAULT_LOGOUT = "19:00";

/* Shared look: white cards, slate borders, navy only for primary actions. */
const TH2 = "whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const BTN = "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a1e3f]/30 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY = `${BTN} h-9 border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50`;
const PRIMARY = `${BTN} bg-[#0a1e3f] text-white shadow-sm hover:bg-[#06142b]`;
const TIME_INPUT = "h-8 w-[92px] rounded-md border border-slate-300 bg-white px-1.5 text-xs font-medium tabular-nums text-slate-800 outline-none transition focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10";
const CARD = "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

const useEscape = (handler) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") handler(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
};

function Avatar({ name, className = "h-9 w-9" }) {
  return (
    <span className={`flex ${className} shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600`}>
      {initials(name)}
    </span>
  );
}

function AbsentTag() {
  return (
    <span className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      Absent
    </span>
  );
}

function StatCell({ label, value, danger }) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${danger ? "text-red-700" : "text-[#0a1e3f]"}`}>{value}</p>
    </div>
  );
}

function Modal({ label, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl">
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, date, onClose, disabled }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[#0a1e3f]">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{fmtLong(date)}</p>
      </div>
      <button type="button" onClick={onClose} disabled={disabled} aria-label="Close"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
        <X size={18} />
      </button>
    </div>
  );
}

/* ================================================================
 *  MARK / EDIT MODAL
 * ================================================================ */
function MarkModal({ date, workers, initialRecords, saving, onClose, onSave }) {
  useEscape(onClose);

  const [records, setRecords] = useState(() => {
    const base = {};
    for (const w of workers) {
      const existing = initialRecords?.[String(w._id)];
      base[String(w._id)] = existing
        ? { ...existing }
        : { absent: false, loginTime: DEFAULT_LOGIN, logoutTime: DEFAULT_LOGOUT };
    }
    return base;
  });

  const [defaultLogin, setDefaultLogin] = useState(DEFAULT_LOGIN);
  const [defaultLogout, setDefaultLogout] = useState(DEFAULT_LOGOUT);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | present | absent

  const setAbsent = (id, absent) =>
    setRecords((prev) => ({ ...prev, [id]: { ...prev[id], absent } }));

  const setTime = (id, field, value) =>
    setRecords((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const applyDefaultsToPresent = () => {
    setRecords((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!next[id].absent) next[id] = { ...next[id], loginTime: defaultLogin, logoutTime: defaultLogout };
      }
      return next;
    });
  };

  const markAll = (absent) => {
    setRecords((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) next[id] = { ...next[id], absent };
      return next;
    });
  };

  const absentCount = Object.values(records).filter((r) => r.absent).length;
  const presentCount = workers.length - absentCount;

  const searchTerm = search.trim().toLowerCase();
  const visible = useMemo(() => {
    return workers.filter((w) => {
      const r = records[String(w._id)];
      if (filter === "present" && r?.absent) return false;
      if (filter === "absent" && !r?.absent) return false;
      if (!searchTerm) return true;
      return (
        String(w.name || "").toLowerCase().includes(searchTerm) ||
        String(w.role || "").toLowerCase().includes(searchTerm) ||
        String(w.workerId || "").toLowerCase().includes(searchTerm)
      );
    });
  }, [workers, records, searchTerm, filter]);

  const submit = () => {
    const absentWorkerIds = workers.filter((w) => records[String(w._id)]?.absent).map((w) => w._id);
    onSave({
      date,
      allPresent: absentWorkerIds.length === 0,
      absentWorkerIds,
      records: workers.map((w) => {
        const r = records[String(w._id)];
        return {
          worker: w._id,
          status: r.absent ? "Absent" : "Present",
          loginTime: r.absent ? null : r.loginTime,
          logoutTime: r.absent ? null : r.logoutTime,
        };
      }),
    });
  };
  const FILTERS = [
    { id: "all", label: "All", n: workers.length },
    { id: "present", label: "Present", n: presentCount },
    { id: "absent", label: "Absent", n: absentCount },
  ];

  return (
    <Modal label="Mark attendance">
      <ModalHeader title="Mark attendance" date={date} onClose={onClose} disabled={saving} />

      {/* default hours */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Clock size={13} className="text-slate-400" /> Default hours
          </span>
          <div className="flex items-center gap-1.5">
            <input type="time" value={defaultLogin} onChange={(e) => setDefaultLogin(e.target.value)} className={TIME_INPUT} />
            <span className="text-xs text-slate-400">to</span>
            <input type="time" value={defaultLogout} onChange={(e) => setDefaultLogout(e.target.value)} className={TIME_INPUT} />
          </div>
          {/* <button type="button" onClick={applyDefaultsToPresent}
            className="ml-auto rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
            Apply to everyone present
          </button> */}
        </div>
      </div>

      {/* search + filters */}
      <div className="shrink-0 space-y-2.5 border-b border-slate-200 px-5 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role or ID"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm outline-none transition focus:border-[#0a1e3f] focus:ring-2 focus:ring-[#0a1e3f]/10" />
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => markAll(false)} className={SECONDARY}>All present</button>
            <button type="button" onClick={() => markAll(true)} className={SECONDARY}>All absent</button>
          </div>
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                filter === f.id ? "bg-[#0a1e3f] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {f.label} <span className={filter === f.id ? "text-white/60" : "text-slate-400"}>{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* worker list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-100">
          {visible.map((w) => {
            const id = String(w._id);
            const r = records[id];
            const name = w.name || "Unknown";
            return (
              <li key={w._id} className={`px-4 py-3 transition-colors sm:px-5 ${r.absent ? "bg-slate-50" : "hover:bg-slate-50/60"}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1 basis-36">
                    <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                    <p className="truncate text-xs text-slate-500">{w.role || w.workerId || "—"}</p>
                  </div>

                  <div role="group" aria-label={`Status for ${name}`}
                    className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
                    <button type="button" aria-pressed={!r.absent} onClick={() => setAbsent(id, false)}
                      className={`rounded-md px-3 py-1.5 transition ${
                        !r.absent ? "bg-[#0a1e3f] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                      Present
                    </button>
                    <button type="button" aria-pressed={r.absent} onClick={() => setAbsent(id, true)}
                      className={`rounded-md px-3 py-1.5 transition ${
                        r.absent ? "bg-white text-red-700 shadow-sm ring-1 ring-red-200" : "text-slate-500 hover:text-slate-800"}`}>
                      Absent
                    </button>
                  </div>

                  {!r.absent && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input type="time" aria-label={`${name} login time`} value={r.loginTime}
                        onChange={(e) => setTime(id, "loginTime", e.target.value)} className={TIME_INPUT} />
                      <span className="text-xs text-slate-300">–</span>
                      <input type="time" aria-label={`${name} logout time`} value={r.logoutTime}
                        onChange={(e) => setTime(id, "logoutTime", e.target.value)} className={TIME_INPUT} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-5 py-14 text-center">
              <p className="text-sm font-medium text-slate-700">No workers found</p>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm ? `Nothing matches "${search}".` : "No one is in this group right now."}
              </p>
            </li>
          )}
        </ul>
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
        {/* <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[#0a1e3f] transition-all duration-300" style={{ width: `${presentPct}%` }} />
        </div> */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            <span className="font-semibold tabular-nums text-slate-900">{presentCount}</span> present,{" "}
            <span className={`font-semibold tabular-nums ${absentCount ? "text-red-700" : "text-slate-900"}`}>{absentCount}</span> absent
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving}
              className={`${SECONDARY} h-10 flex-1 px-4 sm:flex-none`}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={saving}
              className={`${PRIMARY} h-10 flex-1 px-5 sm:flex-none`}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ViewModal({ date, record, workers, onClose, onEdit }) {
  useEscape(onClose);

  const absentSet = new Set((record?.absentWorkers || []).map((w) => String(w._id)));
  const recordsByWorker = new Map();
  for (const r of record?.records || []) {
    recordsByWorker.set(String(r.worker?._id || r.worker), r);
  }

  const absentCount = absentSet.size;
  const presentCount = workers.length - absentCount;

  // absent first: that's what people open this to check
  const ordered = [...workers].sort(
    (a, b) => Number(absentSet.has(String(b._id))) - Number(absentSet.has(String(a._id)))
  );

  return (
    <Modal label="Attendance details">
      <ModalHeader title="Attendance details" date={date} onClose={onClose} />

      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <StatCell label="Present" value={presentCount} />
          <StatCell label="Absent" value={absentCount} danger={absentCount > 0} />
          <StatCell label="Total" value={workers.length} />
        </div>
        {record?.updatedAt && (
          <p className="mt-3 text-xs text-slate-500">
            Last saved at <span className="font-medium text-slate-700">{fmtTime(record.updatedAt)}</span>
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-100">
          {ordered.map((w) => {
            const sid = String(w._id);
            const isAbsent = absentSet.has(sid);
            const rec = recordsByWorker.get(sid);
            const name = w.name || "Unknown";
            return (
              <li key={w._id} className={`flex items-center gap-3 px-5 py-3 ${isAbsent ? "bg-slate-50" : ""}`}>
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-500">{w.role || w.workerId || "—"}</p>
                </div>
                {isAbsent ? (
                  <AbsentTag />
                ) : (
                  <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600">
                    {rec?.loginTime || DEFAULT_LOGIN} – {rec?.logoutTime || DEFAULT_LOGOUT}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${SECONDARY} h-10 px-4`}>Close</button>
          <button type="button" onClick={onEdit} className={`${PRIMARY} h-10 px-4`}>
            <Pencil size={14} /> Edit attendance
          </button>
        </div>
      </div>
    </Modal>
  );
}
// function DeleteConfirm({ open, date, deleting, onCancel, onConfirm }) {
//   if (!open) return null;
//   return (
//     <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={deleting ? undefined : onCancel}>
//       <div role="alertdialog" aria-modal="true" className="w-full max-w-[400px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
//         <div className="flex items-start gap-3 px-5 py-5">
//           <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600">
//             <AlertTriangle size={18} />
//           </div>
//           <div className="min-w-0 flex-1">
//             <h3 className="text-base font-semibold text-slate-900">Delete attendance?</h3>
//             <p className="mt-1.5 text-sm leading-6 text-slate-500">
//               Attendance for <span className="font-medium text-slate-700">{fmtLong(date)}</span> will be removed.
//               Salaries won't be affected — an unmarked day counts as everyone present.
//             </p>
//           </div>
//         </div>
//         <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
//           <button type="button" onClick={onCancel} disabled={deleting} className={`${SECONDARY} h-10 px-4`}>Cancel</button>
//           {/* <button type="button" onClick={onConfirm} disabled={deleting}
//             className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
//             {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
//             {deleting ? "Deleting…" : "Delete"}
//           </button> */}
//         </div>
//       </div>
//     </div>
//   );
// }

function AttendanceHistory({ hist, onReload, onView, onEdit, onDelete, busy }) {
  return (
    <section className={CARD}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={18} className="text-slate-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Attendance history</h2>
            <p className="text-xs text-slate-500">Every day that has been marked, newest first.</p>
          </div>
        </div>
        <button type="button" className={SECONDARY} onClick={() => onReload(hist.page)}
          disabled={hist.loading || busy} title="Refresh history">
          <RefreshCw size={14} className={hist.loading ? "animate-spin" : ""} />Refresh
        </button>
      </div>

      {hist.error ? (
        <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-red-700">
          <span>{hist.error}</span>
          <button type="button" onClick={() => onReload(1)} className="shrink-0 font-medium underline underline-offset-2">Try again</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 bg-white text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className={`${TH2} border-b border-slate-200`}>Date</th>
                <th className={`${TH2} border-b border-slate-200`}>Present</th>
                <th className={`${TH2} border-b border-slate-200`}>Absent</th>
                {/* <th className={`${TH2} w-48 border-b border-slate-200`}>Turnout</th> */}
                <th className={`${TH2} border-b border-slate-200`}>Marked at</th>
                <th className={`${TH2} border-b border-slate-200 text-right`}>Actions</th>
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
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                      <CalendarDays size={20} className="text-slate-400" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">No attendance marked yet</p>
                    <p className="mt-1 text-sm text-slate-500">Mark today above and it will show up here.</p>
                  </td>
                </tr>
              ) : (
                hist.items.map((rec, idx) => {
                  const iso = toISO(rec?.date ?? rec?.attendanceDate ?? rec?.createdAt);
                  const absentN = rec.allPresent ? 0 : (rec.absentWorkers?.length || 0);
                  const presentN =
                    rec.presentCount ??
                    (rec.totalWorkers != null ? Math.max(0, rec.totalWorkers - absentN) : null);
                  const totalN = presentN != null ? presentN + absentN : 0;
                  const pct = totalN > 0 ? Math.round((presentN / totalN) * 100) : null;
                  const isToday = iso === todayISO();
                  return (
                    <tr key={rec._id || iso || idx} className="group bg-white transition-colors hover:bg-slate-50/70">
                      <td className="border-b border-slate-100 px-5 py-3.5 group-last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap text-sm font-semibold text-slate-900">{fmtDate(iso || rec.date)}</span>
                          {isToday && (
                            <span className="rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">Today</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{fmtWeekday(iso || rec.date)}</p>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3.5 text-sm tabular-nums group-last:border-0">
                        {presentN != null
                          ? <span className="font-semibold text-slate-900">{presentN}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3.5 text-sm tabular-nums group-last:border-0">
                        {absentN === 0
                          ? <span className="text-slate-400">0</span>
                          : <span className="font-semibold text-red-700">{absentN}</span>}
                      </td>
                      {/* <td className="border-b border-slate-100 px-5 py-3.5 group-last:border-0">
                        {pct != null ? (
                          <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-[#0a1e3f]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums text-slate-600">{pct}%</span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td> */}
                      <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3.5 text-xs text-slate-500 group-last:border-0">
                        {fmtTime(rec.updatedAt || rec.createdAt)}
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3.5 text-right group-last:border-0">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => onView(iso)} disabled={busy || !iso}
                            title="View" aria-label="View"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40">
                            <Eye size={15} />
                          </button>
                          <button type="button" onClick={() => onEdit(iso)} disabled={busy || !iso}
                            title="Edit" aria-label="Edit"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-[#0a1e3f] disabled:opacity-40">
                            <Pencil size={15} />
                          </button>
                          {/* <button type="button" onClick={() => onDelete(iso)} disabled={busy || !iso}
                            title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700">
                            <Trash2 size={15} />
                          </button> */}
                        </div>
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
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-500">
            Page <span className="font-semibold tabular-nums text-slate-800">{hist.page}</span> of{" "}
            <span className="font-semibold tabular-nums text-slate-800">{hist.totalPages}</span>
            {hist.total > 0 && <> -  <span className="font-semibold tabular-nums text-slate-800">{hist.total}</span> day{hist.total === 1 ? "" : "s"} marked</>}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className={SECONDARY}
              disabled={hist.loading || hist.page <= 1} onClick={() => onReload(hist.page - 1)}>
              <ChevronLeft size={14} />Newer
            </button>
            <button type="button" className={SECONDARY}
              disabled={hist.loading || hist.page >= hist.totalPages} onClick={() => onReload(hist.page + 1)}>
              Older<ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ================================================================
 *  MAIN
 * ================================================================ */
function Attendance() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);
  const [toast, setToast] = useState(null);

  const [mode, setMode] = useState(null); // "mark" | "view" | "delete"
  const [activeDate, setActiveDate] = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);

  const [hist, setHist] = useState({
    items: [], loading: true, error: "", page: 1, totalPages: 1, total: 0,
  });

  const flash = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* ---------- loaders ---------- */
  const loadWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const all = [];
      let p = 1, totalPages = 1;
      do {
        const { data } = await getWorkers({ page: p, limit: 100 });
        if (!data?.success) throw new Error(data?.message || "Failed to load workers");
        all.push(...(data.data || []));
        totalPages = data.pagination?.totalPages || 1;
        p += 1;
      } while (p <= totalPages && p <= 20);
      setWorkers(all.filter((w) => w.status !== "Inactive"));
    } catch (err) {
      flash("error", errMsg(err, "Couldn't load workers."));
    } finally { setLoading(false); }
  }, []);

  const loadToday = useCallback(async () => {
    try {
      const { data } = await getAttendance(todayISO());
      setTodayRecord(data?.data || null);
    } catch { setTodayRecord(null); }
  }, []);

  const loadHistory = useCallback(async (targetPage = 1) => {
    const wanted = Math.max(1, Number(targetPage) || 1);
    try {
      setHist((h) => ({ ...h, loading: true, error: "" }));
      const { data } = await getAttendanceHistory({ page: wanted, limit: HIST_PAGE_SIZE });
      const payload = data?.data ?? {};
      const items = Array.isArray(payload) ? payload : (payload.attendance || payload.records || payload.history || []);
      const pg = data?.pagination || payload.pagination || {};
      setHist({
        items, loading: false, error: "",
        page: pg.page || wanted,
        totalPages: Math.max(1, pg.totalPages || 1),
        total: pg.total ?? items.length,
      });
    } catch (err) {
      setHist((h) => ({ ...h, loading: false, error: errMsg(err, "Couldn't load attendance history.") }));
    }
  }, []);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);
  useEffect(() => { loadToday(); loadHistory(1); }, [loadToday, loadHistory]);

  /* ---------- open a modal with fresh data ---------- */
  const openMark = async (date) => {
    const target = date || todayISO();
    try {
      const { data } = await getAttendance(target);
      setActiveRecord(data?.data || null);
    } catch { setActiveRecord(null); }
    setActiveDate(target);
    setMode("mark");
  };

  const openView = async (date) => {
    try {
      const { data } = await getAttendance(date);
      if (!data?.data) {
        flash("error", "No record found for this date.");
        return;
      }
      setActiveRecord(data.data);
      setActiveDate(date);
      setMode("view");
    } catch (err) {
      flash("error", errMsg(err, "Couldn't load details."));
    }
  };

//   const openDelete = (date) => {
//     setActiveDate(date);
//     setMode("delete");
//   };

  const closeModal = () => {
    if (saving || deleting) return;
    setMode(null);
    setActiveDate(null);
    setActiveRecord(null);
  };

  /* ---------- save ---------- */
  const handleSave = async (payload) => {
    try {
      setSaving(true);
      await saveAttendance(payload);
      closeModal();
      await Promise.all([loadToday(), loadHistory(1)]);
      flash("success", "Attendance saved.");
    } catch (err) {
      flash("error", errMsg(err, "Couldn't save attendance."));
    } finally { setSaving(false); }
  };

  /* ---------- delete ---------- */
//   const handleDelete = async () => {
//     try {
//       setDeleting(true);
//       await deleteAttendance(activeDate);
//       closeModal();
//       await Promise.all([loadToday(), loadHistory(1)]);
//       flash("success", "Attendance deleted.");
//     } catch (err) {
//       flash("error", errMsg(err, "Couldn't delete attendance."));
//     } finally { setDeleting(false); }
//   };

  const initialRecords = useMemo(() => {
    const source = activeDate === todayISO() ? (activeRecord ?? todayRecord) : activeRecord;
    if (!source) return null;
    const map = {};
    const absentSet = new Set((source.absentWorkers || []).map((w) => String(w._id)));
    const byWorker = new Map();
    for (const r of source.records || []) {
      byWorker.set(String(r.worker?._id || r.worker), r);
    }
    for (const w of workers) {
      const sid = String(w._id);
      const saved = byWorker.get(sid);
      if (saved) {
        map[sid] = {
          absent: saved.status === "Absent",
          loginTime: saved.loginTime || DEFAULT_LOGIN,
          logoutTime: saved.logoutTime || DEFAULT_LOGOUT,
        };
      } else {
        map[sid] = {
          absent: absentSet.has(sid),
          loginTime: DEFAULT_LOGIN,
          logoutTime: DEFAULT_LOGOUT,
        };
      }
    }
    return map;
  }, [activeRecord, todayRecord, workers, activeDate]);

  const todayExists = Boolean(todayRecord);
  const todaysAbsent = todayRecord?.allPresent ? 0 : (todayRecord?.absentWorkers?.length || 0);
  const todaysPresent = todayExists ? Math.max(0, workers.length - todaysAbsent) : 0;

  return (
    <div className="w-full space-y-5 pb-10">
      {toast && (
        <div role="status" aria-live="polite"
          className="fixed right-4 top-4 z-[60] flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-lg">
          {toast.type === "error"
            ? <AlertTriangle size={16} className="text-red-600" />
            : <CheckCircle2 size={16} className="text-emerald-600" />}
          {toast.msg}
        </div>
      )}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0a1e3f]">Attendance</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Mark today with the default hours, then change anyone who was absent or worked different hours.
        </p>
      </header>

      {/* TODAY */}
            {/* KPI STAT CARDS */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total Workers"
          value={workers.length}
        //   sub="Active roster"
          icon={Users}
          tone="navy"
          loading={loading}
        />
        <StatCard
          label="Present Today"
          value={todayExists ? todaysPresent : "—"}
        //   sub={todayExists ? "Marked today" : "Not marked yet"}
          icon={UserCheck}
          tone="emerald"
        />
        <StatCard
          label="Absent Today"
          value={todayExists ? todaysAbsent : "—"}
        //   sub={todayExists ? (todaysAbsent === 0 ? "Perfect attendance" : "Check details") : "Not marked yet"}
          icon={UserX}
          tone="rose"
        />
        <StatCard
          label="Days Recorded"
          value={hist.total || 0}
        //   sub="Total attendance entries"
          icon={TrendingUp}
          tone="indigo"
          loading={hist.loading}
        />
      </section>

      {/* TODAY BAR */}
      <section className={CARD}>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Today</h2>
              {todayExists ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                  <CheckCircle2 size={12} className="text-emerald-600" /> Marked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                  <Clock size={12} className="text-slate-400" /> {loading ? "Loading…" : "Not marked yet"}
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-semibold text-[#0a1e3f]">{fmtLong(todayISO())}</p>
          </div>

          <button
            type="button"
            onClick={() => openMark(todayISO())}
            disabled={loading || workers.length === 0}
            className={`${PRIMARY} h-10 px-4 sm:shrink-0`}
          >
            {todayExists ? <Pencil size={15} /> : <Plus size={16} strokeWidth={2.5} />}
            {todayExists ? "Edit today's attendance" : "Mark attendance"}
          </button>
        </div>
      </section>

      {/* HISTORY */}
      <AttendanceHistory
        hist={hist}
        busy={saving || deleting}
        onReload={loadHistory}
        onView={openView}
        onEdit={openMark}
        // onDelete={openDelete}
      />

      {/* MODALS */}
      {mode === "mark" && activeDate && (
        <MarkModal
          date={activeDate}
          workers={workers}
          initialRecords={initialRecords}
          saving={saving}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {mode === "view" && activeDate && activeRecord && (
        <ViewModal
          date={activeDate}
          record={activeRecord}
          workers={workers}
          onClose={closeModal}
          onEdit={() => { setMode("mark"); }}
        />
      )}

      {/* {mode === "delete" && activeDate && (
        <DeleteConfirm
          open
          date={activeDate}
          deleting={deleting}
          onCancel={closeModal}
          onConfirm={handleDelete}
        />
      )} */}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, tone = "navy", loading }) {
  const tones = {
    navy: { bar: "from-slate-400 to-[#0a1e3f]", icon: "from-slate-100 to-slate-200 text-[#0a1e3f]" },
    emerald: { bar: "from-emerald-400 to-teal-600", icon: "from-emerald-50 to-teal-100 text-emerald-700" },
    rose: { bar: "from-rose-400 to-red-600", icon: "from-rose-50 to-red-100 text-rose-700" },
    indigo: { bar: "from-indigo-400 to-violet-600", icon: "from-indigo-50 to-violet-100 text-indigo-700" },
  };
  const t = tones[tone] || tones.navy;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-10px_rgba(15,23,42,0.15)]">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${t.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900">
            {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" /> : value}
          </p>
          {sub && <p className="mt-1 truncate text-[11px] text-slate-500">{loading ? "…" : sub}</p>}
        </div>
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.icon} transition-transform duration-200 group-hover:scale-110`}>
            <Icon size={16} strokeWidth={2.2} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Attendance;