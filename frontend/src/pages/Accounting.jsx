import { useMemo, useState } from "react";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  ReceiptText,
  Scale,
  Banknote,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  ChevronRight,
  Search,
  Download,
  Plus,
  ChevronDown,
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

const accountingTabs = [
  { id: "overview", label: "Overview", icon: Wallet },
  { id: "payables", label: "Payables", icon: ArrowUpFromLine },
  { id: "accounts", label: "Chart of Accounts", icon: Landmark },
  { id: "profit-loss", label: "Profit & Loss", icon: TrendingUp },
  { id: "balance-sheet", label: "Balance Sheet", icon: Scale },
  { id: "cash-flow", label: "Cash Flow", icon: Banknote },
];

const DEFAULT_AS_OF_DATE = "2026-09-16";
const FISCAL_YEAR_START_MONTH = 3;

const payables = [
  {
    supplier: "Tata Steel",
    invoice: "SUP-INV-1023",
    createdDate: "2026-08-20",
    dueDate: "2026-09-20",
    amount: 250000,
  },
  {
    supplier: "JSW Steel",
    invoice: "SUP-INV-1024",
    createdDate: "2026-08-25",
    dueDate: "2026-09-25",
    amount: 125000,
  },
  {
    supplier: "Mahindra Logistics",
    invoice: "SUP-INV-1025",
    createdDate: "2026-08-01",
    dueDate: "2026-09-12",
    amount: 85000,
  },
  {
    supplier: "Steel Authority of India",
    invoice: "SUP-INV-1026",
    createdDate: "2026-09-01",
    dueDate: "2026-10-05",
    amount: 310000,
  },
];

const accountGroups = [
  {
    name: "Assets",
    code: "1000",
    icon: Wallet,
    accounts: [
      {
        name: "Cash",
        code: "1001",
        balance: 425000,
        openingBalance: 300000,
      },
      {
        name: "Bank Account",
        code: "1002",
        balance: 1850000,
        openingBalance: 1500000,
      },
      {
        name: "Accounts Receivable",
        code: "1003",
        balance: 780000,
        openingBalance: 600000,
      },
      {
        name: "Inventory",
        code: "1004",
        balance: 2150000,
        openingBalance: 1800000,
      },
      {
        name: "Fixed Assets",
        code: "1005",
        balance: 3200000,
        openingBalance: 3200000,
      },
    ],
  },
  {
    name: "Liabilities",
    code: "2000",
    icon: ArrowUpFromLine,
    accounts: [
      {
        name: "Accounts Payable",
        code: "2001",
        balance: 450000,
        openingBalance: 350000,
      },
      {
        name: "Bank Loan",
        code: "2002",
        balance: 1200000,
        openingBalance: 1200000,
      },
      {
        name: "Other Liabilities",
        code: "2003",
        balance: 150000,
        openingBalance: 100000,
      },
    ],
  },
  {
    name: "Equity",
    code: "3000",
    icon: Scale,
    accounts: [
      {
        name: "Owner Capital",
        code: "3001",
        balance: 4500000,
        openingBalance: 4500000,
      },
      {
        name: "Retained Earnings",
        code: "3002",
        balance: 2125000,
        openingBalance: 1800000,
      },
    ],
  },
  {
    name: "Income",
    code: "4000",
    icon: TrendingUp,
    accounts: [
      {
        name: "Sales Revenue",
        code: "4001",
        balance: 12500000,
        openingBalance: 0,
      },
      {
        name: "Other Revenue",
        code: "4002",
        balance: 185000,
        openingBalance: 0,
      },
    ],
  },
  {
    name: "Expenses",
    code: "5000",
    icon: TrendingDown,
    accounts: [
      {
        name: "Operating Expenses",
        code: "5001",
        balance: 1850000,
        openingBalance: 0,
      },
      {
        name: "Transportation",
        code: "5002",
        balance: 425000,
        openingBalance: 0,
      },
      {
        name: "Utilities",
        code: "5003",
        balance: 185000,
        openingBalance: 0,
      },
    ],
  },
];

/* =========================================================
   BALANCE SHEET
   ========================================================= */

const mockBalanceSheetAccounts = {
  assets: [
    {
      code: "1010",
      name: "Cash & Bank",
      balance: 850000,
      isCurrent: true,
    },
    {
      code: "1020",
      name: "Accounts Receivable",
      balance: 620000,
      isCurrent: true,
    },
    {
      code: "1030",
      name: "Inventory",
      balance: 330000,
      isCurrent: true,
    },
    {
      code: "1510",
      name: "Plant & Machinery",
      balance: 1500000,
      isCurrent: false,
    },
    {
      code: "1520",
      name: "Office Equipment",
      balance: 400000,
      isCurrent: false,
    },
    {
      code: "1530",
      name: "Vehicles",
      balance: 300000,
      isCurrent: false,
    },
  ],

  liabilities: [
    {
      code: "2010",
      name: "Accounts Payable",
      balance: 350000,
      isCurrent: true,
    },
    {
      code: "2020",
      name: "Accrued Expenses",
      balance: 150000,
      isCurrent: true,
    },
    {
      code: "2030",
      name: "Short-Term Loan",
      balance: 100000,
      isCurrent: true,
    },
    {
      code: "2510",
      name: "Long-Term Bank Loan",
      balance: 750000,
      isCurrent: false,
    },
    {
      code: "2520",
      name: "Equipment Financing",
      balance: 250000,
      isCurrent: false,
    },
  ],

  equity: [
    {
      code: "3010",
      name: "Owner's Capital",
      balance: 1800000,
    },
    {
      code: "3020",
      name: "Retained Earnings",
      balance: 600000,
    },
  ],
};

