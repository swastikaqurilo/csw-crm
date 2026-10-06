import { useCallback, useEffect, useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Wallet, Package, TrendingUp, ShieldCheck,
  ArrowRight, AlertTriangle, Clock, Truck, IndianRupee,
  PauseCircle, CheckCircle2, ArrowDownToLine, ArrowUpFromLine,
  TrendingDown, Circle, Inbox,
} from "lucide-react";
import {
  getEnquiries, getOrders, getPayments, getRawStock, getProductStock,
  getFollowups, getAccountingDashboard,
} from "../api/api";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const formatINR = (v) => {
  const n = num(v);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const formatDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysAgo = (d) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400_000) : 0;

const timeAgo = (date) => {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const safeArr = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};
const safeObj = (res) => res?.data?.data || res?.data || null;

const ORDER_ACTIVE = ["confirmed", "processing", "ready for dispatch", "dispatched"];
const ORDER_DONE = ["delivered", "cancelled", "canceled", "closed"];
const ENQUIRY_OPEN = ["new", "contacted", "in progress", "in discussion", "quoted"];
const ENQUIRY_CLOSED = ["converted", "lost"];

/* ══════════════════════════════════════════════════════════════════
   STOCK NORMALIZATION
   Merges raw-material + product rows into a single shape with
   severity precomputed.
   ══════════════════════════════════════════════════════════════════ */

function normalizeStockItem(item, source) {
  const qty = num(item.quantity);
  const freeQty = num(item.freeQty);
  const reservedQty = num(item.reservedQty);
  const reorder = num(item.reorderLevel);
  const critical = num(item.criticalLevel);

  // Prefer server-computed flags if present, otherwise derive
  let severity = "ok";
  if (source === "raw") {
    if (item.isCritical === true || (critical > 0 && qty <= critical)) severity = "critical";
    else if (item.isLowStock === true || (reorder > 0 && qty <= reorder)) severity = "low";
  } else {
    // product — has no server flags in the sample; derive
    if (critical > 0 && qty <= critical) severity = "critical";
    else if (reorder > 0 && qty <= reorder) severity = "low";
  }
  if (qty === 0 && (reorder > 0 || critical > 0)) severity = "out";

  const name =
    item.displayName ||
    item.name ||
    item.materialName ||
    item.product?.name ||
    "—";

  const unit = item.unit || (source === "raw" ? "Piece" : "Reel");

  return {
    _id: item._id || item.id,
    source,
    inventoryType: source === "raw" ? "Raw Material" : "Product",
    name,
    rawName: item.name || "",
    category: item.category || "",
    sizeKg: item.sizeKg || null,
    size: item.size || "",
    unit,
    warehouse: item.warehouse || "Main",
    quantity: qty,
    freeQty,
    reservedQty,
    reorderLevel: reorder,
    criticalLevel: critical,
    severity,
    shortfall: Math.max(reorder - qty, 0),
    updatedAt: item.updatedAt || item.createdAt || null,
  };
}

