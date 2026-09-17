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
  Activity,
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

/* =========================================================
   TABS
   ========================================================= */

const accountingTabs = [
  { id: "overview", label: "Overview", icon: Wallet },
  { id: "payables", label: "Payables", icon: ArrowUpFromLine },
  { id: "accounts", label: "Chart of Accounts", icon: Landmark },
  { id: "profit-loss", label: "Profit & Loss", icon: TrendingUp },
  { id: "balance-sheet", label: "Balance Sheet", icon: Scale },
  { id: "cash-flow", label: "Cash Flow", icon: Banknote },
];

const DEFAULT_AS_OF_DATE = "2026-09-16";
const FISCAL_YEAR_START_MONTH = 3; // April, zero-based

/* =========================================================
   MOCK PAYABLES
   ========================================================= */

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

/* =========================================================
   MOCK CHART OF ACCOUNTS
   ========================================================= */

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
   MOCK BALANCE SHEET ACCOUNTS
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

/* =========================================================
   MOCK PROFIT & LOSS DATA
   ========================================================= */

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

/* =========================================================
   MOCK CASH FLOW DATA
   ========================================================= */

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

/* =========================================================
   HELPERS
   ========================================================= */

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

/* =========================================================
   LEDGER / CHART OF ACCOUNTS HELPERS
   ========================================================= */

function getAccountBalance(account, asOfDate) {
  return isOnOrBefore(DEFAULT_AS_OF_DATE, asOfDate)
    ? account.balance
    : account.openingBalance;
}

/*
  Used by Overview and Chart of Accounts.
*/
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

/*
  Used specifically by Balance Sheet.
*/
function getBalanceSheetSnapshot(asOfDate) {
  return {
    asOfDate,
    assets: mockBalanceSheetAccounts.assets,
    liabilities: mockBalanceSheetAccounts.liabilities,
    equity: mockBalanceSheetAccounts.equity,
  };
}

/* =========================================================
   PAYABLE HELPERS
   ========================================================= */

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