const profitLossEntries = [
  {
    date: "2026-04-30",
    group: "income",
    account: "Sales Revenue",
    amount: 2100000,
  },
  {
    date: "2026-05-31",
    group: "income",
    account: "Sales Revenue",
    amount: 1800000,
  },
  {
    date: "2026-06-30",
    group: "income",
    account: "Sales Revenue",
    amount: 2000000,
  },
  {
    date: "2026-07-31",
    group: "income",
    account: "Sales Revenue",
    amount: 2200000,
  },
  {
    date: "2026-08-31",
    group: "income",
    account: "Sales Revenue",
    amount: 2400000,
  },
  {
    date: "2026-09-16",
    group: "income",
    account: "Sales Revenue",
    amount: 2000000,
  },

  {
    date: "2026-04-30",
    group: "income",
    account: "Other Revenue",
    amount: 30000,
  },
  {
    date: "2026-05-31",
    group: "income",
    account: "Other Revenue",
    amount: 25000,
  },
  {
    date: "2026-06-30",
    group: "income",
    account: "Other Revenue",
    amount: 20000,
  },
  {
    date: "2026-07-31",
    group: "income",
    account: "Other Revenue",
    amount: 35000,
  },
  {
    date: "2026-08-31",
    group: "income",
    account: "Other Revenue",
    amount: 40000,
  },
  {
    date: "2026-09-16",
    group: "income",
    account: "Other Revenue",
    amount: 35000,
  },

  {
    date: "2026-04-30",
    group: "expense",
    account: "Operating Expenses",
    amount: 300000,
  },
  {
    date: "2026-05-31",
    group: "expense",
    account: "Operating Expenses",
    amount: 250000,
  },
  {
    date: "2026-06-30",
    group: "expense",
    account: "Operating Expenses",
    amount: 300000,
  },
  {
    date: "2026-07-31",
    group: "expense",
    account: "Operating Expenses",
    amount: 320000,
  },
  {
    date: "2026-08-31",
    group: "expense",
    account: "Operating Expenses",
    amount: 380000,
  },
  {
    date: "2026-09-16",
    group: "expense",
    account: "Operating Expenses",
    amount: 300000,
  },

  {
    date: "2026-04-30",
    group: "expense",
    account: "Transportation",
    amount: 65000,
  },
  {
    date: "2026-05-31",
    group: "expense",
    account: "Transportation",
    amount: 60000,
  },
  {
    date: "2026-06-30",
    group: "expense",
    account: "Transportation",
    amount: 70000,
  },
  {
    date: "2026-07-31",
    group: "expense",
    account: "Transportation",
    amount: 70000,
  },
  {
    date: "2026-08-31",
    group: "expense",
    account: "Transportation",
    amount: 80000,
  },
  {
    date: "2026-09-16",
    group: "expense",
    account: "Transportation",
    amount: 80000,
  },

  {
    date: "2026-04-30",
    group: "expense",
    account: "Utilities",
    amount: 30000,
  },
  {
    date: "2026-05-31",
    group: "expense",
    account: "Utilities",
    amount: 25000,
  },
  {
    date: "2026-06-30",
    group: "expense",
    account: "Utilities",
    amount: 30000,
  },
  {
    date: "2026-07-31",
    group: "expense",
    account: "Utilities",
    amount: 30000,
  },
  {
    date: "2026-08-31",
    group: "expense",
    account: "Utilities",
    amount: 35000,
  },
  {
    date: "2026-09-16",
    group: "expense",
    account: "Utilities",
    amount: 35000,
  },
];

const cashFlowData = [
  {
    category: "Operating Activities",
    items: [
      {
        date: "2026-04-30",
        label: "Customer Payments",
        amount: 4850000,
      },
      {
        date: "2026-05-31",
        label: "Supplier Payments",
        amount: -1850000,
      },
      {
        date: "2026-06-30",
        label: "Operating Expenses",
        amount: -625000,
      },
    ],
  },
  {
    category: "Investing Activities",
    items: [
      {
        date: "2026-07-31",
        label: "Equipment Purchase",
        amount: -450000,
      },
      {
        date: "2026-08-31",
        label: "Asset Sale",
        amount: 85000,
      },
    ],
  },
  {
    category: "Financing Activities",
    items: [
      {
        date: "2026-08-31",
        label: "Loan Received",
        amount: 500000,
      },
      {
        date: "2026-09-16",
        label: "Loan Repayment",
        amount: -250000,
      },
    ],
  },
];

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function getTodayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "—";

  return parseDate(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
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

function formatExactCurrency(value) {
  if (
    value === undefined ||
    value === null ||
    Number.isNaN(Number(value))
  ) {
    return "₹0.00";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);

  if (Math.abs(amount) >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }

  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }

  if (Math.abs(amount) >= 1000) {
    return `₹${(amount / 1000).toFixed(1)} K`;
  }

  return formatCurrency(amount);
}

function sum(values) {
  return values.reduce(
    (total, value) => total + Number(value || 0),
    0
  );
}

function getFiscalYearStart(asOfDate) {
  const date = parseDate(asOfDate);
  const calendarYear = date.getFullYear();

  const fiscalYear =
    date.getMonth() < FISCAL_YEAR_START_MONTH
      ? calendarYear - 1
      : calendarYear;

  return `${fiscalYear}-04-01`;
}

function isOnOrBefore(date, asOfDate) {
  return parseDate(date) <= parseDate(asOfDate);
}

function isInReportPeriod(date, asOfDate) {
  return (
    isOnOrBefore(date, asOfDate) &&
    parseDate(date) >= parseDate(getFiscalYearStart(asOfDate))
  );
}

function getAccountBalance(account, asOfDate) {
  return isOnOrBefore(DEFAULT_AS_OF_DATE, asOfDate)
    ? account.balance
    : account.openingBalance;
}

function getLedgerAccountsSnapshot(asOfDate) {
  return accountGroups.map((group) => ({
    ...group,
    accounts: group.accounts.map((account) => ({
      ...account,
      balance: getAccountBalance(account, asOfDate),
    })),
  }));
}

function getGroupTotal(snapshot, groupName) {
  const group = snapshot.find(
    (item) => item.name === groupName
  );

  return sum(
    group?.accounts.map((account) => account.balance) || []
  );
}

function getBalanceSheetSnapshot(asOfDate) {
  return {
    asOfDate,
    assets: mockBalanceSheetAccounts.assets,
    liabilities: mockBalanceSheetAccounts.liabilities,
    equity: mockBalanceSheetAccounts.equity,
  };
}

function getPayables(asOfDate) {
  return payables
    .filter((item) =>
      isOnOrBefore(item.createdDate, asOfDate)
    )
    .map((item) => {
      const dueDate = parseDate(item.dueDate);
      const selectedDate = parseDate(asOfDate);

      const daysUntilDue =
        (dueDate - selectedDate) / 86400000;

      let status = "Upcoming";

      if (dueDate < selectedDate) {
        status = "Overdue";
      } else if (daysUntilDue <= 30) {
        status = "Due";
      }

      return {
        ...item,
        status,
      };
    });
}