function Sparkline({ values = [], h = 36 }) {
  const uid = useId();
  const gid = `spark-${uid.replace(/:/g, "")}`;
  const data = values.length > 1 ? values : [0, 1, 0.5, 1.5, 1, 2, 1.5, 2];
  const w = 200;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [
    i * step,
    h - ((v - min) / range) * (h - 6) - 3,
  ]);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const areaPath = `${d} L${w},${h} L0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: h }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} />
      <path
        d={d}
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
} 

/* ══════════════════════════════════════════════════════════════════
   HOOK
   ══════════════════════════════════════════════════════════════════ */

function useDashboardData({ autoRefreshMs = 0 } = {}) {
  const [data, setData] = useState({
    accounting: null,
    rawStock: [],
    productStock: [],
    orders: [],
    enquiries: [],
    payments: [],
    followups: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      setError("");
      const r = await Promise.allSettled([
        getAccountingDashboard({}),
        getRawStock(),
        getProductStock(),
        getOrders({ limit: 50, sort: "-createdAt" }),
        getEnquiries({ limit: 200, sort: "-createdAt" }),
        getPayments({ limit: 100, sort: "-createdAt" }),
        getFollowups({ limit: 100 }),
      ]);
      const v = (x) => (x.status === "fulfilled" ? x.value : null);
      setData({
        accounting: safeObj(v(r[0])),
        rawStock: safeArr(v(r[1])),
        productStock: safeArr(v(r[2])),
        orders: safeArr(v(r[3])),
        enquiries: safeArr(v(r[4])),
        payments: safeArr(v(r[5])),
        followups: safeArr(v(r[6])),
      });
    } catch (err) {
      console.error("Dashboard fetch failed:", err);
      setError(err?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    if (autoRefreshMs > 0) {
      const id = setInterval(fetchAll, autoRefreshMs);
      return () => clearInterval(id);
    }
  }, [fetchAll, autoRefreshMs]);

  /* ── Normalized stock ────────────────────────────────────────── */
  const stockItems = [
    ...data.rawStock.map((i) => normalizeStockItem(i, "raw")),
    ...data.productStock.map((i) => normalizeStockItem(i, "product")),
  ];

  const criticalStock = stockItems.filter((i) => i.severity === "critical" || i.severity === "out");
  const lowStock = stockItems.filter((i) => i.severity === "low");

  /* ── Cash ────────────────────────────────────────────────────── */
  const cash = (() => {
    const o = data.accounting?.overview || {};
    return {
      net: num(o.netCashPosition),
      payables: num(o.totalPayables),
      receivables: num(o.accountsReceivable),
      netProfit: num(o.netProfit),
    };
  })();

  /* ── Order book ──────────────────────────────────────────────── */
  const orderBook = (() => {
    const active = data.orders.filter((o) =>
      ORDER_ACTIVE.includes(String(o.status || "").toLowerCase())
    );
    return {
      count: active.length,
      total: active.reduce((s, o) => s + num(o.grandTotal), 0),
    };
  })();

  /* ── Enquiry pipeline ────────────────────────────────────────── */
  const pipeline = (() => {
    const open = data.enquiries.filter((e) =>
      ENQUIRY_OPEN.includes(String(e.status || "").toLowerCase())
    );
    const total = open.reduce((s, e) => s + num(e.estimatedValue), 0);
    const closed = data.enquiries.filter((e) =>
      ENQUIRY_CLOSED.includes(String(e.status || "").toLowerCase())
    );
    const won = closed.filter(
      (e) => String(e.status || "").toLowerCase() === "converted"
    ).length;
    return {
      count: open.length,
      total,
      convRate: closed.length > 0 ? Math.round((won / closed.length) * 100) : 0,
    };
  })();

  /* ── Stock health ────────────────────────────────────────────── */
  const stockHealth = (() => {
    const totalRecords = stockItems.length;
    const criticalCount = criticalStock.length;
    const lowCount = lowStock.length;
    const healthy = Math.max(totalRecords - criticalCount - lowCount, 0);
    return {
      totalRecords,
      lowCount,
      criticalCount,
      pct:
        totalRecords > 0
          ? Math.round((healthy / totalRecords) * 100)
          : 100,
    };
  })();

  /* ── Revenue series ──────────────────────────────────────────── */
  const revenueSeries = (data.accounting?.profitLoss?.monthlyData || []).map((m) => ({
    label: m.month || m.label || "",
    revenue: num(m.revenue),
    expenses: num(m.expenses),
    net: num(m.netProfit),
  }));

  /* ── Alerts ──────────────────────────────────────────────────── */
  const delayedOrders = (() => {
    const now = Date.now();
    return data.orders.filter((o) => {
      if (ORDER_DONE.includes(String(o.status || "").toLowerCase())) return false;
      const due = o.expectedDeliveryDate;
      return due && new Date(due).getTime() < now;
    });
  })();

  const unpaidOrders = (() => {
    const now = Date.now();
    return data.orders.filter((o) => {
      if (ORDER_DONE.includes(String(o.status || "").toLowerCase())) return false;
      const paid = num(o.amountPaid);
      const total = num(o.grandTotal);
      if (total <= 0 || paid >= total - 0.01) return false;
      const due = o.expectedDeliveryDate;
      return due && new Date(due).getTime() < now;
    });
  })();

  const stuckEnquiries = (() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return data.enquiries.filter((e) => {
      if (ENQUIRY_CLOSED.includes(String(e.status || "").toLowerCase())) return false;
      const last = e.updatedAt || e.createdAt;
      return last && new Date(last).getTime() < cutoff;
    });
  })();

  const overdueFollowups = (() => {
    const now = Date.now();
    return data.followups.filter((f) => {
      if (String(f.status || "") !== "Pending") return false;
      return f.scheduledAt && new Date(f.scheduledAt).getTime() < now;
    });
  })();

  const todayFollowups = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 86400_000;
    return data.followups.filter((f) => {
      if (String(f.status || "") !== "Pending") return false;
      if (!f.scheduledAt) return false;
      const t = new Date(f.scheduledAt).getTime();
      return t >= start && t < end;
    });
  })();

  const readyForDispatch = data.orders.filter(
    (o) => String(o.status || "").toLowerCase() === "ready for dispatch"
  );

  return {
    data,
    loading,
    error,
    refetch: fetchAll,
    derived: {
      cash,
      orderBook,
      pipeline,
      stockHealth,
      revenueSeries,
      delayedOrders,
      unpaidOrders,
      stuckEnquiries,
      overdueFollowups,
      todayFollowups,
      readyForDispatch,
      stockItems,
      criticalStock,
      lowStock,
    },
  };
}

function HeroMetric({
  label,
  value,
  context,
  icon: Icon,
  tint,
  loading,
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60">
      {/* soft accent on hover */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-slate-100 via-slate-50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* header row — icon + label only */}
      <div className="relative flex min-w-0 items-center gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tint}`}
        >
          <Icon size={16} strokeWidth={2.2} />
        </div>
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </span>
      </div>

      {loading ? (
        <div className="relative mt-5 space-y-2">
          <div className="shimmer h-7 w-32 rounded-md" />
          <div className="shimmer h-3 w-24 rounded-md" />
        </div>
      ) : (
        <>
          <p className="relative mt-5 text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          <p className="relative mt-2 truncate text-[11.5px] font-medium text-slate-500">
            {context}
          </p>
        </>
      )}
    </div>
  );
}

