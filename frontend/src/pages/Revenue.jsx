import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileText,
  RefreshCw,
  Wallet,
  CreditCard,
  Receipt,
  Landmark,
  CheckCircle2,
  AlertCircle,
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

function getModeIcon(mode) {
  const value = String(mode || "").toLowerCase();

  if (
    value.includes("bank") ||
    value.includes("transfer") ||
    value.includes("neft") ||
    value.includes("rtgs") ||
    value.includes("imps")
  ) {
    return Landmark;
  }

  if (
    value.includes("card") ||
    value.includes("credit") ||
    value.includes("debit")
  ) {
    return CreditCard;
  }

  if (
    value.includes("cash") ||
    value.includes("cheque") ||
    value.includes("check")
  ) {
    return Wallet;
  }

  return Receipt;
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
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const labelStep = Math.max(
    1,
    Math.ceil(chartPoints.length / 7)
  );

  if (!chartPoints.length) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <FileText size={20} />
        <p className="text-sm">
          No collection activity for this period.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="w-full overflow-hidden">
        <svg
          className="h-[250px] w-full"
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
            stroke="currentColor"
            className="text-slate-200"
          />

          <line
            x1="24"
            y1="92"
            x2="616"
            y2="92"
            stroke="currentColor"
            className="text-slate-200"
          />

          <line
            x1="24"
            y1="155"
            x2="616"
            y2="155"
            stroke="currentColor"
            className="text-slate-200"
          />

          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#002244]"
          />

          {chartPoints.map((point) => (
            <circle
              key={point.key}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="currentColor"
              className="text-[#002244]"
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
                  className="text-slate-400"
                >
                  {point.label}
                </text>
              )
          )}
        </svg>
      </div>

      <details className="group">
        <summary className="cursor-pointer select-none text-sm font-medium text-slate-600 transition hover:text-slate-900">
          View collection details
        </summary>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Period
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Collected
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Payments
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {trend.map((item) => (
                  <tr
                    key={item.key}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {item.key}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-600">
                      {item.isFuture
                        ? "Not started"
                        : formatCurrency(
                            item.revenue
                          )}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-600">
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
        </div>
      </details>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
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
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span>Finance</span>
            <span>/</span>
            <span>Payment Collections</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Revenue Operations
          </h1>

          <p className="mt-1.5 text-sm text-slate-500">
            Monitor cash collections, payment
            channels, and reconciliation.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={
            loading ||
            downloading ||
            !data
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#00345f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />

          {downloading
            ? "Downloading..."
            : "Ledger CSV"}
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-end">
          <form
            className="w-full xl:w-40"
            onSubmit={applyYear}
          >
            <label
              className="mb-1.5 block text-xs font-medium text-slate-600"
              htmlFor="revenue-fiscal-year"
            >
              Fiscal Year
            </label>

            <input
              id="revenue-fiscal-year"
              type="number"
              min="2000"
              max="9997"
              value={yearInput}
              onChange={(event) =>
                setYearInput(
                  event.target.value
                )
              }
              className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10 ${
                yearError
                  ? "border-red-300"
                  : "border-slate-200"
              }`}
            />
          </form>

          <div className="w-full xl:w-44">
            <label
              className="mb-1.5 block text-xs font-medium text-slate-600"
              htmlFor="revenue-period"
            >
              Period
            </label>

            <select
              id="revenue-period"
              value={filters.period}
              onChange={(event) =>
                changePeriod(
                  event.target.value
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
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

          {filters.period === "month" && (
            <div className="w-full xl:w-36">
              <label
                className="mb-1.5 block text-xs font-medium text-slate-600"
                htmlFor="revenue-month"
              >
                Month
              </label>

              <select
                id="revenue-month"
                value={filters.month}
                onChange={(event) =>
                  updateFilter(
                    "month",
                    event.target.value
                  )
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
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

          {filters.period === "quarter" && (
            <div className="w-full xl:w-44">
              <label
                className="mb-1.5 block text-xs font-medium text-slate-600"
                htmlFor="revenue-quarter"
              >
                Quarter
              </label>

              <select
                id="revenue-quarter"
                value={filters.quarter}
                onChange={(event) =>
                  updateFilter(
                    "quarter",
                    event.target.value
                  )
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#002244] focus:ring-2 focus:ring-[#002244]/10"
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                applyYear({
                  preventDefault: () => {},
                })
              }
              className="h-10 rounded-lg bg-[#002244] px-4 text-sm font-medium text-white transition hover:bg-[#00345f]"
            >
              Apply
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh report"
            >
              <RefreshCw
                size={14}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </div>

        {yearError && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600">
            {yearError}
          </div>
        )}
      </div>

      {/* ERRORS */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div>
            <strong className="text-sm font-semibold">
              Unable to load revenue
            </strong>

            <p className="mt-1 text-sm">
              {error}
            </p>

            <button
              type="button"
              onClick={handleRefresh}
              className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition hover:bg-red-50"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        </div>
      )}

      {downloadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <FileText
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span className="text-sm">
            {downloadError}
          </span>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <RefreshCw
              size={16}
              className="animate-spin"
            />
            Loading revenue collections...
          </div>
        </div>
      )}

      {/* CONTENT */}
      {!loading && !error && data && (
        <div className="space-y-5">
          {/* REPORT INFO */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Reporting Period
                </div>

                <h2 className="text-base font-semibold text-slate-900">
                  {data.meta.label}
                </h2>
              </div>

              <div className="text-sm text-slate-500">
                {data.meta.startDate}
                {" → "}
                {data.meta.isPartialPeriod
                  ? "Period to date"
                  : data.meta.endDateExclusive}
              </div>
            </div>

            <div className="border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-500">
                Cash collections from active
                completed payments based on
                payment date.
              </p>
            </div>
          </div>

          {/* FUTURE PERIOD */}
          {data.meta.isFuturePeriod && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertCircle size={17} />

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
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertCircle size={17} />

              <span>
                {formatNumber(
                  health.completedNotAppliedCount
                )}{" "}
                completed payments are not marked
                as applied to their orders.
              </span>
            </div>
          )}

          {/* KPI GRID */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Cash Collected */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cash Collected
                </span>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#002244]">
                  <Wallet size={17} />
                </div>
              </div>

              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {formatCurrency(
                  summary.revenue
                )}
              </div>

              <div
                className={`mt-2 flex items-center gap-1 text-xs font-medium ${
                  growth != null &&
                  growth < 0
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
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
                    <span className="ml-1 font-normal text-slate-400">
                      vs prior period
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Completed Payments */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Completed Payments
                </span>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#002244]">
                  <CheckCircle2 size={17} />
                </div>
              </div>

              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {formatNumber(
                  summary.paymentCount
                )}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                Active completed receipts
              </div>
            </div>

            {/* Orders With Collections */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Orders With Collections
                </span>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#002244]">
                  <Receipt size={17} />
                </div>
              </div>

              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {formatNumber(
                  summary.ordersWithPayments
                )}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                Distinct orders receiving
                collections
              </div>
            </div>

            {/* Average Payment */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Average Payment
                </span>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#002244]">
                  <CreditCard size={17} />
                </div>
              </div>

              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {formatCurrency(
                  summary.averagePayment
                )}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                Average completed receipt
              </div>
            </div>
          </div>

          {/* TREND + HEALTH */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* TREND */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                title="Collections Trend"
                description="Completed payments by payment date."
              />

              <div className="p-5">
                <TrendChart
                  trend={data.trend}
                />
              </div>
            </div>

            {/* HEALTH */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                title="Payment Health"
                description="Reconciliation status for collected payments."
              />

              <div className="p-5">
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-4 px-4 py-4">
                    <span className="text-sm text-slate-500">
                      Reconciled collections
                    </span>

                    <strong className="text-sm font-semibold text-slate-900">
                      {formatCurrency(
                        health.reconciledRevenue
                      )}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-4 py-4">
                    <span className="text-sm text-slate-500">
                      Unreconciled collections
                    </span>

                    <strong className="text-sm font-semibold text-slate-900">
                      {formatCurrency(
                        health.unreconciledRevenue
                      )}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-4 py-4">
                    <span className="text-sm text-slate-500">
                      Reconciliation rate
                    </span>

                    <strong className="text-sm font-semibold text-slate-900">
                      {health.reconciliationPercent ==
                      null
                        ? "—"
                        : `${health.reconciliationPercent.toFixed(
                            2
                          )}%`}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-4 py-4">
                    <span className="text-sm text-slate-500">
                      Previous comparable
                    </span>

                    <strong className="text-sm font-semibold text-slate-900">
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Collections by Payment Mode"
              description="Completed collections grouped by payment channel."
              action={
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(
                    summary.revenue
                  )}
                </span>
              }
            />

            <div className="p-5">
              {data.byMode.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-400">
                  No payment modes found for this
                  period.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {data.byMode.map((mode) => {
                    const Icon =
                      getModeIcon(mode.mode);

                    return (
                      <div
                        key={mode.mode}
                        className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[#002244]">
                              <Icon size={16} />
                            </div>

                            <strong className="text-sm font-semibold text-slate-800">
                              {mode.mode}
                            </strong>
                          </div>

                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                            {mode.sharePercent ==
                            null
                              ? "0.00"
                              : mode.sharePercent.toFixed(
                                  2
                                )}
                            %
                          </span>
                        </div>

                        <div className="mt-5 text-lg font-semibold text-slate-900">
                          {formatCurrency(
                            mode.revenue
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {formatNumber(
                            mode.paymentCount
                          )}{" "}
                          completed payments
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* STATUS BREAKDOWN */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Payment Status Breakdown"
              description="Payment records within the selected reporting period."
            />

            <div className="p-5">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Status
                        </th>

                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Amount
                        </th>

                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Payments
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {data.byStatus.map(
                        (row) => (
                          <tr
                            key={row.status}
                            className="transition hover:bg-slate-50"
                          >
                            <td className="px-4 py-3 font-medium text-slate-700">
                              {row.status}
                            </td>

                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {formatCurrency(
                                row.amount
                              )}
                            </td>

                            <td className="px-4 py-3 text-right text-slate-500">
                              {formatNumber(
                                row.paymentCount
                              )}
                            </td>
                          </tr>
                        )
                      )}

                      {data.byStatus.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan="3"
                            className="px-4 py-10 text-center text-sm text-slate-400"
                          >
                            No payment records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* RECENT COLLECTIONS */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="Recent Collections"
              description="Latest completed payment collections for this report."
              action={
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={13} />

                  {downloading
                    ? "Downloading..."
                    : "Export Ledger"}
                </button>
              }
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Date
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Client
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Payment
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Order
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Mode
                    </th>

                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Amount
                    </th>

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {data.recentPayments.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        No completed payments
                        found.
                      </td>
                    </tr>
                  )}

                  {data.recentPayments.map(
                    (payment) => (
                      <tr
                        key={payment.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatDate(
                            payment.paymentDate
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <strong className="font-medium text-slate-800">
                            {payment.client}
                          </strong>

                          {payment.contactName && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              {
                                payment.contactName
                              }
                            </div>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">
                          {
                            payment.paymentNumber
                          }
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {payment.orderNumber}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {payment.paymentMode}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                          {formatCurrency(
                            payment.amount,
                            payment.currency
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Completed
                            </span>

                            {payment.isReconciled && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                                Reconciled
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing the latest{" "}
                {data.meta.recentLimit} completed
                collections.
              </span>

              <span>
                As of{" "}
                {new Date(
                  data.meta.asOf
                ).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}