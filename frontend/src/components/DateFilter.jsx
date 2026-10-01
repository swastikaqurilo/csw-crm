import { useState } from "react";
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

// Utility to check if a record falls within range
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

/**
 * Reusable DateFilter component.
 *
 * Props:
 *  - from, to: controlled string values (YYYY-MM-DD)
 *  - onChange({ from, to, preset }): callback
 *  - accent: optional color (defaults to blue)
 *  - showPresets: boolean, default true
 */
export default function DateFilter({
  from,
  to,
  onChange,
  accent = "#2563EB",
  showPresets = true,
}) {
  const [preset, setPreset] = useState("all");
  const [open, setOpen] = useState(false);

  const hasFilter = Boolean(from || to);

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
    <div style={{ position: "relative" }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((s) => !s)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${hasFilter ? accent : "#E5E7EB"}`,
          background: hasFilter ? `${accent}15` : "#fff",
          color: hasFilter ? accent : "#374151",
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <CalendarDays size={16} />
        {hasFilter ? `${from || "…"} → ${to || "…"}` : "Date Filter"}
        {hasFilter && (
          <X
            size={14}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            style={{ cursor: "pointer" }}
          />
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* click-away */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              zIndex: 50,
              minWidth: 340,
              padding: 16,
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            }}
          >
            {showPresets && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.key)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: `1px solid ${
                        preset === p.key ? accent : "#E5E7EB"
                      }`,
                      background: preset === p.key ? `${accent}15` : "#fff",
                      color: preset === p.key ? accent : "#374151",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#6B7280" }}>From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) =>
                    onChange({ from: e.target.value, to, preset: "custom" })
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#6B7280" }}>To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) =>
                    onChange({ from, to: e.target.value, preset: "custom" })
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            {hasFilter && (
              <button
                onClick={clear}
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #FCA5A5",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}