function ControlStrip({ loading, cash, orderBook, pipeline, stockHealth, revenueSeries }) {
  const spark = revenueSeries.map((r) => r.revenue);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <HeroMetric
        label="Cash Position"
        value={formatINR(cash.net)}
        context={cash.payables > 0 ? `${formatINR(cash.payables)} payables` : "No payables"}
        icon={Wallet}
        tint="bg-slate-100 text-slate-700 border-slate-200"
        sparkValues={spark}
        loading={loading}
      />
      <HeroMetric
        label="Order Book"
        value={formatINR(orderBook.total)}
        context={`${orderBook.count} active order${orderBook.count !== 1 ? "s" : ""}`}
        icon={Package}
        tint="bg-blue-50 text-blue-600 border-blue-100"
        sparkValues={spark}
        loading={loading}
      />
      <HeroMetric
        label="Pipeline"
        value={formatINR(pipeline.total)}
        context={`${pipeline.count} enquir${pipeline.count !== 1 ? "ies" : "y"} open · ${pipeline.convRate}% conv`}
        icon={TrendingUp}
        tint="bg-indigo-50 text-indigo-600 border-indigo-100"
        sparkValues={spark}
        loading={loading}
      />
      <HeroMetric
        label="Stock Health"
        value={`${stockHealth.pct}%`}
        context={
          stockHealth.criticalCount > 0
            ? `${stockHealth.criticalCount} critical · ${stockHealth.lowCount} low`
            : stockHealth.lowCount > 0
            ? `${stockHealth.lowCount} low`
            : "All above reorder"
        }
        icon={ShieldCheck}
        tint={
          stockHealth.pct >= 80
            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
            : stockHealth.pct >= 60
            ? "bg-amber-50 text-amber-600 border-amber-100"
            : "bg-red-50 text-red-600 border-red-100"
        }
        sparkValues={spark}
        loading={loading}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ZONE 2 — ACTION QUEUE
   ══════════════════════════════════════════════════════════════════ */

const SEVERITY_DOT = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  neutral: "bg-slate-400",
};