/* =========================================================
   PROFIT & LOSS
   ========================================================= */

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

  /*
    Build monthly graph data.
  */
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

  const monthlyData = Object.values(months)
    .sort((a, b) => {
      const aIndex = Object.keys(months).indexOf(
        Object.keys(months).find(
          (key) => months[key] === a
        )
      );

      const bIndex = Object.keys(months).indexOf(
        Object.keys(months).find(
          (key) => months[key] === b
        )
      );

      return aIndex - bIndex;
    })
    .map((month) => ({
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

/* =========================================================
   CASH FLOW
   ========================================================= */

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

/* =========================================================
   SHARED COMPONENTS
   ========================================================= */

function AccountingStat({
  icon: Icon,
  title,
  value,
  change,
  negative = false,
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-title">{title}</span>

        <span className="stat-icon">
          <Icon size={17} />
        </span>
      </div>

      <strong className="stat-value">{value}</strong>

      {change && (
        <div
          className={`stat-change ${
            negative ? "negative" : ""
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
  const statusMap = {
    Due: "badge-warning",
    Pending: "badge-neutral",
    Overdue: "badge-danger",
    Upcoming: "badge-info",
  };

  return (
    <span
      className={`badge ${
        statusMap[status] || "badge-neutral"
      }`}
    >
      <span className="badge-dot" />
      {status}
    </span>
  );
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="card-header">
      <div>
        <h3>{title}</h3>

        {subtitle && <p>{subtitle}</p>}
      </div>

      {action}
    </div>
  );
}

function ReportPeriodLabel({ asOfDate }) {
  return (
    <span className="badge badge-info">
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

  const cashBalance = sum(
    cashAccounts.map((account) => account.balance)
  );

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
    <div className="page-section">
      <div className="stats-grid">
        <AccountingStat
          icon={CircleDollarSign}
          title="Total Assets"
          value={formatCompactCurrency(totalAssets)}
          change={`As of ${formatDisplayDate(asOfDate)}`}
        />

        <AccountingStat
          icon={ArrowUpFromLine}
          title="Total Liabilities"
          value={formatCompactCurrency(
            totalLiabilities
          )}
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

      <div className="dashboard-grid">
        <div className="card">
          <CardHeader
            title="Financial Position"
            subtitle={`Balances through ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className="card-body">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 4px",
                  borderBottom:
                    "1px solid #e5e7eb",
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>
                    Assets
                  </strong>

                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#94a3b8",
                      marginTop: 3,
                    }}
                  >
                    What the business owns
                  </span>
                </div>

                <strong
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {formatCompactCurrency(totalAssets)}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 4px",
                  borderBottom:
                    "1px solid #e5e7eb",
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>
                    Liabilities
                  </strong>

                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#94a3b8",
                      marginTop: 3,
                    }}
                  >
                    Outstanding obligations
                  </span>
                </div>

                <strong
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {formatCompactCurrency(
                    totalLiabilities
                  )}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 4px",
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>
                    Equity
                  </strong>

                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#94a3b8",
                      marginTop: 3,
                    }}
                  >
                    Owner investment and retained
                    earnings
                  </span>
                </div>

                <strong
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {formatCompactCurrency(totalEquity)}
                </strong>
              </div>
            </div>

            <div
              className={
                isBalanced
                  ? "alert alert-success"
                  : "alert alert-danger"
              }
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Scale size={15} />

              <span>
                {isBalanced
                  ? "Balance check passed"
                  : "Balance mismatch"}

                <strong style={{ marginLeft: 6 }}>
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

        <div className="card">
          <CardHeader
            title="Cash Position"
            subtitle={`Cash and bank balances as of ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className="card-body">
            <div className="stat-top">
              <span className="stat-title">
                Cash & Bank
              </span>

              <span className="stat-icon">
                <Banknote size={17} />
              </span>
            </div>

            <strong className="stat-value">
              {formatCompactCurrency(cashBalance)}
            </strong>

            <div
              className="list"
              style={{ marginTop: 16 }}
            >
              {cashAccounts.map((account) => (
                <div
                  className="list-item"
                  key={account.code}
                >
                  <span>
                    {account.name === "Bank Account"
                      ? "Bank"
                      : account.name}
                  </span>

                  <strong>
                    {formatCompactCurrency(
                      account.balance
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <CardHeader
            title="Accounts Receivable"
            subtitle={`Customer balances through ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className="card-body">
            <strong className="stat-value">
              {formatCompactCurrency(receivables)}
            </strong>

            <p className="text-sm text-muted">
              Detailed aging requires invoice and
              settlement records.
            </p>
          </div>
        </div>

        <div className="card">
          <CardHeader
            title="Accounts Payable"
            subtitle={`Supplier balances through ${formatDisplayDate(
              asOfDate
            )}`}
          />

          <div className="card-body">
            <strong className="stat-value">
              {formatCompactCurrency(totalPayables)}
            </strong>

            <p className="text-sm text-muted">
              {getPayables(asOfDate).length} payable
              records included.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAYABLES
   ========================================================= */

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
    <div className="page-section">
      <div className="page-heading">
        <div>
          <h2>Accounts Payable</h2>

          <p>
            Supplier obligations recorded through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="actions">
          <button
            className="btn primary-button"
            type="button"
          >
            <Plus size={15} />
            Add Payable
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <AccountingStat
          icon={ArrowUpFromLine}
          title="Total Payables"
          value={formatCompactCurrency(
            totalPayables
          )}
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

      <div className="card">
        <CardHeader
          title="Supplier Payables"
          subtitle={`${filteredPayables.length} payable records as of ${formatDisplayDate(
            asOfDate
          )}`}
        />

        <div className="enquiries-toolbar">
          <div className="page-search">
            <Search size={15} />

            <input
              type="text"
              placeholder="Search supplier or invoice..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Invoice</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filteredPayables.map((item) => (
                <tr key={item.invoice}>
                  <td>
                    <div className="table-person">
                      <span className="avatar avatar-sm">
                        {item.supplier.charAt(0)}
                      </span>

                      <strong>{item.supplier}</strong>
                    </div>
                  </td>

                  <td>{item.invoice}</td>

                  <td>
                    {formatDisplayDate(item.dueDate)}
                  </td>

                  <td>
                    <strong>
                      {formatCurrency(item.amount)}
                    </strong>
                  </td>

                  <td>
                    <StatusBadge
                      status={item.status}
                    />
                  </td>

                  <td>
                    <button
                      className="table-action"
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
                    <div className="empty-state">
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

/* =========================================================
   CHART OF ACCOUNTS
   ========================================================= */

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
    <div className="page-section chart-accounts-page">
      <div className="page-heading coa-page-heading">
        <div>
          <div className="page-breadcrumb">
            Accounting <span>/</span> Chart of Accounts
          </div>

          <h2>Chart of Accounts</h2>

          <p>
            Account balances through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="actions">
          <button
            className="btn primary-button"
            type="button"
          >
            <Plus size={15} />
            Add Account
          </button>
        </div>
      </div>

      <div className="coa-summary">
        <div className="coa-summary-item">
          <span className="coa-summary-number">
            {snapshot.length}
          </span>

          <div>
            <strong>Account Groups</strong>
            <span>Organized categories</span>
          </div>
        </div>

        <div className="coa-summary-divider" />

        <div className="coa-summary-item">
          <span className="coa-summary-number">
            {totalAccounts}
          </span>

          <div>
            <strong>Total Accounts</strong>
            <span>Ledger accounts</span>
          </div>
        </div>

        <div className="coa-summary-divider" />

        <div className="coa-summary-item">
          <span className="coa-summary-status-dot" />

          <div>
            <strong>Ledger Active</strong>
            <span>
              As of {formatDisplayDate(asOfDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="coa-sections">
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
              className={`coa-section ${
                isOpen ? "coa-section-open" : ""
              }`}
              key={group.code}
            >
              <button
                type="button"
                className="coa-section-header"
                onClick={() =>
                  toggleGroup(group.code)
                }
              >
                <div className="coa-section-left">
                  <div className="coa-expand">
                    {isOpen ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>

                  <div className="coa-section-icon">
                    <Icon size={17} />
                  </div>

                  <div>
                    <div className="coa-section-name">
                      <h3>{group.name}</h3>

                      <span className="coa-section-code">
                        {group.code}
                      </span>
                    </div>

                    <p>
                      {group.accounts.length}{" "}
                      {group.accounts.length === 1
                        ? "account"
                        : "accounts"}
                    </p>
                  </div>
                </div>

                <div className="coa-section-total">
                  <span>Balance as of date</span>

                  <strong>
                    {formatCompactCurrency(
                      groupTotal
                    )}
                  </strong>
                </div>
              </button>

              {isOpen && (
                <div className="coa-accounts">
                  <div className="coa-table-head">
                    <span>ACCOUNT</span>
                    <span>BALANCE</span>
                  </div>

                  <div className="coa-account-list">
                    {group.accounts.map(
                      (account) => (
                        <div
                          className="coa-account-row"
                          key={account.code}
                        >
                          <div className="coa-account-main">
                            <span className="coa-account-code">
                              {account.code}
                            </span>

                            <div className="coa-account-name">
                              <strong>
                                {account.name}
                              </strong>

                              <span>
                                Ledger account
                              </span>
                            </div>
                          </div>

                          <div className="coa-account-value">
                            {formatCompactCurrency(
                              account.balance
                            )}

                            <ChevronRight
                              size={15}
                            />
                          </div>
                        </div>
                      )
                    )}
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

/* =========================================================
   PROFIT & LOSS
   ========================================================= */

function ProfitLoss({ asOfDate }) {
  const report = useMemo(
    () => getProfitLoss(asOfDate),
    [asOfDate]
  );

  return (
    <div className="page-section">
      <div className="page-heading">
        <div>
          <h2>Profit & Loss</h2>

          <p>
            Income and expenses from{" "}
            {formatDisplayDate(
              getFiscalYearStart(asOfDate)
            )}{" "}
            through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="actions">
          <button className="btn" type="button">
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      <div className="card">
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

      <div
        className="grid grid-2"
        style={{ marginTop: 20 }}
      >
        <div className="card">
          <CardHeader
            title="Revenue"
            subtitle="Income recorded in the selected period"
            action={
              <span className="stat-icon">
                <TrendingUp size={17} />
              </span>
            }
          />

          <div className="card-body">
            <strong className="stat-value">
              {formatCompactCurrency(
                report.totalRevenue
              )}
            </strong>

            <div
              className="list"
              style={{ marginTop: 16 }}
            >
              <div className="list-item">
                <span>Sales Revenue</span>

                <strong>
                  {formatCurrency(
                    report.salesRevenue
                  )}
                </strong>
              </div>

              <div className="list-item">
                <span>Other Revenue</span>

                <strong>
                  {formatCurrency(
                    report.otherRevenue
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <CardHeader
            title="Expenses"
            subtitle="Expenses recorded in the selected period"
            action={
              <span className="stat-icon">
                <TrendingDown size={17} />
              </span>
            }
          />

          <div className="card-body">
            <strong className="stat-value">
              {formatCompactCurrency(
                report.totalExpenses
              )}
            </strong>

            <div
              className="list"
              style={{ marginTop: 16 }}
            >
              <div className="list-item">
                <span>Operating Expenses</span>

                <strong>
                  {formatCurrency(
                    report.operatingExpenses
                  )}
                </strong>
              </div>

              <div className="list-item">
                <span>Transportation</span>

                <strong>
                  {formatCurrency(
                    report.transportation
                  )}
                </strong>
              </div>

              <div className="list-item">
                <span>Utilities</span>

                <strong>
                  {formatCurrency(
                    report.utilities
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* P&L TREND */}
      <div
        className="card"
        style={{ marginTop: 20 }}
      >
        <CardHeader
          title="Profit & Loss Trend"
          subtitle="Revenue, expenses and net profit over the reporting period"
        />

        <div className="card-body">
          <div
            style={{
              width: "100%",
              height: 320,
            }}
          >
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
                <CartesianGrid
                  strokeDasharray="3 3"
                />

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
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />

                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />

                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Net Profit"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* PROFIT SUMMARY */}
      <div
        className="card"
        style={{ marginTop: 20 }}
      >
        <CardHeader
          title="Profit Summary"
          subtitle="Summary of the selected reporting period"
        />

        <div className="card-body">
          <div className="grid grid-3">
            <div>
              <span className="stat-title">
                Gross Profit
              </span>

              <strong className="stat-value">
                {formatCompactCurrency(
                  report.totalRevenue
                )}
              </strong>
            </div>

            <div>
              <span className="stat-title">
                Total Expenses
              </span>

              <strong className="stat-value">
                {formatCompactCurrency(
                  report.totalExpenses
                )}
              </strong>
            </div>

            <div>
              <span className="stat-title">
                Net Profit
              </span>

              <strong
                className={`stat-value ${
                  report.netProfit >= 0
                    ? "text-success"
                    : "text-danger"
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

/* =========================================================
   BALANCE SHEET
   ========================================================= */

function BalanceSheet({ asOfDate }) {
  const snapshot = useMemo(
    () => getBalanceSheetSnapshot(asOfDate),
    [asOfDate]
  );

  const data = useMemo(() => {
    const assets = snapshot?.assets || [];
    const liabilities = snapshot?.liabilities || [];
    const equity = snapshot?.equity || [];

    const sum = (items) =>
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

    const totalCurrentAssets = sum(currentAssets);
    const totalNonCurrentAssets = sum(nonCurrentAssets);
    const totalAssets =
      totalCurrentAssets + totalNonCurrentAssets;

    const totalCurrentLiabilities = sum(
      currentLiabilities
    );

    const totalNonCurrentLiabilities = sum(
      nonCurrentLiabilities
    );

    const totalLiabilities =
      totalCurrentLiabilities +
      totalNonCurrentLiabilities;

    const totalEquity = sum(equity);

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
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 0",
        borderBottom:
          "1px solid var(--border-color, #e5e7eb)",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {account.name}
        </div>

        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted, #6b7280)",
            marginTop: 3,
          }}
        >
          {account.code}
        </div>
      </div>

      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {formatExactCurrency(account.balance)}
      </span>
    </div>
  );

  const renderSection = (
    title,
    accounts,
    total
  ) => (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 9,
          borderBottom:
            "1px solid var(--border-color, #e5e7eb)",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {title}
        </span>

        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {formatExactCurrency(total)}
        </span>
      </div>

      {accounts.length > 0 ? (
        accounts.map(renderAccount)
      ) : (
        <div
          style={{
            padding: "14px 0",
            fontSize: 13,
            color: "var(--text-muted, #6b7280)",
          }}
        >
          No accounts
        </div>
      )}
    </div>
  );

  return (
    <div className="page-section">
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <div className="page-breadcrumb">
            Accounting <span>/</span> Financial Position
          </div>

          <h2>Financial Position</h2>

          <p>
            A simple summary of the company's financial
            position.
          </p>
        </div>

        <div className="actions">
          <button
            className="btn btn-secondary"
            type="button"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* DATE */}
      <div
        style={{
          marginBottom: 20,
          fontSize: 13,
          color: "var(--text-muted, #6b7280)",
        }}
      >
        As of{" "}
        <strong
          style={{
            color: "var(--text-primary, #111827)",
          }}
        >
          {formatDisplayDate(asOfDate)}
        </strong>
      </div>

      {/* SIMPLE SUMMARY */}
      <div
        className="grid grid-2"
        style={{ marginBottom: 20 }}
      >
        <div className="card">
          <div className="card-body">
            <span
              style={{
                display: "block",
                fontSize: 13,
                color: "var(--text-muted, #6b7280)",
                marginBottom: 8,
              }}
            >
              Total Assets
            </span>

            <strong
              style={{
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {formatExactCurrency(totalAssets)}
            </strong>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                color: "var(--text-muted, #6b7280)",
              }}
            >
              Everything the company owns
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <span
              style={{
                display: "block",
                fontSize: 13,
                color: "var(--text-muted, #6b7280)",
                marginBottom: 8,
              }}
            >
              Total Liabilities
            </span>

            <strong
              style={{
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {formatExactCurrency(totalLiabilities)}
            </strong>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                color: "var(--text-muted, #6b7280)",
              }}
            >
              Everything the company owes
            </div>
          </div>
        </div>
      </div>

      {/* BALANCE SHEET */}
      <div className="grid grid-2">
        {/* LEFT */}
        <div className="card">
          <div
            className="card-header"
            style={{
              paddingBottom: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                What the Company Owns
              </h3>

              <p className="text-muted">
                Assets
              </p>
            </div>

            <strong>
              {formatExactCurrency(totalAssets)}
            </strong>
          </div>

          <div className="card-body">
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

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 15,
                borderTop:
                  "2px solid var(--border-color, #d1d5db)",
                fontSize: 15,
              }}
            >
              <strong>Total Assets</strong>

              <strong>
                {formatExactCurrency(totalAssets)}
              </strong>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="card">
          <div
            className="card-header"
            style={{
              paddingBottom: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                What the Company Owes
              </h3>

              <p className="text-muted">
                Liabilities and owner's equity
              </p>
            </div>

            <strong>
              {formatExactCurrency(
                totalLiabilitiesAndEquity
              )}
            </strong>
          </div>

          <div className="card-body">
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

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 15,
                borderTop:
                  "2px solid var(--border-color, #d1d5db)",
                fontSize: 15,
              }}
            >
              <strong>
                Liabilities + Equity
              </strong>

              <strong>
                {formatExactCurrency(
                  totalLiabilitiesAndEquity
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* BALANCE CHECK */}
      <div
        className="card"
        style={{ marginTop: 20 }}
      >
        <div
          className="card-body"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong
              style={{
                display: "block",
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              Balance Check
            </strong>

            <span
              style={{
                fontSize: 13,
                color: "var(--text-muted, #6b7280)",
              }}
            >
              Assets should equal liabilities plus
              owner's equity.
            </span>
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
            }}
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

/* =========================================================
   CASH FLOW
   ========================================================= */

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
    <div className="page-section cash-flow-page">
      <div className="page-heading cash-flow-heading">
        <div>
          <div className="page-breadcrumb">
            Accounting <span>/</span> Cash Flow
          </div>

          <h2>Cash Flow</h2>

          <p>
            Cash movement from{" "}
            {formatDisplayDate(
              getFiscalYearStart(asOfDate)
            )}{" "}
            through{" "}
            {formatDisplayDate(asOfDate)}.
          </p>
        </div>

        <div className="actions">
          <button className="btn" type="button">
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      <div className="stats-grid cash-flow-stats">
        <AccountingStat
          icon={Wallet}
          title="Opening Cash"
          value={formatCompactCurrency(
            openingCash
          )}
          change="Start of fiscal period"
        />

        <AccountingStat
          icon={ArrowDownToLine}
          title="Cash Inflow"
          value={formatCompactCurrency(
            totalInflow
          )}
          change="Money received"
        />

        <AccountingStat
          icon={ArrowUpFromLine}
          title="Cash Outflow"
          value={formatCompactCurrency(
            totalOutflow
          )}
          change="Money paid"
          negative
        />

        <AccountingStat
          icon={Banknote}
          title="Closing Cash"
          value={formatCompactCurrency(
            closingCash
          )}
          change={`Through ${formatDisplayDate(
            asOfDate
          )}`}
        />
      </div>

      <div className="cash-flow-sections grid grid-3">
        {sectionTotals.map((section) => {
          const isPositive =
            section.total >= 0;

          return (
            <div
              className="cash-flow-section"
              key={section.category}
            >
              <div className="cash-flow-section-header">
                <div className="cash-flow-section-title">
                  <div
                    className={`cash-flow-section-icon ${
                      isPositive
                        ? "cash-flow-positive"
                        : "cash-flow-negative"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowDownToLine size={16} />
                    ) : (
                      <ArrowUpFromLine size={16} />
                    )}
                  </div>

                  <div>
                    <h3>{section.category}</h3>

                    <span>
                      {section.items.length}{" "}
                      {section.items.length === 1
                        ? "transaction"
                        : "transactions"}
                    </span>
                  </div>
                </div>

                <div
                  className={`cash-flow-section-total ${
                    isPositive
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  <span>
                    {isPositive
                      ? "Net cash inflow"
                      : "Net cash outflow"}
                  </span>

                  <strong>
                    {isPositive ? "+" : "-"}
                    {formatCurrency(
                      Math.abs(
                        section.total
                      )
                    )}
                  </strong>
                </div>
              </div>

              <div className="cash-flow-table-head">
                <span>ACTIVITY</span>
                <span>AMOUNT</span>
              </div>

              <div className="cash-flow-list">
                {section.items.map((item) => {
                  const positive =
                    item.amount >= 0;

                  return (
                    <div
                      className="cash-flow-row"
                      key={`${item.date}-${item.label}`}
                    >
                      <div className="cash-flow-item">
                        <div
                          className={`cash-flow-item-icon ${
                            positive
                              ? "cash-flow-positive"
                              : "cash-flow-negative"
                          }`}
                        >
                          {positive ? (
                            <ArrowDownToLine
                              size={14}
                            />
                          ) : (
                            <ArrowUpFromLine
                              size={14}
                            />
                          )}
                        </div>

                        <div>
                          <strong>
                            {item.label}
                          </strong>

                          <span>
                            {formatDisplayDate(
                              item.date
                            )}
                          </span>
                        </div>
                      </div>

                      <strong
                        className={
                          positive
                            ? "text-success"
                            : "text-danger"
                        }
                      >
                        {positive ? "+" : "-"}
                        {formatCurrency(
                          Math.abs(
                            item.amount
                          )
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

      <div className="cash-flow-summary">
        <div className="cash-flow-summary-header">
          <div>
            <h3>Cash Movement Summary</h3>

            <p>
              Opening balance plus net cash movement
              through the selected date.
            </p>
          </div>
        </div>

        <div className="cash-flow-summary-grid">
          <div className="cash-flow-summary-item">
            <span>Opening Cash</span>

            <strong>
              {formatCompactCurrency(
                openingCash
              )}
            </strong>
          </div>

          <div className="cash-flow-summary-item">
            <span>Net Movement</span>

            <strong
              className={
                netMovement >= 0
                  ? "text-success"
                  : "text-danger"
              }
            >
              {netMovement >= 0 ? "+" : "-"}
              {formatCompactCurrency(
                Math.abs(netMovement)
              )}
            </strong>
          </div>

          <div className="cash-flow-summary-item highlight">
            <span>Closing Cash</span>

            <strong>
              {formatCompactCurrency(
                closingCash
              )}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN ACCOUNTING PAGE
   ========================================================= */

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
    <div className="page accounting-page">
      <div className="page-heading">
        <div>
          <div className="page-breadcrumb">
            Finance <span>/</span> Accounting
          </div>

          <h1>Accounting</h1>

          <p>
            Manage financial accounts, statements and
            business cash flow.
          </p>
        </div>

        <div className="actions">
          <label className="date-filter">
            <span>Date</span>

            <input
              type="date"
              value={asOfDate}
              max={getTodayInputValue()}
              onChange={(event) =>
                setAsOfDate(
                  event.target.value
                )
              }
            />
          </label>

          <button
            className="btn"
            type="button"
          >
            <Download size={15} />
            Export Report
          </button>
        </div>
      </div>

      <div
        className="accounting-date-summary"
        style={{ marginBottom: "20px" }}
      >
        All accounting tabs are filtered through{" "}
        <strong>{report.label}</strong>. Profit & Loss
        and Cash Flow use the fiscal period from{" "}
        <strong>
          {formatDisplayDate(
            getFiscalYearStart(asOfDate)
          )}
        </strong>{" "}
        through that date. Balance reports are
        point-in-time reports.
      </div>

      <div className="tabs">
        {accountingTabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={`tab ${
                activeTab === tab.id
                  ? "active"
                  : ""
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