import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Factory,
  Package,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import { getLowStock } from "../api/api";

const formatNumber = (v) =>
  Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

const getSeverity = (item) => {
  const qty = Number(item.quantity || 0);
  const critical = Number(item.criticalLevel || 0);
  if (qty === 0) return "out";
  if (critical > 0 && qty <= critical) return "critical";
  return "low";
};

const severityConfig = {
  out: {
    label: "OUT",
    pill: "bg-red-100 text-red-700 ring-red-200",
    bar: "bg-red-500",
  },
  critical: {
    label: "CRITICAL",
    pill: "bg-rose-100 text-rose-700 ring-rose-200",
    bar: "bg-rose-500",
  },
  low: {
    label: "LOW",
    pill: "bg-amber-100 text-amber-700 ring-amber-200",
    bar: "bg-amber-500",
  },
};

export default function LowStockTable({ compact = false }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | raw | product

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getLowStock();
      setItems(res.data?.data || []);
    } catch (err) {
      console.error("Low stock fetch error:", err);
      setError(err.response?.data?.message || "Failed to load low stock items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "raw") return it.inventoryType === "Raw Material";
    if (filter === "product") return it.inventoryType === "Product";
    return true;
  });

  const rawCount = items.filter((i) => i.inventoryType === "Raw Material").length;
  const prodCount = items.filter((i) => i.inventoryType === "Product").length;
  const criticalCount = items.filter(
    (i) => getSeverity(i) !== "low"
  ).length;

  if (compact) {
    // Compact variant: just a scrollable list, no table chrome
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Low Stock
            </h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
              {items.length}
            </span>
          </div>
          <button
            onClick={fetchData}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="thin-scroll max-h-72 overflow-y-auto">
          {filtered.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              All items are above reorder level.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((it) => {
                const sev = getSeverity(it);
                const cfg = severityConfig[sev];
                return (
                  <li key={it._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {it.materialName || it.product?.name || "—"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {it.inventoryType}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cfg.pill}`}>
                      {cfg.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 ring-1 ring-amber-900/5">
            <AlertTriangle size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900">
              Low Stock Alerts
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Items at or below their reorder level
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            <FilterPill
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`All · ${items.length}`}
            />
            <FilterPill
              active={filter === "raw"}
              onClick={() => setFilter("raw")}
              label={`Raw · ${rawCount}`}
            />
            <FilterPill
              active={filter === "product"}
              onClick={() => setFilter("product")}
              label={`Product · ${prodCount}`}
            />
          </div>
          <button
            onClick={fetchData}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {/* STATS STRIP */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40">
          <Stat label="Total low" value={items.length} tone="amber" />
          <Stat label="Critical / Out" value={criticalCount} tone="rose" />
          <Stat
            label="Raw vs Product"
            value={`${rawCount} / ${prodCount}`}
            tone="slate"
          />
        </div>
      )}

      {/* TABLE */}
      {loading ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <RefreshCw size={22} className="animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Package size={18} />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-slate-800">
            All clear
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            No {filter !== "all" ? filter : ""} items below reorder level.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Item
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Type
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Warehouse
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Available
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Reorder
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Shortfall
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Status
                </th>
                <th className="w-[80px] px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((it) => {
                const sev = getSeverity(it);
                const cfg = severityConfig[sev];
                const qty = Number(it.quantity || 0);
                const reorder = Number(it.reorderLevel || 0);
                const shortfall = Math.max(reorder - qty, 0);
                const unit = it.unit || "t";
                const isRaw = it.inventoryType === "Raw Material";

                return (
                  <tr
                    key={it._id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isRaw
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isRaw ? <Factory size={14} /> : <Package size={14} />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {it.materialName || it.product?.name || "—"}
                          </p>
                          {it.batchNumber && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-400">
                              Batch {it.batchNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          isRaw
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isRaw ? "Raw" : "Product"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      {it.warehouse || "Main"}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold tabular-nums text-slate-900">
                        {formatNumber(qty)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400">
                        {unit}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-600">
                        {formatNumber(reorder)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400">
                        {unit}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${
                          sev === "out"
                            ? "text-red-600"
                            : sev === "critical"
                            ? "text-rose-600"
                            : "text-amber-600"
                        }`}
                      >
                        <TrendingDown size={12} />
                        {formatNumber(shortfall)}
                        <span className="text-[10px] font-medium text-slate-400">
                          {unit}
                        </span>
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${cfg.pill}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.bar}`} />
                        {cfg.label}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate("/inventory")}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        title="Open Inventory"
                      >
                        Fix
                        <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* FOOTER */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2.5">
          <p className="text-[10px] text-slate-500">
            Showing {filtered.length} of {items.length} low stock items
          </p>
          <button
            onClick={() => navigate("/inventory")}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Go to Inventory
            <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

/* Small internal helpers */

function FilterPill({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, tone = "slate" }) {
  const toneMap = {
    amber: "text-amber-700",
    rose: "text-rose-700",
    slate: "text-slate-700",
  };
  return (
    <div className="px-4 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${toneMap[tone]}`}>
        {value}
      </p>
    </div>
  );
}