function buildActionQueue(d) {
  const items = [];

  if (d.criticalStock.length > 0) {
    const names = d.criticalStock.slice(0, 2).map((c) => c.name).filter(Boolean);
    items.push({
      id: "critical-stock",
      severity: "critical",
      icon: AlertTriangle,
      title: `${d.criticalStock.length} item${d.criticalStock.length !== 1 ? "s" : ""} at critical stock`,
      detail: names.length > 0
        ? `${names.join(", ")}${d.criticalStock.length > 2 ? ` +${d.criticalStock.length - 2} more` : ""}`
        : "Production may stop",
      action: "Order now",
      route: "/inventory",
    });
  }

  if (d.delayedOrders.length > 0) {
    const value = d.delayedOrders.reduce((s, o) => s + num(o.grandTotal), 0);
    const first = d.delayedOrders[0];
    const customer = first.contact?.company || first.contact?.name || "";
    const late = daysAgo(first.expectedDeliveryDate);
    items.push({
      id: "delayed-orders",
      severity: "critical",
      icon: Truck,
      title: `${d.delayedOrders.length} order${d.delayedOrders.length !== 1 ? "s" : ""} past delivery date`,
      detail: `${formatINR(value)} at risk · ${customer ? `${customer} ${late}d late` : "Reschedule"}`,
      action: "Dispatch",
      route: "/orders",
    });
  }

  if (d.overdueFollowups.length > 0) {
    const oldest = d.overdueFollowups[0];
    const late = daysAgo(oldest.scheduledAt);
    items.push({
      id: "overdue-followups",
      severity: "critical",
      icon: Clock,
      title: `${d.overdueFollowups.length} overdue follow-up${d.overdueFollowups.length !== 1 ? "s" : ""}`,
      detail: oldest.contact?.name ? `${oldest.contact.name} · ${late}d late` : `${late}d late`,
      action: "Call",
      route: "/follow-ups",
    });
  }

  if (d.unpaidOrders.length > 0) {
    const due = d.unpaidOrders.reduce(
      (s, o) => s + Math.max(num(o.grandTotal) - num(o.amountPaid), 0),
      0
    );
    items.push({
      id: "unpaid-orders",
      severity: "warning",
      icon: IndianRupee,
      title: `${d.unpaidOrders.length} order${d.unpaidOrders.length !== 1 ? "s" : ""} with balance past delivery`,
      detail: `${formatINR(due)} receivable at risk`,
      action: "Collect",
      route: "/payments",
    });
  }

  if (d.lowStock.length > 0) {
    items.push({
      id: "low-stock",
      severity: "warning",
      icon: AlertTriangle,
      title: `${d.lowStock.length} item${d.lowStock.length !== 1 ? "s" : ""} below reorder`,
      detail: "Purchase or reorder recommended",
      action: "Review",
      route: "/inventory",
    });
  }

  if (d.stuckEnquiries.length > 0) {
    const oldest = d.stuckEnquiries[0];
    const stuck = daysAgo(oldest.updatedAt || oldest.createdAt);
    items.push({
      id: "stuck-enquiries",
      severity: "warning",
      icon: PauseCircle,
      title: `${d.stuckEnquiries.length} enquir${d.stuckEnquiries.length !== 1 ? "ies" : "y"} stuck 7d+`,
      detail: `Oldest: ${oldest.customerName || "—"} (${stuck}d)`,
      action: "Follow up",
      route: "/enquiries",
    });
  }

  if (d.readyForDispatch.length > 0) {
    items.push({
      id: "ready-to-dispatch",
      severity: "warning",
      icon: Package,
      title: `${d.readyForDispatch.length} order${d.readyForDispatch.length !== 1 ? "s" : ""} ready for dispatch`,
      detail: "Awaiting pickup or invoice",
      action: "Dispatch",
      route: "/orders",
    });
  }

  if (d.todayFollowups.length > 0) {
    const names = d.todayFollowups.slice(0, 2).map((f) => f.contact?.name).filter(Boolean);
    items.push({
      id: "today-followups",
      severity: "neutral",
      icon: Clock,
      title: `${d.todayFollowups.length} follow-up${d.todayFollowups.length !== 1 ? "s" : ""} today`,
      detail: names.length > 0 ? names.join(", ") : "Open schedule",
      action: "Open",
      route: "/follow-ups",
    });
  }

  return items;
}

