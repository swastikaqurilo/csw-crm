import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";

import {
  getRevenueDashboard,
  exportRevenueLedger,
} from "../api/api";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const FISCAL_MONTHS = [
  4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3,
];

function getCurrentFiscalYear() {
  const now = new Date();
  const month = now.getMonth() + 1;

  return month < 4
    ? now.getFullYear() - 1
    : now.getFullYear();
}

function getCurrentQuarter() {
  const month = new Date().getMonth() + 1;

  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;

  return 4;
}

function formatCurrency(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function TrendChart({ trend }) {
  const chartPoints = useMemo(() => {
    const visible = trend.filter(
      (item) => !item.isFuture
    );

    if (!visible.length) {
      return [];
    }

    const maxValue = Math.max(
      1,
      ...visible.map((item) =>
        Number(item.revenue || 0)
      )
    );

    return visible.map((item, index) => {
      const x =
        visible.length === 1
          ? 320
          : 24 +
            (index / (visible.length - 1)) *
              592;

      const y =
        155 -
        (Number(item.revenue || 0) /
          maxValue) *
          125;

      return {
        ...item,
        x,
        y,
      };
    });
  }, [trend]);

  const path = chartPoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${
          point.y
        }`
    )
    .join(" ");

  const labelStep = Math.max(
    1,
    Math.ceil(chartPoints.length / 7)
  );

  if (!chartPoints.length) {
    return (
      <div className="empty-state">
        <FileText size={20} />
        <p>
          No collection activity for this period.
        </p>
      </div>
    );
  }

  return (
    <>
      <svg
        className="rev-line-chart"
        viewBox="0 0 640 200"
        preserveAspectRatio="none"
        role="img"
        aria-label="Revenue collections trend"
      >
        <line
          x1="24"
          y1="30"
          x2="616"
          y2="30"
          stroke="var(--color-border)"
        />

        <line
          x1="24"
          y1="92"
          x2="616"
          y2="92"
          stroke="var(--color-border)"
        />

        <line
          x1="24"
          y1="155"
          x2="616"
          y2="155"
          stroke="var(--color-border)"
        />

        <path
          d={path}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chartPoints.map((point) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="var(--color-brand-600)"
          >
            <title>
              {point.key}:{" "}
              {formatCurrency(point.revenue)}
            </title>
          </circle>
        ))}

        {chartPoints.map(
          (point, index) =>
            (index % labelStep === 0 ||
              index === chartPoints.length - 1) && (
              <text
                key={`${point.key}-label`}
                x={point.x}
                y="184"
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
              >
                {point.label}
              </text>
            )
        )}
      </svg>

      <details>
        <summary className="text-sm">
          View collection details
        </summary>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>PERIOD</th>
                <th>COLLECTED</th>
                <th>PAYMENTS</th>
              </tr>
            </thead>

            <tbody>
              {trend.map((item) => (
                <tr key={item.key}>
                  <td>{item.key}</td>

                  <td>
                    {item.isFuture
                      ? "Not started"
                      : formatCurrency(
                          item.revenue
                        )}
                  </td>

                  <td>
                    {item.isFuture
                      ? "—"
                      : formatNumber(
                          item.paymentCount
                        )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export default function Revenue() {
  const [filters, setFilters] = useState({
    period: "fy",
    fiscalYear: String(
      getCurrentFiscalYear()
    ),
    month: String(
      new Date().getMonth() + 1
    ),
    quarter: String(
      getCurrentQuarter()
    ),
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] =
    useState(false);
  const [downloading, setDownloading] =
    useState(false);
  const [downloadError, setDownloadError] =
    useState("");

  const [yearInput, setYearInput] =
    useState(
      String(getCurrentFiscalYear())
    );

  const [yearError, setYearError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRevenue() {
      setLoading(true);
      setError("");

      try {
        const response =
          await getRevenueDashboard(filters);

        if (!response.data?.success) {
          throw new Error(
            response.data?.message ||
              "Unable to load revenue"
          );
        }

        if (mounted) {
          setData(response.data.data);
        }
      } catch (err) {
        if (mounted) {
          setData(null);

          setError(
            getErrorMessage(
              err,
              "Unable to load revenue dashboard"
            )
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadRevenue();

    return () => {
      mounted = false;
    };
  }, [filters]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function changePeriod(period) {
    setFilters((current) => ({
      ...current,
      period,
    }));
  }

  function applyYear(event) {
    event.preventDefault();

    const value = yearInput.trim();

    if (
      !/^\d{4}$/.test(value) ||
      Number(value) < 2000 ||
      Number(value) > 9997
    ) {
      setYearError(
        "Enter a valid fiscal year."
      );
      return;
    }

    setYearError("");

    updateFilter("fiscalYear", value);
  }

  function handleRefresh() {
    setRefreshing(true);

    setFilters((current) => ({
      ...current,
    }));
  }

  async function handleDownload() {
    if (!data || downloading) {
      return;
    }

    setDownloading(true);
    setDownloadError("");

    try {
      const response =
        await exportRevenueLedger(
          data.meta.filters
        );

      const blob = response.data;

      if (!(blob instanceof Blob)) {
        throw new Error(
          "The server did not return a CSV file."
        );
      }

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `revenue-${data.meta.filters.period}-${data.meta.filters.fiscalYear}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(
        getErrorMessage(
          err,
          "Unable to download revenue ledger"
        )
      );
    } finally {
      setDownloading(false);
    }
  }

  const summary = data?.summary;
  const health = data?.health;
  const growth = summary?.growthPercent;

  return (
    <div className="revenue-ops-page">

      {/* PAGE HEADER */}
      <div className="page-heading">

        <div>
          <div className="rev-breadcrumb">
            Finance <span>/</span> Payment
            Collections
          </div>

          <h1>Revenue Operations</h1>

          <p>
            Monitor cash collections, payment
            channels, and reconciliation.
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={
              loading ||
              downloading ||
              !data
            }
          >
            <Download size={15} />

            {downloading
              ? "Downloading..."
              : "Ledger CSV"}
          </button>
        </div>

      </div>

      {/* COMPACT REPORT FILTER */}
      <div className="card mb-5">

        <div className="card-body">

          <div className="flex items-end gap-3">

            {/* Fiscal Year */}
            <form
              className="form-group"
              onSubmit={applyYear}
            >
              <label
                className="form-label"
                htmlFor="revenue-fiscal-year"
              >
                Fiscal Year
              </label>

              <input
                id="revenue-fiscal-year"
                className={
                  yearError
                    ? "input is-invalid"
                    : "input"
                }
                type="number"
                min="2000"
                max="9997"
                value={yearInput}
                onChange={(event) =>
                  setYearInput(
                    event.target.value
                  )
                }
              />
            </form>

            {/* Period */}
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="revenue-period"
              >
                Period
              </label>

              <select
                id="revenue-period"
                className="select"
                value={filters.period}
                onChange={(event) =>
                  changePeriod(
                    event.target.value
                  )
                }
              >
                <option value="fy">
                  Fiscal Year
                </option>

                <option value="month">
                  Monthly
                </option>

                <option value="quarter">
                  Quarterly
                </option>
              </select>
            </div>

            {/* Month */}
            {filters.period === "month" && (
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="revenue-month"
                >
                  Month
                </label>

                <select
                  id="revenue-month"
                  className="select"
                  value={filters.month}
                  onChange={(event) =>
                    updateFilter(
                      "month",
                      event.target.value
                    )
                  }
                >
                  {FISCAL_MONTHS.map(
                    (month) => (
                      <option
                        key={month}
                        value={month}
                      >
                        {MONTHS[month - 1]}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            {/* Quarter */}
            {filters.period === "quarter" && (
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="revenue-quarter"
                >
                  Quarter
                </label>

                <select
                  id="revenue-quarter"
                  className="select"
                  value={filters.quarter}
                  onChange={(event) =>
                    updateFilter(
                      "quarter",
                      event.target.value
                    )
                  }
                >
                  <option value="1">
                    Q1 · Apr–Jun
                  </option>

                  <option value="2">
                    Q2 · Jul–Sep
                  </option>

                  <option value="3">
                    Q3 · Oct–Dec
                  </option>

                  <option value="4">
                    Q4 · Jan–Mar
                  </option>
                </select>
              </div>
            )}

            {/* Apply */}
            <div className="form-group">
              <label className="form-label">
                &nbsp;
              </label>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  applyYear({
                    preventDefault: () => {},
                  })
                }
              >
                Apply
              </button>
            </div>

            {/* Refresh */}
            <div className="form-group">
              <label className="form-label">
                &nbsp;
              </label>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh report"
              >
                <RefreshCw
                  size={14}
                  className={
                    refreshing
                      ? "spin"
                      : ""
                  }
                />

                Refresh
              </button>
            </div>

          </div>

          {yearError && (
            <div className="form-error mt-2">
              {yearError}
            </div>
          )}

        </div>
      </div>

      {/* ERRORS */}
      {!loading && error && (
        <div className="alert alert-danger mb-5">

          <FileText size={16} />

          <div>
            <strong>
              Unable to load revenue
            </strong>

            <div>{error}</div>

            <button
              type="button"
              className="btn btn-secondary btn-sm mt-3"
              onClick={handleRefresh}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>

        </div>
      )}

      {downloadError && (
        <div className="alert alert-danger mb-5">
          <FileText size={16} />

          <div>{downloadError}</div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="card mb-5">
          <div className="card-body">
            <p>
              Loading revenue collections...
            </p>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {!loading && !error && data && (
        <>
          {/* REPORT INFO */}
          <div className="card mb-5">

            <div className="card-body">

              <div className="flex items-center justify-between gap-3">

                <div>
                  <div className="text-xs text-muted">
                    REPORTING PERIOD
                  </div>

                  <strong className="text-md">
                    {data.meta.label}
                  </strong>
                </div>

                <div className="text-sm text-muted">
                  {data.meta.startDate}
                  {" → "}
                  {data.meta.isPartialPeriod
                    ? "Period to date"
                    : data.meta.endDateExclusive}
                </div>

              </div>

              <p className="text-sm mt-3">
                Cash collections from active
                completed payments based on
                payment date.
              </p>

            </div>
          </div>

          {/* FUTURE PERIOD */}
          {data.meta.isFuturePeriod && (
            <div className="alert alert-warning mb-5">
              <FileText size={16} />

              <span>
                This reporting period has not
                started. Future-dated payments are
                excluded.
              </span>
            </div>
          )}

          {/* COMPLETED BUT NOT APPLIED */}
          {health?.completedNotAppliedCount >
            0 && (
            <div className="alert alert-warning mb-5">
              <FileText size={16} />

              <span>
                {formatNumber(
                  health.completedNotAppliedCount
                )}{" "}
                completed payments are not marked
                as applied to their orders.
              </span>
            </div>
          )}

          {/* KPI */}
          <div className="stats-grid">

            <div className="stat-card">
              <div className="stat-top">
                <span className="rev-kpi-label">
                  CASH COLLECTED
                </span>
              </div>

              <div className="stat-value">
                {formatCurrency(
                  summary.revenue
                )}
              </div>

              <div
                className={
                  growth != null &&
                  growth < 0
                    ? "stat-change negative"
                    : "stat-change"
                }
              >
                {growth == null ? (
                  "No comparable prior period"
                ) : (
                  <>
                    {growth < 0 ? (
                      <ArrowDownRight
                        size={13}
                      />
                    ) : (
                      <ArrowUpRight
                        size={13}
                      />
                    )}

                    {growth > 0 ? "+" : ""}
                    {growth.toFixed(2)}%
                    {" "}vs prior period
                  </>
                )}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="rev-kpi-label">
                  COMPLETED PAYMENTS
                </span>
              </div>

              <div className="stat-value">
                {formatNumber(
                  summary.paymentCount
                )}
              </div>

              <div className="stat-change">
                Active completed receipts
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="rev-kpi-label">
                  ORDERS WITH COLLECTIONS
                </span>
              </div>

              <div className="stat-value">
                {formatNumber(
                  summary.ordersWithPayments
                )}
              </div>

              <div className="stat-change">
                Distinct orders receiving
                collections
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="rev-kpi-label">
                  AVERAGE PAYMENT
                </span>
              </div>

              <div className="stat-value">
                {formatCurrency(
                  summary.averagePayment
                )}
              </div>

              <div className="stat-change">
                Average completed receipt
              </div>
            </div>

          </div>

          {/* TREND + HEALTH */}
          <div className="rev-middle-grid">

            {/* TREND */}
            <div className="card">

              <div className="card-header">

                <div>
                  <h2 className="card-title">
                    Collections Trend
                  </h2>

                  <p className="card-subtitle">
                    Completed payments by payment
                    date.
                  </p>
                </div>

              </div>

              <div className="card-body">

                <TrendChart
                  trend={data.trend}
                />

              </div>
            </div>

            {/* HEALTH */}
            <div className="card">

              <div className="card-header">

                <div>
                  <h2 className="card-title">
                    Payment Health
                  </h2>

                  <p className="card-subtitle">
                    Reconciliation status for
                    collected payments.
                  </p>
                </div>

              </div>

              <div className="card-body">

                <div className="rev-matrix">

                  <div className="rev-matrix-row">
                    <span>
                      Reconciled collections
                    </span>

                    <strong>
                      {formatCurrency(
                        health.reconciledRevenue
                      )}
                    </strong>
                  </div>

                  <div className="rev-matrix-row">
                    <span>
                      Unreconciled collections
                    </span>

                    <strong>
                      {formatCurrency(
                        health.unreconciledRevenue
                      )}
                    </strong>
                  </div>

                  <div className="rev-matrix-row">
                    <span>
                      Reconciliation rate
                    </span>

                    <strong>
                      {health.reconciliationPercent ==
                      null
                        ? "—"
                        : `${health.reconciliationPercent.toFixed(
                            2
                          )}%`}
                    </strong>
                  </div>

                  <div className="rev-matrix-row">
                    <span>
                      Previous comparable
                    </span>

                    <strong>
                      {formatCurrency(
                        summary.previousRevenue
                      )}
                    </strong>
                  </div>

                </div>

              </div>
            </div>

          </div>

          {/* PAYMENT MODES */}
          <div className="card mb-5">

            <div className="card-header">

              <div>
                <h2 className="card-title">
                  Collections by Payment Mode
                </h2>

                <p className="card-subtitle">
                  Completed collections grouped by
                  payment channel.
                </p>
              </div>

              <strong>
                {formatCurrency(
                  summary.revenue
                )}
              </strong>

            </div>

            <div className="card-body">

              {data.byMode.length === 0 ? (
                <p>
                  No payment modes found for this
                  period.
                </p>
              ) : (
                <div className="rev-product-grid">

                  {data.byMode.map((mode) => (
                    <div
                      className="rev-product-card"
                      key={mode.mode}
                    >

                      <div className="rev-product-top">

                        <strong>
                          {mode.mode}
                        </strong>

                        <span className="badge badge-brand">
                          {mode.sharePercent ==
                          null
                            ? "0.00"
                            : mode.sharePercent.toFixed(
                                2
                              )}
                          %
                        </span>

                      </div>

                      <div className="rev-product-revenue">
                        {formatCurrency(
                          mode.revenue
                        )}
                      </div>

                      <div className="rev-product-footer">
                        <span>
                          {formatNumber(
                            mode.paymentCount
                          )}{" "}
                          completed payments
                        </span>
                      </div>

                    </div>
                  ))}

                </div>
              )}

            </div>
          </div>

          {/* STATUS BREAKDOWN */}
          <div className="card mb-5">

            <div className="card-header">

              <div>
                <h2 className="card-title">
                  Payment Status Breakdown
                </h2>

                <p className="card-subtitle">
                  Payment records within the
                  selected reporting period.
                </p>
              </div>

            </div>

            <div className="card-body">

              <div className="rev-matrix">

                {data.byStatus.map((row) => (
                  <div
                    className="rev-matrix-row"
                    key={row.status}
                  >
                    <span>
                      {row.status}
                    </span>

                    <strong>
                      {formatCurrency(
                        row.amount
                      )}
                    </strong>

                    <span>
                      {formatNumber(
                        row.paymentCount
                      )}{" "}
                      payments
                    </span>
                  </div>
                ))}

              </div>

            </div>
          </div>

          {/* RECENT COLLECTIONS */}
          <div className="card">

            <div className="card-header">

              <div>
                <h2 className="card-title">
                  Recent Collections
                </h2>

                <p className="card-subtitle">
                  Latest completed payment
                  collections for this report.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownload}
                disabled={downloading}
              >
                <Download size={14} />

                {downloading
                  ? "Downloading..."
                  : "Export Ledger"}
              </button>

            </div>

            <div className="table-wrap">

              <table className="table">

                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>CLIENT</th>
                    <th>PAYMENT</th>
                    <th>ORDER</th>
                    <th>MODE</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>

                  {data.recentPayments.length ===
                    0 && (
                    <tr>
                      <td colSpan="7">
                        No completed payments found.
                      </td>
                    </tr>
                  )}

                  {data.recentPayments.map(
                    (payment) => (
                      <tr key={payment.id}>

                        <td>
                          {formatDate(
                            payment.paymentDate
                          )}
                        </td>

                        <td>
                          <strong>
                            {payment.client}
                          </strong>

                          {payment.contactName && (
                            <div className="text-xs text-muted">
                              {
                                payment.contactName
                              }
                            </div>
                          )}
                        </td>

                        <td>
                          {payment.paymentNumber}
                        </td>

                        <td>
                          {payment.orderNumber}
                        </td>

                        <td>
                          {payment.paymentMode}
                        </td>

                        <td>
                          <strong>
                            {formatCurrency(
                              payment.amount,
                              payment.currency
                            )}
                          </strong>
                        </td>

                        <td>
                          <span className="status status-resolved">
                            Completed
                          </span>

                          {payment.isReconciled && (
                            <span className="badge badge-success ml-2">
                              Reconciled
                            </span>
                          )}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>
              </table>
            </div>

            <div className="card-footer">

              <span className="text-sm text-muted">
                Showing the latest{" "}
                {data.meta.recentLimit} completed
                collections.
              </span>

              <span className="text-sm text-muted">
                As of{" "}
                {new Date(
                  data.meta.asOf
                ).toLocaleString("en-IN")}
              </span>

            </div>

          </div>
        </>
      )}

    </div>
  );
}