function getProfitLoss(asOfDate) {
  const entries = profitLossEntries.filter((entry) =>
    isInReportPeriod(entry.date, asOfDate)
  );

  const income = entries.filter(
    (entry) => entry.group === "income"
  );

  const expenses = entries.filter(
    (entry) => entry.group === "expense"
  );

  const incomeFor = (accountName) =>
    sum(
      income
        .filter((entry) => entry.account === accountName)
        .map((entry) => entry.amount)
    );

  const expenseFor = (accountName) =>
    sum(
      expenses
        .filter((entry) => entry.account === accountName)
        .map((entry) => entry.amount)
    );

  const salesRevenue = incomeFor("Sales Revenue");
  const otherRevenue = incomeFor("Other Revenue");

  const operatingExpenses = expenseFor(
    "Operating Expenses"
  );

  const transportation = expenseFor("Transportation");
  const utilities = expenseFor("Utilities");

  const totalRevenue = salesRevenue + otherRevenue;

  const totalExpenses =
    operatingExpenses + transportation + utilities;

  const months = {};

  entries.forEach((entry) => {
    const date = parseDate(entry.date);

    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!months[monthKey]) {
      months[monthKey] = {
        month: date.toLocaleDateString("en-IN", {
          month: "short",
        }),
        revenue: 0,
        expenses: 0,
        netProfit: 0,
      };
    }

    if (entry.group === "income") {
      months[monthKey].revenue += Number(entry.amount || 0);
    }

    if (entry.group === "expense") {
      months[monthKey].expenses += Number(entry.amount || 0);
    }
  });

  const monthlyData = Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, month]) => ({
      ...month,
      netProfit: month.revenue - month.expenses,
    }));

  return {
    salesRevenue,
    otherRevenue,
    operatingExpenses,
    transportation,
    utilities,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    monthlyData,
  };
}

function getCashFlow(asOfDate) {
  return cashFlowData.map((section) => {
    const items = section.items.filter((item) =>
      isInReportPeriod(item.date, asOfDate)
    );

    return {
      ...section,
      items,
      total: sum(items.map((item) => item.amount)),
    };
  });
}

const CARD =
  "rounded-[10px] border border-[var(--color-border)] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
const CARD_BODY = "p-[18px]";

const BTN =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-alt)] active:translate-y-px";

const BTN_PRIMARY =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-brand-800)] bg-[var(--color-brand-800)] px-3.5 text-[13px] font-semibold text-white transition-colors hover:border-[var(--color-brand-900)] hover:bg-[var(--color-brand-900)] active:translate-y-px";

const PAGE_SECTION = "flex flex-col gap-5";

const PAGE_HEADING =
  "flex items-end justify-between gap-4 max-[800px]:flex-col max-[800px]:items-start";

const BREADCRUMB =
  "mb-[7px] flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)]";

const STATS_GRID =
  "grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1";

