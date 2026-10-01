import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  Scale,
  Banknote,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  ChevronRight,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getAccountingDashboard } from "../api/api";

const accountingTabs = [
  { id: "overview", label: "Overview", icon: Wallet },
  { id: "payables", label: "Payables", icon: ArrowUpFromLine },
  { id: "accounts", label: "Chart of Accounts", icon: Landmark },
  { id: "profit-loss", label: "Profit & Loss", icon: TrendingUp },
  { id: "balance-sheet", label: "Balance Sheet", icon: Scale },
  { id: "cash-flow", label: "Cash Flow", icon: Banknote },
];

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
  return formatCurrency(amount);
}

const CARD =
  "rounded-[10px] border border-[var(--color-border)] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
const CARD_BODY = "p-[18px]";
const PAGE_SECTION = "flex flex-col gap-4";
const PAGE_HEADING = "flex items-start justify-between gap-4 max-[700px]:flex-col";
const STATS_GRID =
  "grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1";
const BTN =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-alt)] active:translate-y-px disabled:opacity-50";

function AccountingStat({ icon: Icon, title, value, change, negative = false }) {
  return (
    <div className="relative rounded-[10px] border border-[var(--color-border)] bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
          {title}
        </span>
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-800)] text-white">
          <Icon size={17} />
        </span>
      </div>
      <strong className="mt-3 block font-mono text-[21px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--color-text-primary)]">
        {value}
      </strong>
      {change && (
        <div
          className={`mt-[7px] flex items-center gap-1.5 text-[11.5px] font-semibold ${
            negative
              ? "text-[var(--color-danger-600)]"
              : "text-[var(--color-success-700)]"
          }`}
        >
          {negative ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
          {change}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const statusStyles = {
    Due: "border-[var(--color-warning-100)] bg-[var(--color-warning-50)] text-[var(--color-warning-600)]",
    Pending:
      "border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]",
    Overdue:
      "border-[var(--color-danger-100)] bg-[var(--color-danger-50)] text-[var(--color-danger-600)]",
    Upcoming:
      "border-[var(--color-info-100)] bg-[var(--color-info-50)] text-[var(--color-info-600)]",
  };
  return (
    <span
      className={`inline-flex min-h-[23px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold ${
        statusStyles[status] || statusStyles.Pending
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-[18px] py-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex min-h-[240px] items-center justify-center gap-2 text-[var(--color-text-secondary)]">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm font-medium">Loading accounting data…</span>
    </div>
  );
}

function ErrorBlock({ message, onRetry }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[10px] border border-[var(--color-danger-100)] bg-[var(--color-danger-50)] p-6 text-center">
      <AlertCircle className="text-[var(--color-danger-600)]" size={28} />
      <p className="max-w-md text-sm text-[var(--color-danger-600)]">{message}</p>
      {onRetry && (
        <button type="button" className={BTN} onClick={onRetry}>
          <RefreshCw size={15} />
          Retry
        </button>
      )}
    </div>
  );
}

function Overview({ data }) {
  const o = data.overview;
  const pl = data.profitLoss;
  const meta = data.meta;

  return (
    <div className={PAGE_SECTION}>
      <div className={STATS_GRID}>
        <AccountingStat
          icon={CircleDollarSign}
          title="Cash position (derived)"
          value={formatCompactCurrency(o.netCashPosition)}
          change="Payments − paid expenses"
        />
        <AccountingStat
          icon={ArrowUpFromLine}
          title="Payables"
          value={formatCompactCurrency(o.totalPayables)}
          change="Unpaid expenses"
          negative
        />
        <AccountingStat
          icon={ArrowDownToLine}
          title="Receivables"
          value={formatCompactCurrency(o.accountsReceivable)}
          change="Open order balances"
        />
        <AccountingStat
          icon={TrendingUp}
          title="Net profit (period)"
          value={formatCompactCurrency(o.netProfit)}
          change={`FY from ${formatDisplayDate(meta.fiscalYearStart)}`}
          negative={o.netProfit < 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
        <div className={CARD}>
          <CardHeader
            title="Period summary"
            subtitle={`${formatDisplayDate(meta.fiscalYearStart)} → ${formatDisplayDate(meta.asOf)}`}
          />
          <div className={CARD_BODY}>
            {[
              ["Sales revenue (payments)", pl.totalRevenue],
              ["Total expenses", pl.totalExpenses],
              ["  · Employee", pl.employeeCosts],
              ["  · Factory wages", pl.factoryWages],
              ["  · Factory expense", pl.factoryExpenses],
              ["  · Miscellaneous", pl.miscellaneous],
              ["Net profit", pl.netProfit],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-[var(--color-border-light)] py-2.5 last:border-0"
              >
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  {label}
                </span>
                <span className="font-mono text-[13.5px] font-semibold tabular-nums">
                  {formatCurrency(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={CARD}>
          <CardHeader
            title="Recent activity"
            subtitle="Latest receipts and paid expenses"
          />
          <div className={`${CARD_BODY} flex flex-col gap-2`}>
            {[
              ...(data.recentActivity?.payments || []),
              ...(data.recentActivity?.expenses || []),
            ]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 8)
              .map((item) => (
                <div
                  key={`${item.direction}-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-[13px]">
                      {item.label}
                    </strong>
                    <span className="text-[11.5px] text-[var(--color-text-muted)]">
                      {formatDisplayDate(item.date)} · {item.sub}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${
                      item.direction === "in"
                        ? "text-[var(--color-success-700)]"
                        : "text-[var(--color-danger-600)]"
                    }`}
                  >
                    {item.direction === "in" ? "+" : "−"}
                    {formatCompactCurrency(item.amount)}
                  </span>
                </div>
              ))}
            {!data.recentActivity?.payments?.length &&
              !data.recentActivity?.expenses?.length && (
                <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                  No payments or paid expenses in this period yet.
                </p>
              )}
          </div>
        </div>
      </div>

      {meta.note && (
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
          {meta.note}
        </p>
      )}
    </div>
  );
}

function Payables({ data }) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.payables || [];
    return (data.payables || []).filter(
      (p) =>
        p.supplier?.toLowerCase().includes(q) ||
        p.invoice?.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q)
    );
  }, [data.payables, search]);

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <h2 className="text-[19px] font-semibold text-[var(--color-text-primary)]">
            Payables
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Unpaid expenses (employees, factory, misc) as of{" "}
            {formatDisplayDate(data.meta.asOf)}.
          </p>
        </div>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier / invoice…"
            className="min-h-9 w-[240px] rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[var(--color-brand-800)]"
          />
        </div>
      </div>

      <div className={CARD}>
        <CardHeader
          title={`${rows.length} open payable${rows.length === 1 ? "" : "s"}`}
          subtitle={`Total ${formatCurrency(total)}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[11.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="px-4 py-3 font-semibold">Supplier / Person</th>
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-border-light)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{row.supplier}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {row.invoice}
                  </td>
                  <td className="px-4 py-3">{row.type}</td>
                  <td className="px-4 py-3">{formatDisplayDate(row.dueDate)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[var(--color-text-muted)]"
                  >
                    No unpaid expenses. Nice — payables are clear.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChartOfAccounts({ data }) {
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    const initial = {};
    (data.accountGroups || []).forEach((g) => {
      initial[g.code] = true;
    });
    setOpenGroups(initial);
  }, [data.accountGroups]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.accountGroups || [])
      .map((g) => ({
        ...g,
        accounts: q
          ? g.accounts.filter(
              (a) =>
                a.name.toLowerCase().includes(q) ||
                a.code.toLowerCase().includes(q)
            )
          : g.accounts,
      }))
      .filter((g) => g.accounts.length > 0);
  }, [data.accountGroups, search]);

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <h2 className="text-[19px] font-semibold">Chart of Accounts</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Derived balances from payments, expenses, and orders — not a full
            double-entry ledger.
          </p>
        </div>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="min-h-9 w-[220px] rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[var(--color-brand-800)]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const open = openGroups[group.code] !== false;
          const total = group.accounts.reduce(
            (s, a) => s + Number(a.balance || 0),
            0
          );
          return (
            <div key={group.code} className={CARD}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-[18px] py-4 text-left"
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [group.code]: !open,
                  }))
                }
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">
                    {group.code}
                  </span>
                  <strong className="text-sm">{group.name}</strong>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13.5px] font-semibold tabular-nums">
                    {formatCompactCurrency(total)}
                  </span>
                  <ChevronRight
                    size={16}
                    className={`text-[var(--color-text-muted)] transition-transform ${
                      open ? "rotate-90" : ""
                    }`}
                  />
                </div>
              </button>
              {open && (
                <div className="border-t border-[var(--color-border)] px-[18px] pb-3">
                  {group.accounts.map((account) => (
                    <div
                      key={account.code}
                      className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                            {account.code}
                          </span>
                          <strong className="text-[13px]">{account.name}</strong>
                        </div>
                        {account.note && (
                          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
                            {account.note}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[13.5px] tabular-nums">
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfitLoss({ data }) {
  const pl = data.profitLoss;
  const meta = data.meta;

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <h2 className="text-[19px] font-semibold">Profit & Loss</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Income from completed payments and expenses from{" "}
            {formatDisplayDate(meta.fiscalYearStart)} through{" "}
            {formatDisplayDate(meta.asOf)}.
          </p>
        </div>
      </div>

      <div className={STATS_GRID}>
        <AccountingStat
          icon={TrendingUp}
          title="Revenue"
          value={formatCompactCurrency(pl.totalRevenue)}
          change="Customer payments"
        />
        <AccountingStat
          icon={TrendingDown}
          title="Expenses"
          value={formatCompactCurrency(pl.totalExpenses)}
          change="All expense types"
          negative
        />
        <AccountingStat
          icon={Scale}
          title="Net profit"
          value={formatCompactCurrency(pl.netProfit)}
          change={pl.netProfit >= 0 ? "In the black" : "Loss"}
          negative={pl.netProfit < 0}
        />
        <AccountingStat
          icon={Banknote}
          title="Paid vs pending"
          value={formatCompactCurrency(pl.totalPaidExpenses)}
          change={`${formatCompactCurrency(pl.totalPendingExpenses)} still pending`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        <div className={CARD}>
          <CardHeader title="Income & expense breakdown" />
          <div className={CARD_BODY}>
            {[
              ["Sales revenue", pl.salesRevenue, false],
              ["Employee costs", pl.employeeCosts, true],
              ["Factory wages", pl.factoryWages, true],
              ["Factory expenses", pl.factoryExpenses, true],
              ["Miscellaneous", pl.miscellaneous, true],
            ].map(([label, value, isExp]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-[var(--color-border-light)] py-2.5 last:border-0"
              >
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  {label}
                </span>
                <span
                  className={`font-mono text-[13.5px] font-semibold tabular-nums ${
                    isExp ? "text-[var(--color-danger-600)]" : "text-[var(--color-success-700)]"
                  }`}
                >
                  {isExp ? "−" : "+"}
                  {formatCurrency(value)}
                </span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <strong className="text-sm">Net profit</strong>
              <strong className="font-mono text-[15px] tabular-nums">
                {formatCurrency(pl.netProfit)}
              </strong>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <CardHeader title="Monthly trend" subtitle="Revenue vs expenses" />
          <div className={`${CARD_BODY} h-[280px]`}>
            {pl.monthlyData?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pl.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : `${v}`
                    }
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(v)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#0f766e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="Net"
                    stroke="#1e3a5f"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
                No monthly data for this period.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceSheet({ data }) {
  const bs = data.balanceSheet;
  const meta = data.meta;
  const [detailTab, setDetailTab] = useState("receivables");
  const [search, setSearch] = useState("");

  const receivables = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = bs.receivables || [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.customer?.toLowerCase().includes(q) ||
        r.orderNumber?.toLowerCase().includes(q) ||
        r.contactName?.toLowerCase().includes(q)
    );
  }, [bs.receivables, search]);

  const payablesDetail = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = bs.payablesDetail || [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.supplier?.toLowerCase().includes(q) ||
        r.invoice?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q)
    );
  }, [bs.payablesDetail, search]);

  const cashPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = bs.cashMovements?.collections || [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.customer?.toLowerCase().includes(q) ||
        r.orderNumber?.toLowerCase().includes(q) ||
        r.paymentNumber?.toLowerCase().includes(q)
    );
  }, [bs.cashMovements, search]);

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <h2 className="text-[19px] font-semibold">Balance Sheet</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Position as of {formatDisplayDate(meta.asOf)}. Cash is derived from
            payments and paid expenses (no opening balances).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {[
          ["Assets", bs.assets, bs.totals.assets],
          ["Liabilities", bs.liabilities, bs.totals.liabilities],
          ["Equity", bs.equity, bs.totals.equity],
        ].map(([title, rows, total]) => (
          <div key={title} className={CARD}>
            <CardHeader title={title} />
            <div className={CARD_BODY}>
              {(rows || []).map((row) => (
                <div
                  key={row.name}
                  className="border-b border-[var(--color-border-light)] py-2.5 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                        {row.code ? `${row.code} · ` : ""}
                        {row.name}
                      </span>
                      {row.note && (
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                          {row.note}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[13.5px] tabular-nums">
                      {formatCurrency(row.balance)}
                    </span>
                  </div>
                  {row.breakdown && (
                    <div className="mt-2 rounded-md bg-[var(--color-surface-alt)] px-2.5 py-2 text-[11.5px] text-[var(--color-text-secondary)]">
                      <div className="flex justify-between">
                        <span>All collections</span>
                        <span className="font-mono tabular-nums text-[var(--color-success-700)]">
                          +{formatCurrency(row.breakdown.totalCollections)}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span>All paid expenses</span>
                        <span className="font-mono tabular-nums text-[var(--color-danger-600)]">
                          −{formatCurrency(row.breakdown.totalPaidExpenses)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                <strong className="text-sm">Total</strong>
                <strong className="font-mono text-[14px] tabular-nums">
                  {formatCurrency(total)}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={CARD}>
        <CardHeader
          title="Balance sheet detail"
          subtitle="Drill into receivables, payables, and the payments that form cash"
          action={
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="min-h-8 w-[180px] rounded-lg border border-[var(--color-border)] bg-white pl-8 pr-2 text-[12.5px] outline-none focus:border-[var(--color-brand-800)]"
              />
            </div>
          }
        />
        <div className="flex gap-1 border-b border-[var(--color-border)] px-3">
          {[
            ["receivables", "Receivables (orders)"],
            ["payables", "Payables (expenses)"],
            ["cash-in", "Cash in (payments)"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDetailTab(id)}
              className={`relative min-h-[38px] px-3 text-[12.5px] font-semibold ${
                detailTab === id
                  ? "text-[var(--color-brand-800)] after:absolute after:-bottom-px after:left-2 after:right-2 after:h-0.5 after:bg-[var(--color-brand-800)] after:content-['']"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {detailTab === "receivables" && (
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Order total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Paid</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Due</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border-light)] last:border-0">
                    <td className="px-4 py-2.5 font-mono text-[12.5px]">{r.orderNumber || "—"}</td>
                    <td className="px-4 py-2.5">
                      <strong className="block text-[13px]">{r.customer}</strong>
                      {r.contactName && r.contactName !== r.customer && (
                        <span className="text-[11.5px] text-[var(--color-text-muted)]">{r.contactName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{formatDisplayDate(r.date)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatCurrency(r.grandTotal)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--color-success-700)]">{formatCurrency(r.amountPaid)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{formatCurrency(r.balanceDue)}</td>
                    <td className="px-4 py-2.5 text-[12px]">{r.paymentStatus}</td>
                  </tr>
                ))}
                {!receivables.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                      No outstanding receivables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {detailTab === "payables" && (
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-4 py-2.5 font-semibold">Supplier / Person</th>
                  <th className="px-4 py-2.5 font-semibold">Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payablesDetail.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border-light)] last:border-0">
                    <td className="px-4 py-2.5 font-medium">{r.supplier}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">{r.invoice}</td>
                    <td className="px-4 py-2.5">{r.type}</td>
                    <td className="px-4 py-2.5">{formatDisplayDate(r.dueDate)}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
                {!payablesDetail.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                      No open payables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {detailTab === "cash-in" && (
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Payment #</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-4 py-2.5 font-semibold">Mode</th>
                  <th className="px-4 py-2.5 font-semibold">Txn ID</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {cashPayments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border-light)] last:border-0">
                    <td className="px-4 py-2.5">{formatDisplayDate(p.date)}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px]">{p.paymentNumber || "—"}</td>
                    <td className="px-4 py-2.5">
                      <strong className="block">{p.customer}</strong>
                      {p.contactName && p.contactName !== p.customer && (
                        <span className="text-[11.5px] text-[var(--color-text-muted)]">{p.contactName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px]">{p.orderNumber || "—"}</td>
                    <td className="px-4 py-2.5">{p.paymentMode || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--color-text-muted)]">{p.transactionId || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--color-success-700)]">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
                {!cashPayments.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                      No customer payments in this fiscal period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function CashFlowView({ data }) {
  const meta = data.meta;
  const cf = data.cashFlow || {};
  const summary = Array.isArray(cf.summary) ? cf.summary : [];
  const [listTab, setListTab] = useState("in");
  const [search, setSearch] = useState("");

  const customerPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = cf.customerPayments || [];
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.customer?.toLowerCase().includes(q) ||
        p.contactName?.toLowerCase().includes(q) ||
        p.orderNumber?.toLowerCase().includes(q) ||
        p.paymentNumber?.toLowerCase().includes(q) ||
        p.transactionId?.toLowerCase().includes(q) ||
        p.paymentMode?.toLowerCase().includes(q)
    );
  }, [cf.customerPayments, search]);

  const expensePayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = cf.expensePayments || [];
    if (!q) return rows;
    return rows.filter(
      (e) =>
        e.payee?.toLowerCase().includes(q) ||
        e.type?.toLowerCase().includes(q) ||
        e.invoiceNumber?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );
  }, [cf.expensePayments, search]);

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <h2 className="text-[19px] font-semibold">Cash Flow</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Every customer payment and paid expense from{" "}
            {formatDisplayDate(meta.fiscalYearStart)} →{" "}
            {formatDisplayDate(meta.asOf)}.
          </p>
        </div>
      </div>

      <div className={STATS_GRID}>
        <AccountingStat
          icon={ArrowDownToLine}
          title="Customer payments in"
          value={formatCompactCurrency(cf.totals?.customerPayments)}
          change={`${(cf.customerPayments || []).length} payment(s)`}
        />
        <AccountingStat
          icon={ArrowUpFromLine}
          title="Expense payments out"
          value={formatCompactCurrency(cf.totals?.expensePayments)}
          change={`${(cf.expensePayments || []).length} payment(s)`}
          negative
        />
        <AccountingStat
          icon={Banknote}
          title="Net operating cash"
          value={formatCompactCurrency(cf.totals?.net)}
          change="In − out for period"
          negative={(cf.totals?.net || 0) < 0}
        />
        <AccountingStat
          icon={CircleDollarSign}
          title="As-of date"
          value={formatDisplayDate(meta.asOf)}
          change={`FY start ${formatDisplayDate(meta.fiscalYearStart)}`}
        />
      </div>

      {summary.map((section) => (
        <div key={section.category} className={CARD}>
          <CardHeader
            title={section.category}
            subtitle={`Net ${formatCurrency(section.total)}`}
          />
          <div className={CARD_BODY}>
            {(section.items || []).map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between border-b border-[var(--color-border-light)] py-2.5 last:border-0"
              >
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  {item.label}
                  {item.count != null ? ` (${item.count})` : ""}
                </span>
                <span
                  className={`font-mono text-[13.5px] font-semibold tabular-nums ${
                    item.amount >= 0
                      ? "text-[var(--color-success-700)]"
                      : "text-[var(--color-danger-600)]"
                  }`}
                >
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={CARD}>
        <CardHeader
          title="Payment detail"
          subtitle="Who paid, how much, against which order"
          action={
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, order, txn…"
                className="min-h-8 w-[220px] rounded-lg border border-[var(--color-border)] bg-white pl-8 pr-2 text-[12.5px] outline-none focus:border-[var(--color-brand-800)]"
              />
            </div>
          }
        />
        <div className="flex gap-1 border-b border-[var(--color-border)] px-3">
          <button
            type="button"
            onClick={() => setListTab("in")}
            className={`relative min-h-[38px] px-3 text-[12.5px] font-semibold ${
              listTab === "in"
                ? "text-[var(--color-brand-800)] after:absolute after:-bottom-px after:left-2 after:right-2 after:h-0.5 after:bg-[var(--color-brand-800)] after:content-['']"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            Customer payments ({(cf.customerPayments || []).length})
          </button>
          <button
            type="button"
            onClick={() => setListTab("out")}
            className={`relative min-h-[38px] px-3 text-[12.5px] font-semibold ${
              listTab === "out"
                ? "text-[var(--color-brand-800)] after:absolute after:-bottom-px after:left-2 after:right-2 after:h-0.5 after:bg-[var(--color-brand-800)] after:content-['']"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            Expense payments ({(cf.expensePayments || []).length})
          </button>
        </div>

        <div className="overflow-x-auto">
          {listTab === "in" ? (
            <table className="w-full min-w-[800px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Payment #</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-4 py-2.5 font-semibold">Mode</th>
                  <th className="px-4 py-2.5 font-semibold">Txn / Cheque</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {customerPayments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border-light)] last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDisplayDate(p.date)}</td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px]">{p.paymentNumber || "—"}</td>
                    <td className="px-4 py-2.5">
                      <strong className="block text-[13px]">{p.customer}</strong>
                      {p.contactName && p.contactName !== p.customer && (
                        <span className="text-[11.5px] text-[var(--color-text-muted)]">{p.contactName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12.5px]">{p.orderNumber || "—"}</td>
                    <td className="px-4 py-2.5">{p.paymentMode || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--color-text-muted)]">
                      {p.transactionId || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--color-success-700)]">
                      +{formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
                {!customerPayments.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-text-muted)]">
                      No completed customer payments in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              {customerPayments.length > 0 && (
                <tfoot>
                  <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <td colSpan={6} className="px-4 py-3 text-right text-[12.5px] font-semibold">
                      Total in ({customerPayments.length})
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[var(--color-success-700)]">
                      +{formatCurrency(
                        customerPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Payee</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Method</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expensePayments.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--color-border-light)] last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDisplayDate(e.date)}</td>
                    <td className="px-4 py-2.5 font-medium">{e.payee}</td>
                    <td className="px-4 py-2.5">{e.type}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">
                      {e.invoiceNumber || e.description || "—"}
                    </td>
                    <td className="px-4 py-2.5">{e.paymentMethod || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--color-danger-600)]">
                      −{formatCurrency(e.amount)}
                    </td>
                  </tr>
                ))}
                {!expensePayments.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[var(--color-text-muted)]">
                      No paid expenses in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              {expensePayments.length > 0 && (
                <tfoot>
                  <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <td colSpan={5} className="px-4 py-3 text-right text-[12.5px] font-semibold">
                      Total out ({expensePayments.length})
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[var(--color-danger-600)]">
                      −{formatCurrency(
                        expensePayments.reduce((s, e) => s + Number(e.amount || 0), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("overview");
  const [asOf, setAsOf] = useState(todayInputValue);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAccountingDashboard({ asOf });
      const payload = res.data;
      if (!payload?.success) {
        throw new Error(payload?.message || "Failed to load accounting data");
      }
      setData(payload);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not load accounting dashboard"
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load]);

  const renderTab = () => {
    if (loading) return <LoadingBlock />;
    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (!data) return null;

    switch (activeTab) {
      case "overview":
        return <Overview data={data} />;
      case "payables":
        return <Payables data={data} />;
      case "accounts":
        return <ChartOfAccounts data={data} />;
      case "profit-loss":
        return <ProfitLoss data={data} />;
      case "balance-sheet":
        return <BalanceSheet data={data} />;
      case "cash-flow":
        return <CashFlowView data={data} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Finance · Live data
          </div>
          <h1 className="mt-1 text-[22px] font-semibold text-[var(--color-text-primary)]">
            Accounting
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-[var(--color-text-secondary)]">
            Wired to Payments (revenue), Expenses (costs & payables), and Orders
            (receivables).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--color-text-secondary)]">
            As of
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="min-h-9 rounded-lg border border-[var(--color-border)] bg-white px-2.5 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-800)]"
            />
          </label>
          <button type="button" className={BTN} onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {accountingTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`relative inline-flex min-h-[42px] items-center gap-1.5 whitespace-nowrap px-3 text-[12.5px] font-semibold transition-colors ${
                isActive
                  ? "text-[var(--color-brand-800)] after:absolute after:-bottom-px after:left-2 after:right-2 after:h-0.5 after:rounded-t after:bg-[var(--color-brand-800)] after:content-['']"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {renderTab()}
    </div>
  );
}