function ActionQueue({ loading, ...d }) {
  const navigate = useNavigate();
  const queue = buildActionQueue(d);
  const criticalCount = queue.filter((q) => q.severity === "critical").length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
            Action Queue
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {loading
              ? "Scanning across the business…"
              : queue.length === 0
              ? "All clear — nothing needs attention"
              : `${queue.length} item${queue.length !== 1 ? "s" : ""} need${queue.length === 1 ? "s" : ""} action`}
          </p>
        </div>
        {!loading && queue.length > 0 && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums ${
              criticalCount > 0
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {queue.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="shimmer h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="shimmer h-3 w-3/4 rounded" />
                <div className="shimmer h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-black">All clear</h4>
          <p className="mt-1 max-w-[220px] text-xs text-slate-500">
            No critical actions or pending warnings right now.
          </p>
        </div>
      ) : (
        <ul className="thin-scroll divide-y divide-slate-100 overflow-y-auto">
          {queue.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.id}
                className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
              >
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                    <Icon size={14} />
                  </div>
                  <span
                    className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white ${
                      SEVERITY_DOT[item.severity]
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-black">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {item.detail}
                  </p>
                </div>
                <button
                  onClick={() => navigate(item.route)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-black transition hover:border-slate-300 hover:bg-slate-50 active:translate-y-px"
                >
                  {item.action}
                  <ArrowRight size={10} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && queue.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-2.5">
          <span className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {queue.filter((q) => q.severity === "critical").length} critical
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {queue.filter((q) => q.severity === "warning").length} warning
            </span>
          </span>
          <span className="text-[10px] text-slate-400">Ranked by urgency</span>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, icon: Icon, tint }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/50">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl border ${tint}`}
        >
          <Icon size={15} strokeWidth={2.2} />
        </div>
      </div>

      <p className="mt-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-[21px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <p className="mt-2 truncate text-[11px] font-medium text-slate-500">
        {sub}
      </p>
    </div>
  );
}

function FinancialSnapshot({ loading, accounting }) {
  const navigate = useNavigate();
  const o = accounting?.overview || {};
  const pl = accounting?.profitLoss || {};
  const meta = accounting?.meta || {};

  const cash = num(o.netCashPosition);
  const payables = num(o.totalPayables);
  const receivables = num(o.accountsReceivable);
  const netProfit = num(o.netProfit);
  const monthly = pl.monthlyData || [];
  const ytdRev = num(pl.totalRevenue);
  const ytdExp = num(pl.totalExpenses);
  const margin = ytdRev > 0 ? Math.round((netProfit / ytdRev) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
            Financial Snapshot
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {meta.fiscalYearStart
              ? `${formatDate(meta.fiscalYearStart)} → ${formatDate(meta.asOf)}`
              : "Current fiscal period"}
          </p>
        </div>
        <button
          onClick={() => navigate("/accounting")}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-black transition hover:border-slate-300 hover:bg-slate-50"
        >
          Accounting
          <ArrowRight size={10} />
        </button>
      </div>

      {loading ? (
          <div className="grid grid-cols-2 gap-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="shimmer h-9 w-9 rounded-xl" />
                <div className="shimmer mt-3.5 h-2.5 w-20 rounded" />
                <div className="shimmer mt-2 h-5 w-24 rounded" />
                <div className="shimmer mt-2 h-2.5 w-28 rounded" />
              </div>
            ))}
          </div>
        ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-4">
            <StatTile
              label="Cash Position"
              value={formatINR(cash)}
              sub="Payments − paid expenses"
              icon={Wallet}
              tint="bg-slate-100 text-slate-700 border-slate-200"
            />
            <StatTile
              label="Receivables"
              value={formatINR(receivables)}
              sub="Open order balances"
              icon={ArrowDownToLine}
              tint="bg-blue-50 text-blue-600 border-blue-100"
            />
            <StatTile
              label="Payables"
              value={formatINR(payables)}
              sub="Unpaid expenses"
              icon={ArrowUpFromLine}
              tint="bg-amber-50 text-amber-600 border-amber-100"
            />
            <StatTile
              label="Net Profit"
              value={formatINR(netProfit)}
              sub={ytdRev > 0 ? `${margin}% margin on ${formatINR(ytdRev)}` : "No revenue yet"}
              icon={netProfit >= 0 ? TrendingUp : TrendingDown}
              tint={
                netProfit >= 0
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-red-50 text-red-600 border-red-100"
              }
            />
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50">
            <div className="px-5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Revenue YTD
              </span>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-black">
                {formatINR(ytdRev)}
              </p>
            </div>
            <div className="px-5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Expenses YTD
              </span>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-black">
                {formatINR(ytdExp)}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-2.5">
        <span className="text-[10px] text-slate-500">
          {loading ? "Loading…" : `${monthly.length} month${monthly.length !== 1 ? "s" : ""} of data`}
        </span>
        <button
          onClick={() => navigate("/accounting")}
          className="text-[10px] font-semibold text-black transition hover:text-slate-600"
        >
          Full accounting →
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ZONE 4 — PIPELINE VELOCITY
   ══════════════════════════════════════════════════════════════════ */

function PipelineVelocity({ loading, enquiries, orders }) {
  const STAGES = ["Enquiry", "Order", "Delivered"];

  const enqCount = enquiries.length;
  const orderCount = orders.length;
  const delivered = orders.filter((o) =>
    ["delivered", "Delivered"].includes(o.status)
  ).length;

  const counts = [enqCount, orderCount, delivered];
  const conv = [
    null,
    enqCount > 0 ? Math.round((orderCount / enqCount) * 100) : 0,
    orderCount > 0 ? Math.round((delivered / orderCount) * 100) : 0,
  ];
  const max = Math.max(...counts, 1);

  const stuck = enquiries
    .filter(
      (e) =>
        !["converted", "lost", "Converted", "Lost"].includes(e.status) &&
        daysAgo(e.updatedAt || e.createdAt) >= 7
    )
    .map((e) => ({
      id: e._id,
      name: e.customerName || "Unknown",
      stage: "Enquiry",
      days: daysAgo(e.updatedAt || e.createdAt),
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 4);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
          Pipeline Velocity
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Enquiry → Order → Delivered
        </p>
      </div>

      <div className="space-y-4 px-5 py-5">
        {STAGES.map((stage, i) => (
          <div key={stage}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-black">{stage}</span>
              <div className="flex items-center gap-3">
                {conv[i] != null && (
                  <span className="text-[10px] font-medium text-slate-400">
                    ▼ {conv[i]}%
                  </span>
                )}
                <span className="w-10 text-right text-sm font-bold tabular-nums text-black">
                  {loading ? "—" : counts[i]}
                </span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0f172a] transition-all duration-500"
                style={{ width: loading ? "0%" : `${(counts[i] / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-slate-400" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-black">
              Stuck 7d+
            </span>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
            {stuck.length}
          </span>
        </div>
        {loading ? (
          <div className="space-y-2 px-5 pb-4">
            {[1, 2].map((i) => (
              <div key={i} className="shimmer h-8 rounded" />
            ))}
          </div>
        ) : stuck.length === 0 ? (
          <div className="px-5 pb-5 text-center text-[11px] text-slate-400">
            No stuck deals. Pipeline is moving.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stuck.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-black">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {s.stage} · {s.days}d inactive
                  </p>
                </div>
                <button className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-black transition hover:bg-slate-50">
                  Chase
                  <ArrowRight size={10} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ZONE 5 — ACTIVITY STREAM
   ══════════════════════════════════════════════════════════════════ */

const TONE_TILE = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
};

function buildFeed({ orders, payments, enquiries }) {
  const feed = [];
  orders.slice(0, 8).forEach((o) => {
    feed.push({
      id: `o-${o._id}`, icon: Package, tone: "blue",
      text: `Order ${o.orderNumber || ""} · ${o.status}`,
      meta: `${o.contact?.company || o.contact?.name || "Customer"} · ${formatINR(o.grandTotal)}`,
      at: o.updatedAt || o.createdAt,
    });
  });
  payments.slice(0, 8).forEach((p) => {
    feed.push({
      id: `p-${p._id}`, icon: IndianRupee, tone: "emerald",
      text: p.status === "Completed"
        ? `Payment received · ${formatINR(p.amount)}`
        : `Payment ${p.status?.toLowerCase()} · ${formatINR(p.amount)}`,
      meta: p.contact?.company || p.contact?.name || p.order?.contact?.company || "Customer",
      at: p.updatedAt || p.createdAt,
    });
  });
  (enquiries || []).slice(0, 8).forEach((e) => {
    feed.push({
      id: `e-${e._id}`, icon: Inbox, tone: "amber",
      text: `Enquiry · ${e.status || "New"}`,
      meta: e.customerName || "Customer",
      at: e.updatedAt || e.createdAt,
    });
  });
  return feed
    .filter((f) => f.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12);
}

function ActivityStream({ loading, orders, payments, enquiries }) {
  const feed = buildFeed({ orders, payments, enquiries });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
            Activity Stream
          </h2>
          <p className="mt-1 text-xs text-slate-500">Live across the business</p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
          <Circle size={6} className="fill-emerald-500" />
          Live
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 p-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="shimmer h-7 w-7 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="shimmer h-3 w-3/4 rounded" />
                <div className="shimmer h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : feed.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-slate-400">
          No recent activity.
        </div>
      ) : (
        <ul className="thin-scroll max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {feed.map((f) => {
            const Icon = f.icon;
            const tone = TONE_TILE[f.tone] || TONE_TILE.blue;
            return (
              <li
                key={f.id}
                className="flex items-start gap-3 px-5 py-3 transition hover:bg-slate-50"
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
                  <Icon size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-black">
                    {f.text}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {f.meta}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-400">
                  {timeAgo(f.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ZONE 6 — LOW STOCK ALERT
   Now merges raw-material + product rows into one table.
   ══════════════════════════════════════════════════════════════════ */

const SEV_BADGE = {
  out: "bg-red-50 text-red-700 border-red-100",
  critical: "bg-red-50 text-red-700 border-red-100",
  low: "bg-amber-50 text-amber-700 border-amber-100",
};

const SEV_LABEL = { out: "Out", critical: "Critical", low: "Low" };

const SEV_ORDER = { out: 0, critical: 1, low: 2 };

function LowStockPanel({ loading, stockItems }) {
  const [filter, setFilter] = useState("all");

  const alertItems = stockItems
    .filter((i) => i.severity !== "ok")
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  const filtered = alertItems.filter((it) => {
    if (filter === "all") return true;
    if (filter === "raw") return it.source === "raw";
    if (filter === "product") return it.source === "product";
    return true;
  });

  const rawCount = alertItems.filter((i) => i.source === "raw").length;
  const prodCount = alertItems.filter((i) => i.source === "product").length;
  const criticalCount = alertItems.filter((i) => i.severity !== "low").length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-600">
            <AlertTriangle size={17} />
          </div>
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
              Low Stock Alert
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {loading
                ? "Scanning…"
                : alertItems.length === 0
                ? "All items above reorder level"
                : `${alertItems.length} item${alertItems.length !== 1 ? "s" : ""} need${alertItems.length === 1 ? "s" : ""} attention`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {[
            ["all", `All · ${alertItems.length}`],
            ["raw", `Raw · ${rawCount}`],
            ["product", `Product · ${prodCount}`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                filter === id
                  ? "bg-white text-black shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="shimmer h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="shimmer h-3 w-2/3 rounded" />
                <div className="shimmer h-2.5 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-black">Stock is healthy</h4>
          <p className="mt-1 max-w-[260px] text-xs text-slate-500">
            {filter === "all"
              ? "No items below reorder level right now."
              : `No ${filter} items below reorder level.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Item
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Type
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Warehouse
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Available
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Reorder
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Shortfall
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item._id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                        <Package size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-black">
                          {item.name}
                        </p>
                        {(item.category || item.sizeKg) && (
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">
                            {item.category || ""}
                            {item.category && item.sizeKg ? " · " : ""}
                            {item.sizeKg ? `${item.sizeKg} kg` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {item.source === "raw" ? "Raw" : "Product"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {item.warehouse}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-semibold tabular-nums text-black">
                      {item.quantity.toFixed(2)}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-400">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-medium tabular-nums text-slate-600">
                      {item.reorderLevel.toFixed(2)}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-400">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-bold tabular-nums text-red-600">
                      −{item.shortfall.toFixed(2)}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-400">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${SEV_BADGE[item.severity]}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {SEV_LABEL[item.severity]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-2.5">
          <span className="text-[10px] text-slate-500">
            {criticalCount > 0
              ? `${criticalCount} critical · ${alertItems.length - criticalCount} low`
              : `${alertItems.length} low`}
          </span>
          <button
            onClick={() => (window.location.href = "/inventory")}
            className="text-[10px] font-semibold text-black transition hover:text-slate-600"
          >
            Manage inventory →
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD — PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { data, loading, error, refetch, derived } = useDashboardData({
    autoRefreshMs: 60_000,
  });

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-full bg-slate-50 p-5 sm:p-6 lg:p-7">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black">
            <span>COMMAND CONSOLE</span>
            <span className="text-slate-300">/</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live Operations
            </span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-black">
            Good morning, Admin
          </h1>
          <p className="mt-1.5 text-sm text-black">
            {today} · Here's what needs your attention.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refetch}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* ZONE 1 */}
      <div className="mb-6">
        <ControlStrip
          loading={loading}
          cash={derived.cash}
          orderBook={derived.orderBook}
          pipeline={derived.pipeline}
          stockHealth={derived.stockHealth}
          revenueSeries={derived.revenueSeries}
        />
      </div>

      {/* ZONES 2 + 3 */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.65fr]">
        <ActionQueue
          loading={loading}
          criticalStock={derived.criticalStock}
          lowStock={derived.lowStock}
          delayedOrders={derived.delayedOrders}
          unpaidOrders={derived.unpaidOrders}
          stuckEnquiries={derived.stuckEnquiries}
          overdueFollowups={derived.overdueFollowups}
          todayFollowups={derived.todayFollowups}
          readyForDispatch={derived.readyForDispatch}
        />
        <FinancialSnapshot loading={loading} accounting={data.accounting} />
      </div>

      <div className="mb-6">
        <LowStockPanel loading={loading} stockItems={derived.stockItems} />
      </div>

]      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PipelineVelocity
          loading={loading}
          enquiries={data.enquiries}
          orders={data.orders}
        />
        <ActivityStream
          loading={loading}
          orders={data.orders}
          payments={data.payments}
          enquiries={data.enquiries}
        />
      </div>
    </div>
  );
}