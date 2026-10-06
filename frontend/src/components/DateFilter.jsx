import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";

export const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "thisYear", label: "This Year" },
  { key: "all", label: "All Time" },
];

export const toISODate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const getPresetRange = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case "today":
      return { from: toISODate(today), to: toISODate(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: toISODate(y), to: toISODate(y) };
    }
    case "last7": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: toISODate(from), to: toISODate(today) };
    }
    case "last30": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: toISODate(from), to: toISODate(today) };
    }
    case "thisMonth": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toISODate(from), to: toISODate(today) };
    }
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toISODate(from), to: toISODate(to) };
    }
    case "thisYear": {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: toISODate(from), to: toISODate(today) };
    }
    case "all":
    default:
      return { from: "", to: "" };
  }
};

export const isWithinRange = (recordDate, from, to) => {
  if (!from && !to) return true;
  if (!recordDate) return false;
  const d = new Date(recordDate);
  d.setHours(0, 0, 0, 0);
  if (from) {
    const f = new Date(from);
    f.setHours(0, 0, 0, 0);
    if (d < f) return false;
  }
  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    if (d > t) return false;
  }
  return true;
};

export default function DateFilter({
  from,
  to,
  onChange,
  accent = "#2563EB",
  showPresets = true,
}) {
  const [preset, setPreset] = useState("all");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 340 });

  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const hasFilter = Boolean(from || to);

  /* ---------- panel positioning ---------- */
  const updateCoords = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelWidth = Math.min(360, window.innerWidth - 24);

    // Try to align panel's right edge with button's right edge
    let left = r.right - panelWidth;
    // Clamp so it never goes off the left/right edge of the screen
    if (left < 12) left = 12;
    if (left + panelWidth > window.innerWidth - 12) {
      left = window.innerWidth - 12 - panelWidth;
    }

    // Try to open downward; flip up if there's not enough space below
    const panelHeightEstimate = 260;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUpward = spaceBelow < panelHeightEstimate && r.top > panelHeightEstimate;

    setCoords({
      top: openUpward ? r.top - 8 : r.bottom + 8,
      left,
      width: panelWidth,
      openUpward,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updateCoords();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  /* ---------- close on Escape ---------- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const applyPreset = (key) => {
    setPreset(key);
    const { from: f, to: t } = getPresetRange(key);
    onChange({ from: f, to: t, preset: key });
  };

  const clear = () => {
    setPreset("all");
    onChange({ from: "", to: "", preset: "all" });
  };

  return (
    <>
      {/* ---------- Toggle button ---------- */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors sm:w-auto"
        style={{
          borderColor: hasFilter ? accent : "#E5E7EB",
          background: hasFilter ? `${accent}15` : "#fff",
          color: hasFilter ? accent : "#374151",
        }}
      >
        <CalendarDays size={15} className="shrink-0" />

        <span className="min-w-0 truncate">
          {hasFilter ? `${from || "…"} → ${to || "…"}` : "Date Filter"}
        </span>

        {hasFilter && (
          <X
            size={14}
            className="shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
          />
        )}
      </button>

      {/* ---------- Panel (via portal — escapes overflow-hidden) ---------- */}
      {open &&
        createPortal(
          <>
            {/* click-away backdrop */}
            <div
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9998,
              }}
            />

            <div
              ref={panelRef}
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 9999,
                transform: coords.openUpward ? "translateY(-100%)" : undefined,
              }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              {showPresets && (
                <div className="mb-3.5 flex flex-wrap gap-2">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p.key)}
                      className="rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors"
                      style={{
                        borderColor: preset === p.key ? accent : "#E5E7EB",
                        background: preset === p.key ? `${accent}15` : "#fff",
                        color: preset === p.key ? accent : "#374151",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* From / To — stack on narrow panel, side-by-side when there's room */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <label className="w-10 shrink-0 text-[13px] text-slate-500">
                    From
                  </label>
                  <input
                    type="date"
                    value={from || ""}
                    onChange={(e) =>
                      onChange({ from: e.target.value, to, preset: "custom" })
                    }
                    className="h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                  />
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <label className="w-6 shrink-0 text-[13px] text-slate-500">
                    To
                  </label>
                  <input
                    type="date"
                    value={to || ""}
                    onChange={(e) =>
                      onChange({ from, to: e.target.value, preset: "custom" })
                    }
                    className="h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                  />
                </div>
              </div>

              {hasFilter && (
                <button
                  type="button"
                  onClick={clear}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-100"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}