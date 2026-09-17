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
  { name: "New Enquiries", count: "₹4.8L", pct: 40, color: "#3b82f6" },
  { name: "In Discussion", count: "₹3.2L", pct: 27, color: "#8b5cf6" },
  { name: "Confirmed", count: "₹2.4L", pct: 20, color: "#10b981" },
  { name: "Processing", count: "₹1.6L", pct: 13, color: "#f59e0b" },
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
    <div className="dashboard-page">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <div className="dash-breadcrumb">
            COMMAND CONSOLE <span>•</span> LIVE OPERATIONS
          </div>
          <h1>Good morning, Admin</h1>
          <p>Here’s what’s happening across enquiries, orders and revenue today.</p>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-secondary">View enquiries</button>
          <button className="btn btn-primary">+ New enquiry</button>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="stat-card" key={stat.label}>
              <div className="stat-top">
                <div className={`stat-icon dash-icon-${stat.accent}`}>
                  <Icon size={18} />
                </div>
                <ArrowUpRight size={15} className="stat-arrow" />
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-title">{stat.label}</div>
              <div className="stat-change">{stat.meta}</div>
            </div>
          );
        })}
      </div>

      {/* MIDDLE ROW — Chart + Pipeline */}
      <div className="dash-middle-grid">
        {/* Revenue Overview */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">FINANCIAL TRAJECTORY</h2>
              <p className="card-subtitle">Revenue Overview (FY 2025-26)</p>
            </div>
            <div className="dash-period-tabs">
              <button className="active">Monthly</button>
              <button>Quarterly</button>
              <button>FY 25-26</button>
            </div>
          </div>

          <div className="card-body">
            <div className="dash-revenue-summary">
              <div>
                <span className="text-muted text-xs">YTD Revenue</span>
                <strong className="dash-big-number">₹38.08 Lakhs</strong>
              </div>
              <div>
                <span className="text-muted text-xs">August Peak</span>
                <strong>₹7.35L</strong>
                <span className="text-success text-xs"> +24.1%</span>
              </div>
              <div>
                <span className="text-muted text-xs">Avg Monthly Run-Rate</span>
                <strong>₹5.51L / mo</strong>
              </div>
            </div>

            {/* Simple SVG Line Chart */}
            <div className="dash-chart-wrap">
              <svg viewBox="0 0 600 180" className="dash-line-chart">
                {/* Grid lines */}
                <line x1="0" y1="40" x2="600" y2="40" stroke="var(--color-ink-100)" strokeWidth="1" />
                <line x1="0" y1="90" x2="600" y2="90" stroke="var(--color-ink-100)" strokeWidth="1" />
                <line x1="0" y1="140" x2="600" y2="140" stroke="var(--color-ink-100)" strokeWidth="1" />

                {/* Area fill */}
                <path
                  d="M0,140 L40,120 L120,100 L200,110 L280,70 L360,50 L440,45 L520,60 L600,40 L600,180 L0,180 Z"
                  fill="url(#chartGradient)"
                  opacity="0.25"
                />

                {/* Line */}
                <path
                  d="M0,140 L40,120 L120,100 L200,110 L280,70 L360,50 L440,45 L520,60 L600,40"
                  fill="none"
                  stroke="var(--color-brand-500)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots */}
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
                  <circle key={i} cx={x} cy={y} r="4" fill="var(--color-brand-500)" />
                ))}

                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-500)" />
                    <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="dash-chart-labels">
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

        {/* Conversion Funnel */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">CONVERSION FUNNEL</h2>
              <p className="card-subtitle">Enquiry Pipeline</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Total Pipeline</div>
              <strong className="text-lg">₹12.0L</strong>
            </div>
          </div>

          <div className="card-body">
            <div className="dash-pipeline">
              {pipelineStages.map((stage) => (
                <div key={stage.name} className="dash-pipeline-row">
                  <div className="dash-pipeline-info">
                    <span className="dash-pipeline-name">{stage.name}</span>
                    <span className="dash-pipeline-count">{stage.count}</span>
                  </div>
                  <div className="dash-pipeline-bar-track">
                    <div
                      className="dash-pipeline-bar"
                      style={{
                        width: `${stage.pct}%`,
                        background: stage.color,
                      }}
                    />
                  </div>
                  <span className="dash-pipeline-pct">{stage.pct}%</span>
                </div>
              ))}
            </div>

            <div className="dash-conversion-rate">
              <span>Conversion Rate</span>
              <strong>41.8% Avg</strong>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW — Orders + Follow-ups */}
      <div className="dash-bottom-grid">
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">MANUFACTURING & LOGISTICS</h2>
              <p className="card-subtitle">Recent Orders</p>
            </div>
            <button className="text-button">View all orders</button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ORDER ID</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT / SPEC</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>DATE</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="font-mono font-semibold text-sm text-brand">
                        {order.id}
                      </span>
                    </td>
                    <td>
                      <strong className="text-sm">{order.customer}</strong>
                    </td>
                    <td className="text-sm">{order.product}</td>
                    <td>
                      <strong>{order.amount}</strong>
                    </td>
                    <td>
                      <span
                        className={`status ${
                          order.status === "Confirmed"
                            ? "status-resolved"
                            : order.status === "Processing"
                            ? "status-in-progress"
                            : "status-new"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="text-muted text-sm">{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dash-table-footer">
            <span className="text-sm text-muted">
              Showing 4 high-priority orders flagged for dispatch acceleration
            </span>
            <span className="text-sm">
              Total Batch Weight: <strong>2,840 Kg</strong>
            </span>
          </div>
        </div>

        {/* Today's Follow-ups */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">CLIENT SCHEDULE PLAN</h2>
              <p className="card-subtitle">Today’s Follow-ups</p>
            </div>
            <button className="text-button">View all</button>
          </div>

          <div className="dash-followups">
            {todayFollowUps.map((fu) => (
              <div key={fu.name} className="dash-fu-item">
                <div className="dash-fu-left">
                  <div className="avatar avatar-sm">
                    {fu.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <strong>
                      {fu.name}
                      <span
                        className={`badge badge-sm ${
                          fu.priority === "High" ? "badge-danger" : "badge-warning"
                        }`}
                        style={{ marginLeft: 6 }}
                      >
                        {fu.priority}
                      </span>
                    </strong>
                    <span className="text-muted text-xs">{fu.company}</span>
                  </div>
                </div>

                <div className="dash-fu-right">
                  <span className="dash-fu-time">{fu.time}</span>
                  <button className="btn btn-secondary btn-sm">
                    {fu.action === "Call" && <Phone size={12} />}
                    {fu.action === "Email" && <FileText size={12} />}
                    {fu.action === "Meeting" && <Calendar size={12} />}
                    {fu.action === "Payment" && <CreditCard size={12} />}
                    {fu.action}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="dash-fu-footer">
            <button className="text-button">View all 14 upcoming tasks →</button>
          </div>
        </div>
      </div>

      {/* Bottom Banner */}
      <div className="dash-banner">
        <div className="dash-banner-content">
          <strong>Mill Production & Stock Readiness</strong>
          <span>
            Current Line-2 running at 91.4% efficiency · Next maintenance cycle in 72 hours
          </span>
        </div>
        <div className="dash-banner-meta">
          <span>Galvanized Coils: 48.2 MT</span>
          <span>•</span>
          <span>Stocked / Consumable: 183 MT</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;