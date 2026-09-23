import {
  Inbox,
  Activity,
  IndianRupee,
  CreditCard,
  ArrowUpRight,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MoreHorizontal,
  Factory,
  Package,
  TrendingUp,
} from "lucide-react";

const stats = [
  {
    label: "TOTAL ENQUIRIES",
    value: "148",
    meta: "+12.5% vs last month",
    icon: Inbox,
    accent: "blue",
  },
  {
    label: "ACTIVE ENQUIRIES",
    value: "24",
    meta: "+3 vs last week",
    icon: Activity,
    accent: "indigo",
  },
  {
    label: "SEPTEMBER REVENUE",
    value: "₹5.58L",
    meta: "+18.4% local growth",
    icon: IndianRupee,
    accent: "green",
  },
  {
    label: "PENDING PAYMENTS",
    value: "₹2.03L",
    meta: "8.5 invoices awaiting",
    icon: CreditCard,
    accent: "amber",
  },
];

const pipelineStages = [
  {
    name: "New Enquiries",
    count: "₹4.8L",
    pct: 40,
    color: "#3b82f6",
  },
  {
    name: "In Discussion",
    count: "₹3.2L",
    pct: 27,
    color: "#8b5cf6",
  },
  {
    name: "Confirmed",
    count: "₹2.4L",
    pct: 20,
    color: "#10b981",
  },
  {
    name: "Processing",
    count: "₹1.6L",
    pct: 13,
    color: "#f59e0b",
  },
];

const recentOrders = [
  {
    id: "ORD-2040",
    customer: "Larsen & Toubro Infra",
    product: "GI Wire 4.0mm",
    amount: "₹1,08,000",
    status: "Confirmed",
    date: "10 Sep 2026",
  },
  {
    id: "ORD-2039",
    customer: "Delhi Metro Rail Corp",
    product: "Barbed Wire Heavy",
    amount: "₹91,500",
    status: "Processing",
    date: "09 Sep 2026",
  },
  {
    id: "ORD-2038",
    customer: "GMR Airport Projects",
    product: "Concertina Wire DTO",
    amount: "₹1,64,000",
    status: "Dispatched",
    date: "08 Sep 2026",
  },
  {
    id: "ORD-2037",
    customer: "Tata Projects Ltd",
    product: "PVC Coated Wire Green",
    amount: "₹72,000",
    status: "Confirmed",
    date: "07 Sep 2026",
  },
];

const todayFollowUps = [
  {
    name: "Rajesh Kumar",
    company: "ABC Infrastructure",
    type: "Call",
    priority: "High",
    time: "10:30 AM",
    action: "Call",
  },
  {
    name: "Amit Sharma",
    company: "Metro Security Solutions",
    type: "Email",
    priority: "Medium",
    time: "12:00 PM",
    action: "Email",
  },
  {
    name: "Vikas Mehta",
    company: "Northern Fence Works",
    type: "Meeting",
    priority: "Medium",
    time: "02:30 PM",
    action: "Meeting",
  },
  {
    name: "Ankit Verma",
    company: "SecureLand Projects",
    type: "Payment",
    priority: "High",
    time: "04:00 PM",
    action: "Payment",
  },
];

