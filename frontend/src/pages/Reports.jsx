import {
  Download,
  Inbox,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Package,
  AlertTriangle,
  FileText,
} from "lucide-react";

const topStats = [
  {
    label: "TOTAL ENQUIRIES",
    value: "148",
    meta: "+12.5% vs last month",
    icon: Inbox,
  },
  {
    label: "CONVERSION RATE",
    value: "41.8%",
    meta: "Target: 38%",
    icon: TrendingUp,
    highlight: true,
  },
  {
    label: "NEW ENQUIRIES",
    value: "32",
    meta: "Active Cycle",
    icon: Clock,
  },
  {
    label: "LAST PROCESSED",
    value: "9 hrs ago",
    meta: "Avg response from operations",
    icon: CheckCircle2,
  },
];

const productPerformance = [
  { name: "GI Wire (Standard)", revenue: "₹8.45L", share: 28 },
  { name: "Concertina Wire", revenue: "₹7.12L", share: 24 },
  { name: "Barbed Wire (Heavy)", revenue: "₹5.60L", share: 19 },
  { name: "PVC Coated Wire Green", revenue: "₹4.80L", share: 16 },
  { name: "Binding Wire", revenue: "₹2.45L", share: 8 },
  { name: "Welded Wire Mesh Panels", revenue: "₹1.50L", share: 5 },
];

const customerPerformance = [
  { rank: 1, name: "Larsen & Toubro Infra", value: "₹12.40L", orders: 8 },
  { rank: 2, name: "Delhi Metro Rail Corp", value: "₹9.50L", orders: 5 },
  { rank: 3, name: "GMR Airport Projects", value: "₹7.75L", orders: 4 },
  { rank: 4, name: "Reliance Protechem", value: "₹5.30L", orders: 3 },
  { rank: 5, name: "SecureLand Projects", value: "₹3.45L", orders: 3 },
];