function AccountingStat({
  icon: Icon,
  title,
  value,
  change,
  negative = false,
}) {
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
          {negative ? (
            <TrendingDown size={13} />
          ) : (
            <TrendingUp size={13} />
          )}

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
          <p className="mt-[3px] text-xs text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function ReportPeriodLabel({ asOfDate }) {
  return (
    <span className="inline-flex min-h-[23px] items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-info-100)] bg-[var(--color-info-50)] px-2.5 text-[11px] font-semibold text-[var(--color-info-600)]">
      FY from {formatDisplayDate(getFiscalYearStart(asOfDate))}{" "}
      to {formatDisplayDate(asOfDate)}
    </span>
  );
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function Overview({ asOfDate }) {
  const snapshot = useMemo(
    () => getLedgerAccountsSnapshot(asOfDate),
    [asOfDate]
  );

  const profitLoss = useMemo(
    () => getProfitLoss(asOfDate),
    [asOfDate]
  );

  const assetsGroup = snapshot.find(
    (group) => group.name === "Assets"
  );

  const receivables =
    assetsGroup?.accounts.find(
      (account) =>
        account.name === "Accounts Receivable"
    )?.balance || 0;

  const cashAccounts =
    assetsGroup?.accounts.filter((account) =>
      ["Cash", "Bank Account"].includes(account.name)
    ) || [];

  const totalPayables = sum(
    getPayables(asOfDate).map((item) => item.amount)
  );

  const totalAssets = getGroupTotal(
    snapshot,
    "Assets"
  );

  const totalLiabilities = getGroupTotal(
    snapshot,
    "Liabilities"
  );

  const totalEquity = getGroupTotal(
    snapshot,
    "Equity"
  );

  const balanceDifference =
    totalAssets - totalLiabilities - totalEquity;

  const isBalanced =
    Math.abs(balanceDifference) < 0.01;

  return (
    <div className={PAGE_SECTION}>
      <div className={STATS_GRID}>
        <AccountingStat
          icon={CircleDollarSign}
          title="Total Assets"
          value={formatCompactCurrency(totalAssets)}
          change={`As of ${formatDisplayDate(asOfDate)}`}
        />

        <AccountingStat
          icon={ArrowUpFromLine}
          title="Total Liabilities"
          value={formatCompactCurrency(totalLiabilities)}
          change={`${formatCompactCurrency(
            totalPayables
          )} supplier payables`}
          negative
        />

        <AccountingStat
          icon={Scale}
          title="Total Equity"
          value={formatCompactCurrency(totalEquity)}
          change="Owner's equity"
        />

        <AccountingStat
          icon={TrendingUp}
          title="Net Revenue"
          value={formatCompactCurrency(
            profitLoss.totalRevenue
          )}
          change="Selected fiscal period"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
        <div className={CARD}>
          <CardHeader
            title="Financial Position"
            subtitle={`Balances through ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className={CARD_BODY}>
            <div className="flex flex-col gap-0 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-1 py-3.5">
                <div>
                  <strong className="text-sm">
                    Assets
                  </strong>

                  <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                    What the business owns
                  </span>
                </div>

                <strong className="font-mono text-[15px] font-semibold tabular-nums">
                  {formatCompactCurrency(totalAssets)}
                </strong>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-1 py-3.5">
                <div>
                  <strong className="text-sm">
                    Liabilities
                  </strong>

                  <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                    Outstanding obligations
                  </span>
                </div>

                <strong className="font-mono text-[15px] font-semibold tabular-nums">
                  {formatCompactCurrency(
                    totalLiabilities
                  )}
                </strong>
              </div>

              <div className="flex items-center justify-between px-1 py-3.5">
                <div>
                  <strong className="text-sm">
                    Equity
                  </strong>

                  <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                    Owner investment and retained
                    earnings
                  </span>
                </div>

                <strong className="font-mono text-[15px] font-semibold tabular-nums">
                  {formatCompactCurrency(totalEquity)}
                </strong>
              </div>
            </div>

            <div
              className={`mt-3.5 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold ${
                isBalanced
                  ? "border-[var(--color-success-100)] bg-[var(--color-success-50)] text-[var(--color-success-700)]"
                  : "border-[var(--color-danger-100)] bg-[var(--color-danger-50)] text-[var(--color-danger-600)]"
              }`}
            >
              <Scale size={15} />

              <span>
                {isBalanced
                  ? "Balance check passed"
                  : "Balance mismatch"}

                <strong className="ml-1.5">
                  {isBalanced
                    ? `${formatCompactCurrency(
                        totalAssets
                      )} = ${formatCompactCurrency(
                        totalLiabilities +
                          totalEquity
                      )}`
                    : `Difference: ${formatCompactCurrency(
                        Math.abs(balanceDifference)
                      )}`}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <CardHeader
            title="Cash Position"
            subtitle={`Cash and bank balances as of ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className="flex flex-col px-[18px] pb-[18px] pt-1.5">
            {cashAccounts.map((account) => {
              const isBank =
                account.name === "Bank Account";

              return (
                <div
                  className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-[13px] last:border-b-0"
                  key={account.code}
                >
                  <div className="flex min-w-0 items-center gap-[11px]">
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-50)] text-[var(--color-success-700)]">
                      <Banknote size={15} />
                    </span>

                    <div>
                      <strong className="block text-[13px]">
                        {isBank ? "Bank" : "Cash"}
                      </strong>

                      <span className="mt-px block text-xs text-[var(--color-text-muted)]">
                        {account.name}
                      </span>
                    </div>
                  </div>

                  <strong className="shrink-0 font-mono text-sm tabular-nums text-[var(--color-text-primary)]">
                    {formatCompactCurrency(
                      account.balance
                    )}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
        <div className={CARD}>
          <CardHeader
            title="Accounts Receivable"
            subtitle={`Customer balances through ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className={CARD_BODY}>
            <strong className="block font-mono text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
              {formatCompactCurrency(receivables)}
            </strong>

            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Detailed aging requires invoice and
              settlement records.
            </p>
          </div>
        </div>

        <div className={CARD}>
          <CardHeader
            title="Accounts Payable"
            subtitle={`Supplier balances through ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className={CARD_BODY}>
            <strong className="block font-mono text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
              {formatCompactCurrency(totalPayables)}
            </strong>

            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {getPayables(asOfDate).length} payable
              records included.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Payables({ asOfDate }) {
  const [search, setSearch] = useState("");

  const filteredPayables = getPayables(asOfDate).filter(
    (item) =>
      `${item.supplier} ${item.invoice}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const totalPayables = sum(
    filteredPayables.map((item) => item.amount)
  );

  const dueSoon = sum(
    filteredPayables
      .filter((item) => item.status === "Due")
      .map((item) => item.amount)
  );

  const overdue = sum(
    filteredPayables
      .filter((item) => item.status === "Overdue")
      .map((item) => item.amount)
  );

  const upcoming = sum(
    filteredPayables
      .filter((item) => item.status === "Upcoming")
      .map((item) => item.amount)
  );

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <h2 className="text-[19px] font-semibold text-[var(--color-text-primary)]">
            Accounts Payable
          </h2>

          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Supplier obligations recorded through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className={BTN_PRIMARY}
            type="button"
          >
            <Plus size={15} />
            Add Payable
          </button>
        </div>
      </div>

      <div className={STATS_GRID}>
        <AccountingStat
          icon={ArrowUpFromLine}
          title="Total Payables"
          value={formatCompactCurrency(totalPayables)}
          change={`${filteredPayables.length} supplier records`}
        />

        <AccountingStat
          icon={ReceiptText}
          title="Due Soon"
          value={formatCompactCurrency(dueSoon)}
          change="Within 30 days"
        />

        <AccountingStat
          icon={TrendingDown}
          title="Overdue"
          value={formatCompactCurrency(overdue)}
          change="Requires attention"
          negative
        />

        <AccountingStat
          icon={Banknote}
          title="Upcoming"
          value={formatCompactCurrency(upcoming)}
          change="Future obligations"
        />
      </div>

      <div className={CARD}>
        <CardHeader
          title="Supplier Payables"
          subtitle={`${filteredPayables.length} payable records as of ${formatDisplayDate(
            asOfDate
          )}`}
        />

        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-[18px] py-3">
          <div className="relative w-[260px] max-[800px]:w-full">
            <Search
              size={15}
              className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />

            <input
              type="text"
              placeholder="Search supplier or invoice..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] pl-[34px] pr-3 text-[13px] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-500)] focus:bg-white"
            />
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="h-10 whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[18px] text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Supplier
                </th>
                <th className="h-10 whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[18px] text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Invoice
                </th>
                <th className="h-10 whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[18px] text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Due Date
                </th>
                <th className="h-10 whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[18px] text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Amount
                </th>
                <th className="h-10 whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[18px] text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Status
                </th>
                <th className="h-10 whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[18px]" />
              </tr>
            </thead>

            <tbody className="[&>tr:last-child>td]:border-b-0">
              {filteredPayables.map((item) => (
                <tr
                  key={item.invoice}
                  className="transition-colors hover:bg-[var(--color-surface-alt)]"
                >
                  <td className="h-[54px] border-b border-[var(--color-border-light)] px-[18px] align-middle text-[13px] text-[var(--color-text-primary)]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-800)] text-[11.5px] font-bold text-white">
                        {item.supplier.charAt(0)}
                      </span>

                      <strong className="font-semibold">
                        {item.supplier}
                      </strong>
                    </div>
                  </td>

                  <td className="h-[54px] border-b border-[var(--color-border-light)] px-[18px] align-middle text-[13px] text-[var(--color-text-primary)]">
                    {item.invoice}
                  </td>

                  <td className="h-[54px] border-b border-[var(--color-border-light)] px-[18px] align-middle text-[13px] text-[var(--color-text-primary)]">
                    {formatDisplayDate(item.dueDate)}
                  </td>

                  <td className="h-[54px] border-b border-[var(--color-border-light)] px-[18px] align-middle text-[13px] text-[var(--color-text-primary)]">
                    <strong className="font-mono tabular-nums">
                      {formatCurrency(item.amount)}
                    </strong>
                  </td>

                  <td className="h-[54px] border-b border-[var(--color-border-light)] px-[18px] align-middle text-[13px]">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="h-[54px] border-b border-[var(--color-border-light)] px-[18px] align-middle text-[13px]">
                    <button
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-brand-700)]"
                      type="button"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredPayables.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="px-5 py-11 text-center text-[13px] text-[var(--color-text-muted)]">
                      No payable records found for
                      this date.
                    </div>
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

function ChartOfAccounts({ asOfDate }) {
  const [openGroups, setOpenGroups] = useState({});

  const snapshot = useMemo(
    () => getLedgerAccountsSnapshot(asOfDate),
    [asOfDate]
  );

  const totalAccounts = snapshot.reduce(
    (total, group) =>
      total + group.accounts.length,
    0
  );

  function toggleGroup(code) {
    setOpenGroups((previous) => ({
      ...previous,
      [code]: !previous[code],
    }));
  }

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <div className={BREADCRUMB}>
            Accounting{" "}
            <span className="text-[var(--color-border-strong)]">
              /
            </span>{" "}
            Chart of Accounts
          </div>

          <h2 className="text-[19px] font-semibold text-[var(--color-text-primary)]">
            Chart of Accounts
          </h2>

          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Account balances through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className={BTN_PRIMARY}
            type="button"
          >
            <Plus size={15} />
            Add Account
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3.5 rounded-[10px] border border-[var(--color-border)] bg-white px-5 py-4 shadow-sm">
        <div className="flex min-w-[140px] flex-1 items-center gap-[11px]">
          <span className="font-mono text-[21px] font-bold text-[var(--color-brand-800)]">
            {snapshot.length}
          </span>

          <div>
            <strong className="block text-[12.5px] font-semibold text-[var(--color-text-primary)]">
              Account Groups
            </strong>
            <span className="mt-px block text-[11.5px] text-[var(--color-text-muted)]">
              Organized categories
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-[var(--color-border)]" />

        <div className="flex min-w-[140px] flex-1 items-center gap-[11px]">
          <span className="font-mono text-[21px] font-bold text-[var(--color-brand-800)]">
            {totalAccounts}
          </span>

          <div>
            <strong className="block text-[12.5px] font-semibold text-[var(--color-text-primary)]">
              Total Accounts
            </strong>
            <span className="mt-px block text-[11.5px] text-[var(--color-text-muted)]">
              Ledger accounts
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-[var(--color-border)]" />

        <div className="flex min-w-[140px] flex-1 items-center gap-[11px]">
          <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-[var(--color-success-500)] shadow-[0_0_0_3px_var(--color-success-50)]" />

          <div>
            <strong className="block text-[12.5px] font-semibold text-[var(--color-text-primary)]">
              Ledger Active
            </strong>

            <span className="mt-px block text-[11.5px] text-[var(--color-text-muted)]">
              As of {formatDisplayDate(asOfDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {snapshot.map((group) => {
          const Icon = group.icon;
          const isOpen = openGroups[group.code];

          const groupTotal = sum(
            group.accounts.map(
              (account) => account.balance
            )
          );

          return (
            <div
              className={`overflow-hidden rounded-[10px] border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                isOpen
                  ? "border-[var(--color-border-strong)]"
                  : "border-[var(--color-border)]"
              }`}
      
              key={group.code}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3.5 px-[18px] py-[15px] text-left transition-colors hover:bg-[var(--color-surface-alt)]"
                onClick={() =>
                  toggleGroup(group.code)
                }
              >
                <div className="flex min-w-0 items-center gap-[13px]">
                  <div className="flex w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)]">
                    {isOpen ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                    <Icon size={17} />
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-[14.5px] font-semibold">
                        {group.name}
                      </h3>

                      <span className="font-mono text-[11.5px] text-[var(--color-text-muted)]">
                        {group.code}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {group.accounts.length}{" "}
                      {group.accounts.length === 1
                        ? "account"
                        : "accounts"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-[3px]">
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Balance as of date
                  </span>

                  <strong className="font-mono text-[14.5px] tabular-nums">
                    {formatCompactCurrency(groupTotal)}
                  </strong>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                  <div className="flex items-center justify-between px-[18px] py-[9px] text-[10.5px] font-bold tracking-wider text-[var(--color-text-muted)]">
                    <span>ACCOUNT</span>
                    <span>BALANCE</span>
                  </div>

                  <div className="flex flex-col px-[18px] pb-2">
                    {group.accounts.map((account) => (
                      <div
                        className="flex items-center justify-between gap-3.5 border-b border-[var(--color-border-light)] py-[11px] last:border-b-0"
                        key={account.code}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0 rounded-md border border-[var(--color-border)] bg-white px-[7px] py-[3px] font-mono text-[11px] text-[var(--color-text-muted)]">
                            {account.code}
                          </span>

                          <div>
                            <strong className="block text-[13px]">
                              {account.name}
                            </strong>

                            <span className="mt-px block text-[11.5px] text-[var(--color-text-muted)]">
                              Ledger account
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 font-mono text-[13.5px] tabular-nums text-[var(--color-text-primary)]">
                          {formatCompactCurrency(
                            account.balance
                          )}

                          <ChevronRight
                            size={15}
                            className="text-[var(--color-text-muted)]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfitLoss({ asOfDate }) {
  const report = useMemo(
    () => getProfitLoss(asOfDate),
    [asOfDate]
  );

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <h2 className="text-[19px] font-semibold text-[var(--color-text-primary)]">
            Profit & Loss
          </h2>

          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Income and expenses from{" "}
            {formatDisplayDate(
              getFiscalYearStart(asOfDate)
            )}{" "}
            through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button className={BTN} type="button">
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      <div className={CARD}>
        <CardHeader
          title="Reporting Period"
          subtitle={`${formatDisplayDate(
            getFiscalYearStart(asOfDate)
          )} — ${formatDisplayDate(asOfDate)}`}
          action={
            <ReportPeriodLabel
              asOfDate={asOfDate}
            />
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
        <div className={CARD}>
          <CardHeader
            title="Revenue"
            subtitle="Income recorded in the selected period"
            action={
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[var(--color-success-50)] text-[var(--color-success-700)]">
                <TrendingUp size={17} />
              </span>
            }
          />

          <div className={CARD_BODY}>
            <strong className="block font-mono text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
              {formatCompactCurrency(
                report.totalRevenue
              )}
            </strong>

            <div className="mt-4 flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-2.5 text-[13px] last:border-b-0">
                <span className="text-[var(--color-text-secondary)]">
                  Sales Revenue
                </span>

                <strong className="font-mono tabular-nums">
                  {formatCurrency(
                    report.salesRevenue
                  )}
                </strong>
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-2.5 text-[13px] last:border-b-0">
                <span className="text-[var(--color-text-secondary)]">
                  Other Revenue
                </span>

                <strong className="font-mono tabular-nums">
                  {formatCurrency(
                    report.otherRevenue
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <CardHeader
            title="Expenses"
            subtitle="Expenses recorded in the selected period"
            action={
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[var(--color-danger-50)] text-[var(--color-danger-600)]">
                <TrendingDown size={17} />
              </span>
            }
          />

          <div className={CARD_BODY}>
            <strong className="block font-mono text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
              {formatCompactCurrency(
                report.totalExpenses
              )}
            </strong>

            <div className="mt-4 flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-2.5 text-[13px] last:border-b-0">
                <span className="text-[var(--color-text-secondary)]">
                  Operating Expenses
                </span>

                <strong className="font-mono tabular-nums">
                  {formatCurrency(
                    report.operatingExpenses
                  )}
                </strong>
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-2.5 text-[13px] last:border-b-0">
                <span className="text-[var(--color-text-secondary)]">
                  Transportation
                </span>

                <strong className="font-mono tabular-nums">
                  {formatCurrency(
                    report.transportation
                  )}
                </strong>
              </div>

              <div className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <span className="text-[var(--color-text-secondary)]">
                  Utilities
                </span>

                <strong className="font-mono tabular-nums">
                  {formatCurrency(
                    report.utilities
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <CardHeader
          title="Profit & Loss Trend"
          subtitle="Revenue, expenses and net profit over the reporting period"
        />

        <div className={CARD_BODY}>
          <div className="h-[320px] w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={report.monthlyData}
                margin={{
                  top: 10,
                  right: 20,
                  left: 10,
                  bottom: 10,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="month" />

                <YAxis
                  tickFormatter={(value) =>
                    formatCompactCurrency(value)
                  }
                />

                <Tooltip
                  formatter={(value) =>
                    formatCurrency(value)
                  }
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#0f7b4f"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />

                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#b3261e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />

                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Net Profit"
                  stroke="#234c8c"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <CardHeader
          title="Profit Summary"
          subtitle="Summary of the selected reporting period"
        />

        <div className={CARD_BODY}>
          <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-1">
            <div>
              <span className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                Gross Profit
              </span>

              <strong className="mt-2 block font-mono text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                {formatCompactCurrency(
                  report.totalRevenue
                )}
              </strong>
            </div>

            <div>
              <span className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                Total Expenses
              </span>

              <strong className="mt-2 block font-mono text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                {formatCompactCurrency(
                  report.totalExpenses
                )}
              </strong>
            </div>

            <div>
              <span className="text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                Net Profit
              </span>

              <strong
                className={`mt-2 block font-mono text-xl font-semibold tabular-nums ${
                  report.netProfit >= 0
                    ? "text-[var(--color-success-700)]"
                    : "text-[var(--color-danger-600)]"
                }`}
              >
                {formatCompactCurrency(
                  report.netProfit
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceSheet({ asOfDate }) {
  const snapshot = useMemo(
    () => getBalanceSheetSnapshot(asOfDate),
    [asOfDate]
  );

  const data = useMemo(() => {
    const assets = snapshot?.assets || [];
    const liabilities = snapshot?.liabilities || [];
    const equity = snapshot?.equity || [];

    const sumAccounts = (items) =>
      items.reduce(
        (total, account) =>
          total + Number(account.balance || 0),
        0
      );

    const currentAssets = assets.filter(
      (account) => account.isCurrent
    );

    const nonCurrentAssets = assets.filter(
      (account) => !account.isCurrent
    );

    const currentLiabilities = liabilities.filter(
      (account) => account.isCurrent
    );

    const nonCurrentLiabilities = liabilities.filter(
      (account) => !account.isCurrent
    );

    const totalCurrentAssets =
      sumAccounts(currentAssets);

    const totalNonCurrentAssets =
      sumAccounts(nonCurrentAssets);

    const totalAssets =
      totalCurrentAssets +
      totalNonCurrentAssets;

    const totalCurrentLiabilities =
      sumAccounts(currentLiabilities);

    const totalNonCurrentLiabilities =
      sumAccounts(nonCurrentLiabilities);

    const totalLiabilities =
      totalCurrentLiabilities +
      totalNonCurrentLiabilities;

    const totalEquity = sumAccounts(equity);

    const totalLiabilitiesAndEquity =
      totalLiabilities + totalEquity;

    const difference =
      totalAssets - totalLiabilitiesAndEquity;

    return {
      currentAssets,
      nonCurrentAssets,
      currentLiabilities,
      nonCurrentLiabilities,
      equity,
      totalCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      totalCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      difference,
      isBalanced: Math.abs(difference) <= 0.01,
    };
  }, [snapshot]);

  const {
    currentAssets,
    nonCurrentAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    equity,
    totalCurrentAssets,
    totalNonCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalNonCurrentLiabilities,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
    isBalanced,
  } = data;

  const renderAccount = (account) => (
    <div
      key={`${account.code}-${account.name}`}
      className="flex items-center justify-between border-b border-[var(--color-border)] py-[13px]"
    >
      <div>
        <div className="text-sm font-medium">
          {account.name}
        </div>

        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {account.code}
        </div>
      </div>

      <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums">
        {formatExactCurrency(account.balance)}
      </span>
    </div>
  );

  const renderSection = (
    title,
    accounts,
    total
  ) => (
    <div className="mb-7">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-[9px]">
        <span className="text-[13px] font-bold">
          {title}
        </span>

        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {formatExactCurrency(total)}
        </span>
      </div>

      {accounts.length > 0 ? (
        accounts.map(renderAccount)
      ) : (
        <div className="py-3.5 text-[13px] text-[var(--color-text-muted)]">
          No accounts
        </div>
      )}
    </div>
  );

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <div className={BREADCRUMB}>
            Accounting{" "}
            <span className="text-[var(--color-border-strong)]">
              /
            </span>{" "}
            Financial Position
          </div>

          <h2 className="text-[19px] font-semibold text-[var(--color-text-primary)]">
            Financial Position
          </h2>

          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            A simple summary of the company's financial
            position.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className={BTN}
            type="button"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      <div className="text-[13px] text-[var(--color-text-muted)]">
        As of{" "}
        <strong className="text-[var(--color-text-primary)]">
          {formatDisplayDate(asOfDate)}
        </strong>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
        <div className={CARD}>
          <div className={CARD_BODY}>
            <span className="mb-2 block text-[13px] text-[var(--color-text-muted)]">
              Total Assets
            </span>

            <strong className="font-mono text-[26px] font-bold tabular-nums">
              {formatExactCurrency(totalAssets)}
            </strong>

            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              Everything the company owns
            </div>
          </div>
        </div>

        <div className={CARD}>
          <div className={CARD_BODY}>
            <span className="mb-2 block text-[13px] text-[var(--color-text-muted)]">
              Total Liabilities
            </span>

            <strong className="font-mono text-[26px] font-bold tabular-nums">
              {formatExactCurrency(
                totalLiabilities
              )}
            </strong>

            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              Everything the company owes
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-[18px] py-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                What the Company Owns
              </h3>

              <p className="mt-[3px] text-xs text-[var(--color-text-secondary)]">
                Assets
              </p>
            </div>

            <strong className="font-mono text-[15px] font-semibold tabular-nums">
              {formatExactCurrency(totalAssets)}
            </strong>
          </div>

          <div className={CARD_BODY}>
            {renderSection(
              "Current Assets",
              currentAssets,
              totalCurrentAssets
            )}

            {renderSection(
              "Long-Term Assets",
              nonCurrentAssets,
              totalNonCurrentAssets
            )}

            <div className="flex justify-between border-t-2 border-[var(--color-border)] pt-[15px] text-[15px]">
              <strong>Total Assets</strong>

              <strong className="font-mono tabular-nums">
                {formatExactCurrency(totalAssets)}
              </strong>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-[18px] py-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                What the Company Owes
              </h3>

              <p className="mt-[3px] text-xs text-[var(--color-text-secondary)]">
                Liabilities and owner's equity
              </p>
            </div>

            <strong className="font-mono text-[15px] font-semibold tabular-nums">
              {formatExactCurrency(
                totalLiabilitiesAndEquity
              )}
            </strong>
          </div>

          <div className={CARD_BODY}>
            {renderSection(
              "Current Liabilities",
              currentLiabilities,
              totalCurrentLiabilities
            )}

            {renderSection(
              "Long-Term Liabilities",
              nonCurrentLiabilities,
              totalNonCurrentLiabilities
            )}

            {renderSection(
              "Owner's Equity",
              equity,
              totalEquity
            )}

            <div className="flex justify-between border-t-2 border-[var(--color-border)] pt-[15px] text-[15px]">
              <strong>
                Liabilities + Equity
              </strong>

              <strong className="font-mono tabular-nums">
                {formatExactCurrency(
                  totalLiabilitiesAndEquity
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-5 p-[18px]">
          <div>
            <strong className="mb-1 block text-[15px]">
              Balance Check
            </strong>

            <span className="text-[13px] text-[var(--color-text-muted)]">
              Assets should equal liabilities plus
              owner's equity.
            </span>
          </div>

          <div
            className={`text-[15px] font-semibold ${
              isBalanced
                ? "text-[var(--color-success-700)]"
                : "text-[var(--color-danger-600)]"
            }`}
          >
            {isBalanced
              ? "Balanced"
              : `Difference: ${formatExactCurrency(
                  Math.abs(difference)
                )}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function CashFlow({ asOfDate }) {
  const openingCash = 1800000;

  const sectionTotals = useMemo(
    () => getCashFlow(asOfDate),
    [asOfDate]
  );

  const items = sectionTotals.flatMap(
    (section) => section.items
  );

  const totalInflow = sum(
    items
      .filter((item) => item.amount > 0)
      .map((item) => item.amount)
  );

  const totalOutflow = Math.abs(
    sum(
      items
        .filter((item) => item.amount < 0)
        .map((item) => item.amount)
    )
  );

  const netMovement = sum(
    sectionTotals.map(
      (section) => section.total
    )
  );

  const closingCash =
    openingCash + netMovement;

  return (
    <div className={PAGE_SECTION}>
      <div className={PAGE_HEADING}>
        <div>
          <div className={BREADCRUMB}>
            Accounting{" "}
            <span className="text-[var(--color-border-strong)]">
              /
            </span>{" "}
            Cash Flow
          </div>

          <h2 className="text-[19px] font-semibold text-[var(--color-text-primary)]">
            Cash Flow
          </h2>

          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Cash movement from{" "}
            {formatDisplayDate(
              getFiscalYearStart(asOfDate)
            )}{" "}
            through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button className={BTN} type="button">
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      <div className={STATS_GRID}>
        <AccountingStat
          icon={Wallet}
          title="Opening Cash"
          value={formatCompactCurrency(openingCash)}
          change="Start of fiscal period"
        />

        <AccountingStat
          icon={ArrowDownToLine}
          title="Cash Inflow"
          value={formatCompactCurrency(totalInflow)}
          change="Money received"
        />

        <AccountingStat
          icon={ArrowUpFromLine}
          title="Cash Outflow"
          value={formatCompactCurrency(totalOutflow)}
          change="Money paid"
          negative
        />

        <AccountingStat
          icon={Banknote}
          title="Closing Cash"
          value={formatCompactCurrency(closingCash)}
          change={`Through ${formatDisplayDate(
            asOfDate
          )}`}
        />
      </div>

      <div className="grid grid-cols-3 items-start gap-4 max-[1100px]:grid-cols-1">
        {sectionTotals.map((section) => {
          const isPositive =
            section.total >= 0;

          return (
            <div
              className="flex flex-col overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              key={section.category}
            >
              <div className="flex flex-col gap-3.5 border-b border-[var(--color-border)] px-[18px] py-4">
                <div className="flex items-center gap-[11px]">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isPositive
                        ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
                        : "bg-[var(--color-danger-50)] text-[var(--color-danger-600)]"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowDownToLine size={16} />
                    ) : (
                      <ArrowUpFromLine size={16} />
                    )}
                  </div>

                  <div>
                    <h3 className="text-[13.5px] font-semibold">
                      {section.category}
                    </h3>

                    <span className="mt-px block text-[11.5px] text-[var(--color-text-muted)]">
                      {section.items.length}{" "}
                      {section.items.length === 1
                        ? "transaction"
                        : "transactions"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5 rounded-lg bg-[var(--color-surface-alt)] px-3 py-[9px] text-xs font-semibold">
                  <span
                    className={
                      isPositive
                        ? "text-[var(--color-success-700)]"
                        : "text-[var(--color-danger-600)]"
                    }
                  >
                    {isPositive
                      ? "Net cash inflow"
                      : "Net cash outflow"}
                  </span>

                  <strong
                    className={`font-mono text-[13.5px] tabular-nums ${
                      isPositive
                        ? "text-[var(--color-success-700)]"
                        : "text-[var(--color-danger-600)]"
                    }`}
                  >
                    {isPositive ? "+" : "-"}
                    {formatCurrency(
                      Math.abs(section.total)
                    )}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[var(--color-surface-alt)] px-[18px] py-[9px] text-[10.5px] font-bold tracking-wider text-[var(--color-text-muted)]">
                <span>ACTIVITY</span>
                <span>AMOUNT</span>
              </div>

              <div className="flex flex-1 flex-col px-[18px] pb-2.5 pt-0.5">
                {section.items.map((item) => {
                  const positive =
                    item.amount >= 0;

                  return (
                    <div
                      className="flex items-center justify-between gap-3 border-b border-[var(--color-border-light)] py-[11px] last:border-b-0"
                      key={`${item.date}-${item.label}`}
                    >
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                            positive
                              ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
                              : "bg-[var(--color-danger-50)] text-[var(--color-danger-600)]"
                          }`}
                        >
                          {positive ? (
                            <ArrowDownToLine size={14} />
                          ) : (
                            <ArrowUpFromLine size={14} />
                          )}
                        </div>

                        <div>
                          <strong className="block text-[12.5px]">
                            {item.label}
                          </strong>

                          <span className="mt-px block text-[11.5px] text-[var(--color-text-muted)]">
                            {formatDisplayDate(
                              item.date
                            )}
                          </span>
                        </div>
                      </div>

                      <strong
                        className={`shrink-0 font-mono text-[13px] tabular-nums ${
                          positive
                            ? "text-[var(--color-success-700)]"
                            : "text-[var(--color-danger-600)]"
                        }`}
                      >
                        {positive ? "+" : "-"}
                        {formatCurrency(
                          Math.abs(item.amount)
                        )}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
  <div className="mb-4">
    <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
      Cash Movement Summary
    </h3>

    <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
      Opening balance plus net cash movement through the selected date.
    </p>
  </div>

  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
    
    <div className="rounded-xl border border-[var(--color-brand-200)] bg-[var(--color-brand-50)] px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand-700)]">
        Opening Cash
      </div>

      <div className="font-mono text-[20px] font-semibold tracking-tight text-[var(--color-brand-800)]">
        ₹18.00 L
      </div>
    </div>

    <div className="rounded-xl border border-[var(--color-brand-200)] bg-[var(--color-brand-50)] px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand-700)]">
        Net Movement
      </div>

      <div className="font-mono text-[20px] font-semibold tracking-tight text-[var(--color-brand-800)]">
        +₹22.60 L
      </div>
    </div>

    <div className="rounded-xl border border-[var(--color-brand-300)] bg-[var(--color-brand-100)] px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand-800)]">
        Closing Cash
      </div>

      <div className="font-mono text-[20px] font-semibold tracking-tight text-[var(--color-brand-900)]">
        ₹40.60 L
      </div>
    </div>

  </div>
</div>
    </div>
  );
}

export default function Accounting() {
  const [activeTab, setActiveTab] =
    useState("overview");

  const [asOfDate, setAsOfDate] =
    useState(DEFAULT_AS_OF_DATE);

  const report = useMemo(
    () => ({
      asOfDate,
      label: formatDisplayDate(asOfDate),
    }),
    [asOfDate]
  );

  function renderTab() {
    switch (activeTab) {
      case "overview":
        return (
          <Overview
            asOfDate={report.asOfDate}
          />
        );

      case "payables":
        return (
          <Payables
            asOfDate={report.asOfDate}
          />
        );

      case "accounts":
        return (
          <ChartOfAccounts
            asOfDate={report.asOfDate}
          />
        );

      case "profit-loss":
        return (
          <ProfitLoss
            asOfDate={report.asOfDate}
          />
        );

      case "balance-sheet":
        return (
          <BalanceSheet
            asOfDate={report.asOfDate}
          />
        );

      case "cash-flow":
        return (
          <CashFlow
            asOfDate={report.asOfDate}
          />
        );

      default:
        return (
          <Overview
            asOfDate={report.asOfDate}
          />
        );
    }
  }

  return (
    <div className="w-full">
      <div className={PAGE_HEADING}>
        <div>
          <div className={BREADCRUMB}>
            Finance{" "}
            <span className="text-[var(--color-border-strong)]">
              /
            </span>{" "}
            Accounting
          </div>

          <h1 className="text-[23px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Accounting
          </h1>

          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Manage financial accounts, statements and
            business cash flow.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="flex h-9 items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white px-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Date
            </span>

            <input
              type="date"
              value={asOfDate}
              max={getTodayInputValue()}
              onChange={(event) =>
                setAsOfDate(event.target.value)
              }
              className="border-0 bg-transparent font-mono text-[12.5px] text-[var(--color-text-primary)] outline-none"
            />
          </label>

          <button
            className={BTN}
            type="button"
          >
            <Download size={15} />
            Export Report
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-[var(--color-info-100)] bg-[var(--color-info-50)] px-3.5 py-[11px] text-[12.5px] leading-relaxed text-[var(--color-brand-800)]">
        All accounting tabs are filtered through{" "}
        <strong className="font-semibold">{report.label}</strong>. Profit & Loss
        and Cash Flow use the fiscal period from{" "}
        <strong className="font-semibold">
          {formatDisplayDate(
            getFiscalYearStart(asOfDate)
          )}
        </strong>{" "}
        through that date. Balance reports are
        point-in-time reports.
      </div>

      <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)]">
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
              onClick={() =>
                setActiveTab(tab.id)
              }
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