function Dashboard() {
  return (
    <div className="min-h-full bg-slate-50 p-5 sm:p-6 lg:p-7">

      {/* =========================================================
          PAGE HEADER
      ========================================================= */}
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
            Here’s what’s happening across enquiries, orders and revenue today.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-black shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            View enquiries
          </button>

          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1e293b] hover:shadow-md">
            <span className="text-base leading-none">+</span>
            New enquiry
          </button>
        </div>
      </div>

      {/* =========================================================
          KPI CARDS
      ========================================================= */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          const accentClasses = {
            blue: "bg-blue-50 text-blue-600 border-blue-100",
            indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
            green: "bg-emerald-50 text-emerald-600 border-emerald-100",
            amber: "bg-amber-50 text-amber-600 border-amber-100",
          };

          return (
            <div
              key={stat.label}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md !text=black  "
            >
              <div className="mb-5 flex items-start justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                    accentClasses[stat.accent]
                  }`}
                >
                  <Icon size={17} />
                </div>

                <ArrowUpRight
                  size={15}
                  className="text-slate-300 transition group-hover:text-black"
                />
              </div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black">
                {stat.label}
              </p>

              <p className="mt-1.5 text-[26px] font-bold tracking-tight !text-black">
                {stat.value}
              </p>

              <p className="mt-1 text-[11px] text-black">
                {stat.meta}
              </p>
            </div>
          );
        })}
      </div>

      {/* =========================================================
          REVENUE + PIPELINE
      ========================================================= */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]">

        {/* REVENUE */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
                Financial Trajectory
              </h2>

              <p className="mt-1 text-xs text-black">
                Revenue Overview · FY 2025–26
              </p>
            </div>

            <div className="flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button className="rounded-md bg-white px-3 py-1.5 text-[10px] font-semibold text-black shadow-sm">
                Monthly
              </button>

              <button className="px-3 py-1.5 text-[10px] font-medium text-black hover:text-black">
                Quarterly
              </button>

              <button className="px-3 py-1.5 text-[10px] font-medium text-black hover:text-black">
                FY 25–26
              </button>
            </div>
          </div>

          <div className="p-5">

            {/* SUMMARY */}
            <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">

              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-black">
                  YTD Revenue
                </p>

                <p className="mt-1 text-xl font-bold tracking-tight !text-black">
                  ₹38.08 Lakhs
                </p>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-black">
                  August Peak
                </p>

                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-sm font-bold !text-black">
                    ₹7.35L
                  </p>

                  <span className="text-[10px] font-semibold text-emerald-600">
                    +24.1%
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-black">
                  Avg Monthly Run-Rate
                </p>

                <p className="mt-1 text-sm font-bold !text-black">
                  ₹5.51L / mo
                </p>
              </div>

            </div>
            <div className="overflow-hidden">
              <svg
                viewBox="0 0 600 180"
                className="h-[180px] w-full"
                preserveAspectRatio="none"
              >
                <line
                  x1="0"
                  y1="40"
                  x2="600"
                  y2="40"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                <line
                  x1="0"
                  y1="90"
                  x2="600"
                  y2="90"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                <line
                  x1="0"
                  y1="140"
                  x2="600"
                  y2="140"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                <path
                  d="M0,140 L40,120 L120,100 L200,110 L280,70 L360,50 L440,45 L520,60 L600,40 L600,180 L0,180 Z"
                  fill="url(#chartGradient)"
                />

                <path
                  d="M0,140 L40,120 L120,100 L200,110 L280,70 L360,50 L440,45 L520,60 L600,40"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {[
                  [0, 140],
                  [40, 120],
                  [120, 100],
                  [200, 110],
                  [280, 70],
                  [360, 50],
                  [440, 45],
                  [520, 60],
                  [600, 40],
                ].map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill="#0f172a"
                  />
                ))}

                <defs>
                  <linearGradient
                    id="chartGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#0f172a"
                      stopOpacity="0.14"
                    />

                    <stop
                      offset="100%"
                      stopColor="#0f172a"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
              </svg>

              <div className="mt-1 flex justify-between px-0.5 text-[10px] text-black">
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
                <span>Dec</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
                Conversion Funnel
              </h2>

              <p className="mt-1 text-xs text-black">
                Enquiry Pipeline
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-black">
                Total Pipeline
              </p>

              <p className="mt-0.5 text-lg font-bold text-black">
                ₹12.0L
              </p>
            </div>

          </div>

          <div className="p-5">

            <div className="space-y-6">

              {pipelineStages.map((stage) => (
                <div key={stage.name}>

                  <div className="mb-2 flex items-center justify-between">

                    <span className="text-xs font-medium text-black">
                      {stage.name}
                    </span>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-black">
                        {stage.count}
                      </span>

                      <span className="w-8 text-right text-[10px] font-semibold text-black">
                        {stage.pct}%
                      </span>
                    </div>

                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${stage.pct}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>

                </div>
              ))}

            </div>

            <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-4">

              <span className="text-xs font-medium text-black">
                Conversion Rate
              </span>

              <span className="text-sm font-bold text-black">
                41.8% Avg
              </span>

            </div>

          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
                Manufacturing & Logistics
              </h2>

              <p className="mt-1 text-xs text-black">
                Recent Orders
              </p>
            </div>

            <button className="text-xs font-semibold text-black transition hover:text-black">
              View all orders
            </button>

          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">

                  {[
                    "ORDER ID",
                    "CUSTOMER",
                    "PRODUCT / SPEC",
                    "AMOUNT",
                    "STATUS",
                    "DATE",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-black"
                    >
                      {heading}
                    </th>
                  ))}

                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50/70"
                  >

                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-semibold text-[#0f172a]">
                        {order.id}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-black">
                        {order.customer}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-black">
                      {order.product}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-xs font-bold text-black">
                        {order.amount}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <OrderStatus status={order.status} />
                    </td>

                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-black">
                      {order.date}
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">

            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="p-4"
              >

                <div className="flex items-start justify-between gap-3">

                  <div>
                    <p className="font-mono text-xs font-semibold text-[#0f172a]">
                      {order.id}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-black">
                      {order.customer}
                    </p>

                    <p className="mt-1 text-xs text-black">
                      {order.product}
                    </p>
                  </div>

                  <OrderStatus status={order.status} />

                </div>

                <div className="mt-3 flex items-center justify-between">

                  <span className="text-xs text-black">
                    {order.date}
                  </span>

                  <span className="text-sm font-bold text-black">
                    {order.amount}
                  </span>

                </div>

              </div>
            ))}

          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">

            <span className="text-[11px] text-black">
              Showing 4 high-priority orders flagged for dispatch acceleration
            </span>

            <span className="text-[11px] text-black">
              Total Batch Weight:{" "}
              <strong className="font-semibold text-black">
                2,840 Kg
              </strong>
            </span>

          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-black">
                Client Schedule Plan
              </h2>

              <p className="mt-1 text-xs text-black">
                Today’s Follow-ups
              </p>
            </div>

            <button className="text-xs font-semibold text-black transition hover:text-black">
              View all
            </button>

          </div>

          <div className="divide-y divide-slate-100">

            {todayFollowUps.map((fu) => (
              <div
                key={fu.name}
                className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50/60"
              >

                <div className="flex min-w-0 items-center gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-black">
                    {fu.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>

                  <div className="min-w-0">

                    <div className="flex items-center gap-2">

                      <p className="truncate text-xs font-semibold text-black">
                        {fu.name}
                      </p>

                      <PriorityBadge priority={fu.priority} />

                    </div>

                    <p className="mt-0.5 truncate text-[10px] text-black">
                      {fu.company}
                    </p>

                  </div>

                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">

                  <span className="text-[10px] font-semibold text-black">
                    {fu.time}
                  </span>

                  <button className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-black transition hover:border-slate-300 hover:bg-slate-50 hover:text-black">

                    {fu.action === "Call" && <Phone size={11} />}
                    {fu.action === "Email" && <FileText size={11} />}
                    {fu.action === "Meeting" && <Calendar size={11} />}
                    {fu.action === "Payment" && <CreditCard size={11} />}

                    {fu.action}

                  </button>

                </div>

              </div>
            ))}

          </div>

          <div className="border-t border-slate-100 px-5 py-3.5">

            <button className="text-xs font-semibold text-black transition hover:text-black">
              View all 14 upcoming tasks →
            </button>

          </div>

        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#0f172a] shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/[0.05]" />
        <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border border-white/[0.04]" />
        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
              <Factory size={18} className="text-slate-300" />
            </div>

            <div>
              <p className="text-xs font-semibold text-white">
                Mill Production & Stock Readiness
              </p>

              <p className="mt-1 text-[11px] leading-5 text-black">
                Current Line-2 running at 91.4% efficiency · Next maintenance
                cycle in 72 hours
              </p>
            </div>

          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-medium text-black">

            <span>
              Galvanized Coils:{" "}
              <strong className="text-slate-200">
                48.2 MT
              </strong>
            </span>

            <span className="hidden text-black sm:block">
              •
            </span>

            <span>
              Stocked / Consumable:{" "}
              <strong className="text-slate-200">
                183 MT
              </strong>
            </span>

          </div>

        </div>
      </div>

    </div>
  );
}

function OrderStatus({ status }) {
  const styles = {
    Confirmed:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    Processing:
      "border-amber-200 bg-amber-50 text-amber-700",
    Dispatched:
      "border-blue-200 bg-blue-50 text-blue-700",
    Delivered:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-semibold ${
        styles[status] ||
        "border-slate-200 bg-slate-50 text-black"
      }`}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const isHigh = priority === "High";

  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
        isHigh
          ? "bg-red-50 text-red-600"
          : "bg-amber-50 text-amber-600"
      }`}
    >
      {priority}
    </span>
  );
}

export default Dashboard;