function Reports() {
  return (
    <div className="reports-page">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <div className="reports-breadcrumb">
            ANALYTICS & PERFORMANCE <span>•</span> FY 2025-26
          </div>
          <h1>Reports</h1>
          <p>
            Comprehensive analytical and operational performance across commercial and
            supply pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="reports-period-tabs">
            <button>Today</button>
            <button>7 days</button>
            <button className="active">30 days</button>
            <button>Custom Range</button>
          </div>
          <button className="btn btn-primary">
            <Download size={15} />
            Export Report
          </button>
        </div>
      </div>

      {/* TOP STATS */}
      <div className="stats-grid">
        {topStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="stat-card" key={stat.label}>
              <div className="stat-top">
                <div className="stat-icon">
                  <Icon size={17} />
                </div>
                {stat.highlight && (
                  <span className="badge badge-success">
                    <ArrowUpRight size={11} />
                    Above Target
                  </span>
                )}
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-title">{stat.label}</div>
              <div className="stat-change">{stat.meta}</div>
            </div>
          );
        })}
      </div>

      {/* 1. ENQUIRY PIPELINE ANALYTICS */}
      <div className="card mb-5">
        <div className="card-header">
          <div>
            <h2 className="card-title">1. ENQUIRY PIPELINE ANALYTICS</h2>
            <p className="card-subtitle">
              Enquiries Generated vs Converted over time
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm active">Generated</button>
            <button className="btn btn-secondary btn-sm">Converted</button>
          </div>
        </div>

        <div className="card-body">
          {/* Chart */}
          <div className="reports-chart-wrap">
            <svg viewBox="0 0 700 200" className="reports-line-chart">
              {/* Grid */}
              <line x1="0" y1="40" x2="700" y2="40" stroke="var(--color-ink-100)" />
              <line x1="0" y1="100" x2="700" y2="100" stroke="var(--color-ink-100)" />
              <line x1="0" y1="160" x2="700" y2="160" stroke="var(--color-ink-100)" />

              {/* Area */}
              <path
                d="M0,160 L70,140 L140,120 L210,130 L280,90 L350,70 L420,60 L490,75 L560,50 L630,45 L700,55 L700,200 L0,200 Z"
                fill="url(#reportsGradient)"
                opacity="0.2"
              />

              {/* Generated line */}
              <path
                d="M0,160 L70,140 L140,120 L210,130 L280,90 L350,70 L420,60 L490,75 L560,50 L630,45 L700,55"
                fill="none"
                stroke="var(--color-brand-500)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Converted line */}
              <path
                d="M0,175 L70,165 L140,155 L210,160 L280,140 L350,125 L420,115 L490,130 L560,110 L630,105 L700,115"
                fill="none"
                stroke="var(--color-success-500)"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />

              <defs>
                <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand-500)" />
                  <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            <div className="reports-chart-labels">
              <span>01 Sep</span>
              <span>05 Sep</span>
              <span>10 Sep</span>
              <span>15 Sep</span>
              <span>20 Sep</span>
              <span>25 Sep</span>
              <span>30 Sep</span>
            </div>
          </div>

          {/* Bottom metrics */}
          <div className="reports-metrics-row">
            <div className="reports-metric">
              <span className="text-muted text-xs">Avg Response Time</span>
              <strong>2.4 hrs</strong>
            </div>
            <div className="reports-metric">
              <span className="text-muted text-xs">Avg Cycle</span>
              <strong>3.8 days</strong>
            </div>
            <div className="reports-metric">
              <span className="text-muted text-xs">Closing Success</span>
              <strong>34.2%</strong>
            </div>
            <div className="reports-metric">
              <span className="text-muted text-xs">Target Conversion</span>
              <strong>38%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE ROW */}
      <div className="reports-middle-grid mb-5">
        {/* Sales Analytics */}
        <div className="reports-sales-card">
          <div className="reports-sales-header">
            <span className="text-xs font-semibold opacity-80">2. Sales Analytics</span>
            <span className="badge badge-brand">24 Active</span>
          </div>
          <div className="reports-sales-value">₹33.08L</div>
          <div className="reports-sales-meta">YTD Pipeline Value</div>

          <div className="reports-sales-stats">
            <div>
              <span>Confirmed</span>
              <strong>₹13.20L</strong>
            </div>
            <div>
              <span>In Discussion</span>
              <strong>₹11.40L</strong>
            </div>
            <div>
              <span>Conversion</span>
              <strong>72.4%</strong>
            </div>
          </div>
        </div>

        {/* Product Performance */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">3. PRODUCT PERFORMANCE BREAKDOWN</h2>
              <p className="card-subtitle">Revenue contribution by product line</p>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="reports-product-list">
              {productPerformance.map((item) => (
                <div key={item.name} className="reports-product-row">
                  <div className="reports-product-info">
                    <strong>{item.name}</strong>
                    <div className="reports-product-bar-track">
                      <div
                        className="reports-product-bar"
                        style={{ width: `${item.share}%` }}
                      />
                    </div>
                  </div>
                  <div className="reports-product-value">
                    <strong>{item.revenue}</strong>
                    <span>{item.share}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="reports-bottom-grid mb-5">
        {/* Customer Performance */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">4. CUSTOMER PERFORMANCE</h2>
              <p className="card-subtitle">Ranked by order volume</p>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="reports-customer-list">
              {customerPerformance.map((item) => (
                <div key={item.rank} className="reports-customer-row">
                  <div className="reports-rank">{item.rank}</div>
                  <div className="reports-customer-info">
                    <strong>{item.name}</strong>
                    <span className="text-muted text-xs">{item.orders} orders</span>
                  </div>
                  <strong className="reports-customer-value">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Operations & Logistics */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">5. OPERATIONS & LOGISTICS</h2>
              <p className="card-subtitle">Inventory movement & fulfilment status</p>
            </div>
          </div>
          <div className="card-body">
            <div className="reports-ops-grid">
              <div className="reports-ops-item">
                <div className="reports-ops-icon">
                  <Package size={16} />
                </div>
                <div>
                  <span className="text-muted text-xs">INVENTORY MOVEMENT</span>
                  <strong>18.4 Metric Tonnes</strong>
                </div>
              </div>

              <div className="reports-ops-status">
                <div className="reports-ops-status-row">
                  <span className="status status-resolved">Dispatched</span>
                  <strong>12</strong>
                </div>
                <div className="reports-ops-status-row">
                  <span className="status status-in-progress">Processing</span>
                  <strong>8</strong>
                </div>
                <div className="reports-ops-status-row">
                  <span className="status status-new">Confirmed</span>
                  <strong>6</strong>
                </div>
              </div>
            </div>

            <div className="reports-alert">
              <AlertTriangle size={14} />
              <div>
                <strong>Critical Stock Alert</strong>
                <p>
                  Binding Wire (Standard) stock below threshold of 2.5 MT. Reorder
                  recommended.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer cards */}
      <div className="reports-footer-grid">
        <div className="reports-footer-card">
          <FileText size={18} />
          <div>
            <strong>Export Full Report</strong>
            <span>PDF / Excel / CSV formats available</span>
          </div>
          <button className="btn btn-secondary btn-sm">Download</button>
        </div>
        <div className="reports-footer-card">
          <CheckCircle2 size={18} />
          <div>
            <strong>Quality & Compliance</strong>
            <span>ISO 9001:2015 & ASTM certified shipments</span>
          </div>
          <button className="btn btn-secondary btn-sm">View Logs</button>
        </div>
      </div>
    </div>
  );
}

export default Reports;