'use strict';

const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const { RawPurchase } = require('../models/RawMaterial');
const Salary = require('../models/Salary');

const FISCAL_YEAR_START_MONTH = 3;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseAsOfDate(value) {
  if (!value) {
    const now = new Date();

    return new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      )
    );
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw badRequest('asOf must be YYYY-MM-DD');
  }

  const [y, m, d] = value.split('-').map(Number);

  if (
    y < 2000 ||
    y > 2100 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    throw badRequest('asOf is out of range');
  }

  const date = new Date(
    Date.UTC(y, m - 1, d, 23, 59, 59, 999)
  );

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw badRequest('asOf is not a valid calendar date');
  }

  return date;
}

function fiscalYearStart(asOf) {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();

  const startYear =
    m >= FISCAL_YEAR_START_MONTH ? y : y - 1;

  return new Date(
    Date.UTC(
      startYear,
      FISCAL_YEAR_START_MONTH,
      1,
      0,
      0,
      0,
      0
    )
  );
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);

  return new Date(
    Date.UTC(y, m - 1, 1)
  ).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function money(n) {
  return Number(Number(n || 0).toFixed(2));
}

/* ---------- helpers ---------- */

function dueStatus(purchase, asOf) {
  if (purchase.paymentStatus === 'Paid') {
    return 'Paid';
  }

  const dd = purchase.dueDate
    ? new Date(purchase.dueDate)
    : null;

  if (!dd) {
    return 'Pending';
  }

  if (dd < asOf) {
    return 'Overdue';
  }

  const days =
    (dd - asOf) /
    (1000 * 60 * 60 * 24);

  return days <= 7 ? 'Due' : 'Upcoming';
}

const getAccountingDashboard = async (req, res) => {
  try {
    const asOf = parseAsOfDate(req.query.asOf);
    const fyStart = fiscalYearStart(asOf);

    const paymentMatchToDate = {
      isActive: true,
      status: 'Completed',
      paymentDate: {
        $lte: asOf,
      },
    };

    const paymentMatchPeriod = {
      isActive: true,
      status: 'Completed',
      paymentDate: {
        $gte: fyStart,
        $lte: asOf,
      },
    };

    const expenseMatchToDate = {
      isDeleted: false,
      date: { $lte: asOf },
    };

    const expenseMatchPeriod = {
      isDeleted: false,
      date: { $gte: fyStart, $lte: asOf },
    };

    const purchaseReceivedMatchToDate = {
      isActive: true,
      status: 'Received',
      receivedAt: {
        $lte: asOf,
      },
    };

    // FIX: Draft orders are not real revenue / receivables.
    // Only Confirmed-and-beyond orders count.
    const orderRealStatusFilter = {
      $nin: ['Draft', 'Cancelled'],
    };

    const [
      revenueToDate,
      revenuePeriod,
      revenueByMonth,

      expensesPeriodAgg,
      expensesByMonth,
      unpaidExpenses,
      payablesTotalAgg,
      paidExpensesToDate,

      receivablesAgg,
      periodPayments,
      periodPaidExpenses,
      openOrders,

      openPurchases,
      purchasePayablesTotalAgg,
      periodPurchasePayments,
      purchaseSpendToDate,

      revenueAccrualPeriod,
      periodPurchaseAccrual,
      salaryExpenseAgg,

      // FIX: new — salary cash payments
      salaryPeriodPayments,
      salaryPaymentsToDate,
    ] = await Promise.all([

      Payment.aggregate([
        {
          $match: paymentMatchToDate,
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$amount',
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: paymentMatchPeriod,
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$amount',
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: paymentMatchPeriod,
        },
        {
          $group: {
            _id: {
              y: {
                $year: '$paymentDate',
              },
              m: {
                $month: '$paymentDate',
              },
            },
            total: {
              $sum: '$amount',
            },
          },
        },
        {
          $sort: {
            '_id.y': 1,
            '_id.m': 1,
          },
        },
      ]),

      Expense.aggregate([
        {
          $match: expenseMatchPeriod,
        },
        {
          $group: {
            _id: {
              type: '$type',
              paymentStatus: '$paymentStatus',
            },
            total: {
              $sum: '$amount',
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Expense.aggregate([
        {
          $match: expenseMatchPeriod,
        },
        {
          $group: {
            _id: {
              y: {
                $year: '$date',
              },
              m: {
                $month: '$date',
              },
            },
            total: {
              $sum: '$amount',
            },
          },
        },
        {
          $sort: {
            '_id.y': 1,
            '_id.m': 1,
          },
        },
      ]),

      Expense.find({
        ...expenseMatchToDate,
        paymentStatus: 'Pending',
      })
        .sort({
          date: -1,
        })
        .limit(100)
        .lean(),

      Expense.aggregate([
        {
          $match: {
            ...expenseMatchToDate,
            paymentStatus: 'Pending',
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$amount',
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Expense.aggregate([
        {
          $match: {
            isDeleted: false,
            paymentStatus: 'Paid',
            $or: [
              {
                paidAt: {
                  $lte: asOf,
                },
              },
              {
                paidAt: null,
                date: {
                  $lte: asOf,
                },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$amount',
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      // Receivables — FIX: exclude Draft
      Order.aggregate([
        {
          $match: {
            isActive: true,
            status: orderRealStatusFilter,
            orderDate: {
              $lte: asOf,
            },
          },
        },
        {
          $project: {
            due: {
              $max: [
                0,
                {
                  $subtract: [
                    {
                      $ifNull: [
                        '$grandTotal',
                        0,
                      ],
                    },
                    {
                      $ifNull: [
                        '$amountPaid',
                        0,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$due',
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      Payment.find(paymentMatchPeriod)
        .populate(
          'contact',
          'name company phone email'
        )
        .populate(
          'order',
          'orderNumber grandTotal'
        )
        .sort({
          paymentDate: -1,
        })
        .limit(500)
        .lean(),

      Expense.find({
        isDeleted: false,
        paymentStatus: 'Paid',
        $or: [
          {
            paidAt: {
              $gte: fyStart,
              $lte: asOf,
            },
          },
          {
            paidAt: null,
            date: {
              $gte: fyStart,
              $lte: asOf,
            },
          },
        ],
      })
        .sort({
          paidAt: -1,
          date: -1,
        })
        .limit(500)
        .lean(),

      // Open orders — FIX: exclude Draft
      Order.find({
        isActive: true,
        status: orderRealStatusFilter,
        orderDate: {
          $lte: asOf,
        },
      })
        .populate(
          'contact',
          'name company'
        )
        .select(
          'orderNumber orderDate grandTotal amountPaid paymentStatus contact status'
        )
        .sort({
          orderDate: -1,
        })
        .limit(300)
        .lean(),

      RawPurchase.find({
        isActive: true,
        status: 'Received',
        receivedAt: {
          $lte: asOf,
        },
        paymentStatus: {
          $in: [
            'Pending',
            'Partial',
            'Overdue',
          ],
        },
      })
        .populate(
          'supplier',
          'name company phone'
        )
        .populate(
          'material',
          'name category sizeKg unit'
        )
        .sort({
          dueDate: 1,
          receivedAt: -1,
        })
        .limit(200)
        .lean(),

      RawPurchase.aggregate([
        {
          $match: purchaseReceivedMatchToDate,
        },
        {
          $project: {
            due: {
              $max: [
                0,
                {
                  $subtract: [
                    {
                      $ifNull: [
                        '$totalAmount',
                        0,
                      ],
                    },
                    {
                      $ifNull: [
                        '$amountPaid',
                        0,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$due',
            },
            count: {
              $sum: 1,
            },
          },
        },
      ]),

      RawPurchase.aggregate([
        {
          $match: {
            isActive: true,
            status: 'Received',
          },
        },
        {
          $unwind: '$payments',
        },
        {
          $match: {
            'payments.paidAt': {
              $gte: fyStart,
              $lte: asOf,
            },
          },
        },
        {
          $project: {
            _id: '$payments._id',
            purchaseId: '$_id',
            purchaseNumber: '$purchaseNumber',

            supplier: '$supplierName',
            supplierRef: '$supplier',

            amount: '$payments.amount',
            paidAt: '$payments.paidAt',

            method: '$payments.method',
            transactionId:
              '$payments.transactionId',

            chequeNumber:
              '$payments.chequeNumber',

            bankName:
              '$payments.bankName',

            invoiceNumber:
              '$invoiceNumber',

            notes:
              '$payments.notes',
          },
        },
        {
          $sort: {
            paidAt: -1,
          },
        },
        {
          $limit: 500,
        },
      ]),

      RawPurchase.aggregate([
        {
          $match: purchaseReceivedMatchToDate,
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$amountPaid',
            },
          },
        },
      ]),

      // Revenue accrual — FIX: exclude Draft
      Order.aggregate([
        {
          $match: {
            isActive: true,
            status: orderRealStatusFilter,
            orderDate: { $gte: fyStart, $lte: asOf },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
      ]),

      RawPurchase.aggregate([
        {
          $match: {
            isActive: true,
            status: 'Received',
            receivedAt: { $gte: fyStart, $lte: asOf },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Salary expense — accrued in FY
      Salary.aggregate([
        {
          $match: {
            isDeleted: false,
            periodEnd: { $gte: fyStart, $lte: asOf },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$netSalary' },
            count: { $sum: 1 },
          },
        },
      ]),

      // FIX: salary cash payments in period
      Salary.aggregate([
        { $match: { isDeleted: false } },
        { $unwind: '$payments' },
        {
          $match: {
            'payments.paymentDate': {
              $gte: fyStart,
              $lte: asOf,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$payments.amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // FIX: salary cash payments all-time (up to asOf)
      Salary.aggregate([
        { $match: { isDeleted: false } },
        { $unwind: '$payments' },
        {
          $match: {
            'payments.paymentDate': { $lte: asOf },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$payments.amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);


    const totalRevenueAllTime =
      money(revenueToDate[0]?.total);

    const totalRevenuePeriod =
      money(revenuePeriod[0]?.total);

    const paymentCountPeriod =
      revenuePeriod[0]?.count || 0;

    const expenseByType = {
      'Factory Expense': 0,
      Miscellaneous: 0,
    };

    let totalExpensesPeriod = 0;
    let totalPaidExpensesPeriod = 0;
    let totalPendingExpensesPeriod = 0;

    for (const row of expensesPeriodAgg) {
      const type = row._id.type;
      const status = row._id.paymentStatus;

      const amount = money(row.total);

      if (expenseByType[type] !== undefined) {
        expenseByType[type] += amount;
      }

      totalExpensesPeriod += amount;

      if (status === 'Paid') {
        totalPaidExpensesPeriod += amount;
      } else {
        totalPendingExpensesPeriod += amount;
      }
    }

    const cashOutExpensesAllTime =
      money(paidExpensesToDate[0]?.total);

    const cashOutSupplierAllTime =
      money(purchaseSpendToDate[0]?.total);

    // FIX: include salary cash out
    const cashOutSalaryAllTime =
      money(salaryPaymentsToDate[0]?.total);

    const cashOutAllTime = money(
      cashOutExpensesAllTime +
      cashOutSupplierAllTime +
      cashOutSalaryAllTime
    );

    const accountsReceivable =
      money(receivablesAgg[0]?.total);

    const netCashPosition = money(
      totalRevenueAllTime -
      cashOutAllTime
    );

    const expensePayables = unpaidExpenses.map(
      (expense) => {
        let supplier =
          expense.vendor ||
          expense.expenseName ||
          expense.expenseCategory ||
          expense.type ||
          '—';

        let invoice =
          expense.invoiceNumber ||
          expense.expenseType ||
          expense.expenseName ||
          expense.type ||
          '—';

        if (expense.type === 'Factory Expense') {
          supplier =
            expense.vendor ||
            'Factory vendor';

          invoice =
            expense.invoiceNumber ||
            expense.expenseType ||
            'Factory expense';
        }

        if (expense.type === 'Miscellaneous') {
          supplier =
            expense.expenseName ||
            expense.expenseCategory ||
            'Miscellaneous';

          invoice =
            expense.invoiceNumber ||
            expense.expenseCategory ||
            'Misc';
        }

        const dueDate =
          expense.date
            ? new Date(expense.date)
            : asOf;

        let status = 'Pending';

        if (dueDate < asOf) {
          status = 'Overdue';
        } else {
          const days =
            (dueDate - asOf) /
            (1000 * 60 * 60 * 24);

          status =
            days <= 7
              ? 'Due'
              : 'Upcoming';
        }

        return {
          id: expense._id,

          supplier,
          invoice,

          type: expense.type,
          source: 'Expense',

          createdDate: expense.date,
          dueDate,

          amount: money(expense.amount),
          amountPaid: 0,

          balanceDue:
            money(expense.amount),

          status,
          paymentStatus:
            expense.paymentStatus,

          description:
            expense.description ||
            expense.notes ||
            '',
        };
      }
    );

    const purchasePayables =
      openPurchases.map((purchase) => {
        const total =
          money(purchase.totalAmount);

        const paid =
          money(purchase.amountPaid);

        const due = money(
          Math.max(0, total - paid)
        );

        const supplierName =
          purchase.supplier?.company ||
          purchase.supplier?.name ||
          purchase.supplierName ||
          'Unknown supplier';

        const materialLabel =
          purchase.material?.name ||
          'Material';

        return {
          id: purchase._id,

          supplier: supplierName,

          invoice:
            purchase.invoiceNumber ||
            purchase.purchaseNumber ||
            '—',

          type: 'Raw Material',
          source: 'Purchase',

          createdDate:
            purchase.receivedAt ||
            purchase.orderedAt,

          dueDate:
            purchase.dueDate ||
            purchase.receivedAt ||
            purchase.orderedAt,

          amount: total,
          amountPaid: paid,
          balanceDue: due,

          status:
            dueStatus(
              purchase,
              asOf
            ),

          paymentStatus:
            purchase.paymentStatus,

          description:
            `${materialLabel} · ${purchase.quantity} ${purchase.unit}`,

          purchaseNumber:
            purchase.purchaseNumber,

          supplierPhone:
            purchase.supplier?.phone ||
            purchase.supplierPhone ||
            '',
        };
      });

    const payables = [
      ...purchasePayables,
      ...expensePayables,
    ];

    const totalExpensePayables =
      money(
        payablesTotalAgg[0]?.total || 0
      );

    const totalPurchasePayables =
      money(
        purchasePayablesTotalAgg[0]?.total || 0
      );

    const totalPayables = money(
      totalExpensePayables +
      totalPurchasePayables
    );

    const monthMap = {};

    for (const row of revenueByMonth) {
      const key =
        `${row._id.y}-${String(
          row._id.m
        ).padStart(2, '0')}`;

      if (!monthMap[key]) {
        monthMap[key] = {
          month: monthLabel(key),
          revenue: 0,
          expenses: 0,
        };
      }

      monthMap[key].revenue =
        money(row.total);
    }

    for (const row of expensesByMonth) {
      const key =
        `${row._id.y}-${String(
          row._id.m
        ).padStart(2, '0')}`;

      if (!monthMap[key]) {
        monthMap[key] = {
          month: monthLabel(key),
          revenue: 0,
          expenses: 0,
        };
      }

      monthMap[key].expenses +=
        money(row.total);
    }

    for (const payment of periodPurchasePayments) {
      const date =
        new Date(payment.paidAt);

      const key =
        `${date.getUTCFullYear()}-${String(
          date.getUTCMonth() + 1
        ).padStart(2, '0')}`;

      if (!monthMap[key]) {
        monthMap[key] = {
          month: monthLabel(key),
          revenue: 0,
          expenses: 0,
        };
      }

      monthMap[key].expenses +=
        money(payment.amount);
    }

    const monthlyData =
      Object.keys(monthMap)
        .sort()
        .map((key) => ({
          ...monthMap[key],
          netProfit: money(
            monthMap[key].revenue -
            monthMap[key].expenses
          ),
        }));

    const periodPurchaseSpend =
      money(
        periodPurchasePayments.reduce(
          (sum, payment) =>
            sum +
            Number(payment.amount || 0),
          0
        )
      );

    const accrualRevenue = money(
      revenueAccrualPeriod[0]?.total || 0
    );

    const accrualRawMaterial = money(
      periodPurchaseAccrual[0]?.total || 0
    );

    // FIX: use the real salary aggregation for both P&L and chart
    const accrualSalaries = money(
      salaryExpenseAgg[0]?.total || 0
    );

    const salaryExpenseForChart = accrualSalaries;

    const factoryExpenseTotal = money(
      expenseByType['Factory Expense']
    );

    const miscExpenseTotal = money(
      expenseByType['Miscellaneous']
    );

    const totalAccrualExpenses = money(
      accrualRawMaterial +
        factoryExpenseTotal +
        miscExpenseTotal +
        accrualSalaries
    );

    const netProfit = money(
      accrualRevenue - totalAccrualExpenses
    );

    const totalExpensesPeriodWithMaterials = money(
      totalExpensesPeriod + periodPurchaseSpend
    );

    // FIX: salary cash out in period
    const periodSalaryPaymentsTotal = money(
      salaryPeriodPayments[0]?.total || 0
    );
    const periodSalaryPaymentsCount =
      salaryPeriodPayments[0]?.count || 0;

    const accountGroups = [
      {
        name: 'Assets',
        code: '1000',

        accounts: [
          {
            name: 'Cash & Bank (derived)',
            code: '1001',
            balance:
              Math.max(
                0,
                netCashPosition
              ),
            note:
              'Completed customer payments − paid expenses − supplier payments − salary payments',
          },

          {
            name: 'Accounts Receivable',
            code: '1003',
            balance:
              accountsReceivable,
            note:
              'Unpaid balance on active (non-draft) orders',
          },
        ],
      },

      {
        name: 'Liabilities',
        code: '2000',

        accounts: [
          {
            name:
              'Accounts Payable — Suppliers',
            code: '2001',
            balance:
              totalPurchasePayables,
            note:
              'Unpaid received raw-material purchases',
          },

          {
            name:
              'Accounts Payable — Operations',
            code: '2002',
            balance:
              totalExpensePayables,
            note:
              'Unpaid factory and miscellaneous expenses',
          },
        ],
      },

      {
        name: 'Equity',
        code: '3000',

        accounts: [
          {
            name:
              'Retained earnings (period)',
            code: '3001',
            balance: netProfit,
            note:
              'Period revenue − period expenses',
          },
        ],
      },

      {
        name: 'Income',
        code: '4000',

        accounts: [
          {
            name: 'Sales Revenue',
            code: '4001',
            balance:
              totalRevenuePeriod,
            note:
              'Completed customer payments in period',
          },
        ],
      },

      {
        name: 'Expenses',
        code: '5000',

        accounts: [
          {
            name: 'Factory expenses',
            code: '5003',
            balance:
              money(
                expenseByType[
                  'Factory Expense'
                ]
              ),
            note:
              'Vendor / factory costs',
          },

          {
            name: 'Miscellaneous',
            code: '5004',
            balance:
              money(
                expenseByType[
                  'Miscellaneous'
                ]
              ),
            note:
              'Other miscellaneous spending',
          },

          {
            name:
              'Raw material purchases',
            code: '5005',
            balance:
              accrualRawMaterial,
            note:
              'Raw material received in period',
          },

          {
            name: 'Salaries & Wages',
            code: '5006',
            balance:
              salaryExpenseForChart,
            note:
              'Salary accrued in period',
          },
        ],
      },
    ];

    const customerPaymentRows =
      periodPayments.map((payment) => ({
        id: payment._id,

        paymentNumber:
          payment.paymentNumber || '',

        date:
          payment.paymentDate,

        customer:
          payment.contact?.company ||
          payment.contact?.name ||
          'Unknown customer',

        contactName:
          payment.contact?.name ||
          '',

        orderNumber:
          payment.order?.orderNumber ||
          '',

        amount:
          money(payment.amount),

        currency:
          payment.currency ||
          'INR',

        paymentMode:
          payment.paymentMode ||
          '',

        transactionId:
          payment.transactionId ||
          '',

        status:
          payment.status ||
          'Completed',

        notes:
          payment.notes ||
          '',
      }));

    const expensePaymentRows =
      periodPaidExpenses.map(
        (expense) => ({
          id: expense._id,

          date:
            expense.paidAt ||
            expense.date,

          payee:
            expense.vendor ||
            expense.expenseName ||
            expense.expenseType ||
            expense.expenseCategory ||
            expense.type ||
            'Expense',

          type:
            expense.type,

          amount:
            money(expense.amount),

          paymentMethod:
            expense.paymentMethod ||
            '',

          transactionId:
            expense.transactionId ||
            '',

          invoiceNumber:
            expense.invoiceNumber ||
            '',

          description:
            expense.description ||
            expense.notes ||
            '',
        })
      );

    const supplierPaymentRows =
      periodPurchasePayments.map(
        (payment) => ({
          id: payment._id,

          date:
            payment.paidAt,

          payee:
            payment.supplier ||
            'Unknown supplier',

          type:
            'Raw Material',

          amount:
            money(payment.amount),

          paymentMethod:
            payment.method ||
            '',

          transactionId:
            payment.transactionId ||
            '',

          chequeNumber:
            payment.chequeNumber ||
            '',

          bankName:
            payment.bankName ||
            '',

          invoiceNumber:
            payment.invoiceNumber ||
            '',

          purchaseNumber:
            payment.purchaseNumber ||
            '',

          description:
            payment.notes ||
            '',
        })
      );

    const receivableRows =
      openOrders
        .map((order) => {
          const due = money(
            Math.max(
              0,
              Number(
                order.grandTotal || 0
              ) -
                Number(
                  order.amountPaid || 0
                )
            )
          );

          return {
            id: order._id,

            orderNumber:
              order.orderNumber ||
              '',

            date:
              order.orderDate,

            customer:
              order.contact?.company ||
              order.contact?.name ||
              'Unknown',

            contactName:
              order.contact?.name ||
              '',

            grandTotal:
              money(
                order.grandTotal
              ),

            amountPaid:
              money(
                order.amountPaid
              ),

            balanceDue:
              due,

            paymentStatus:
              order.paymentStatus ||
              'Pending',

            status:
              order.status ||
              '',
          };
        })
        .filter(
          (row) =>
            row.balanceDue > 0.009
        );

    const cashBalance = money(
      Math.max(
        0,
        netCashPosition
      )
    );

    const totalAssets = money(
      cashBalance +
      accountsReceivable
    );

    const totalLiabilities =
      totalPayables;

    const totalEquity = money(
      totalAssets -
      totalLiabilities
    );

    const balanceSheet = {
      assets: [
        {
          name:
            'Cash & Bank (derived)',
          code: '1001',

          balance:
            cashBalance,

          note:
            'All completed customer payments − paid expenses − supplier payments − salary payments',

          breakdown: {
            totalCollections:
              totalRevenueAllTime,

            totalPaidExpenses:
              money(
                cashOutExpensesAllTime
              ),

            totalSupplierPayments:
              money(
                cashOutSupplierAllTime
              ),

            // FIX: new
            totalSalaryPayments:
              money(
                cashOutSalaryAllTime
              ),

            net:
              cashBalance,
          },
        },

        {
          name:
            'Accounts Receivable',

          code: '1003',

          balance:
            accountsReceivable,

          note:
            'Outstanding on active (non-draft) orders',
        },
      ],

      liabilities: [
        {
          name:
            'Accounts Payable — Suppliers',

          code: '2001',

          balance:
            totalPurchasePayables,

          note:
            'Unpaid received raw-material purchases',
        },

        {
          name:
            'Accounts Payable — Operations',

          code: '2002',

          balance:
            totalExpensePayables,

          note:
            'Unpaid factory and miscellaneous expenses',
        },
      ],

      equity: [
        {
          name:
            'Net position / retained',

          code: '3001',

          balance:
            totalEquity,

          note:
            'Assets − liabilities (derived)',
        },
      ],

      totals: {
        assets:
          totalAssets,

        liabilities:
          totalLiabilities,

        equity:
          totalEquity,
      },

      cashMovements: {
        collections:
          customerPaymentRows,

        collectionsAllTime:
          totalRevenueAllTime,

        paidExpenses:
          expensePaymentRows,

        paidExpensesAllTime:
          money(
            cashOutExpensesAllTime
          ),

        supplierPayments:
          supplierPaymentRows,

        supplierPaymentsAllTime:
          money(
            cashOutSupplierAllTime
          ),

        // FIX: new — salary cash movements all-time total
        salaryPaymentsAllTime:
          money(
            cashOutSalaryAllTime
          ),

        net:
          cashBalance,
      },

      receivables:
        receivableRows,

      payablesDetail:
        payables,
    };

    const cashFlow = {
      summary: [
        {
          category:
            'Operating Activities',

          items: [
            {
              label:
                'Customer payments',

              amount:
                totalRevenuePeriod,

              count:
                paymentCountPeriod,
            },

            {
              label:
                'Expense payments',

              amount:
                money(
                  -totalPaidExpensesPeriod
                ),

              count:
                expensePaymentRows.length,
            },

            {
              label:
                'Supplier payments (raw materials)',

              amount:
                money(
                  -periodPurchaseSpend
                ),

              count:
                supplierPaymentRows.length,
            },

            // FIX: new — salary payments
            {
              label:
                'Salary payments',

              amount:
                money(
                  -periodSalaryPaymentsTotal
                ),

              count:
                periodSalaryPaymentsCount,
            },
          ],

          total:
            money(
              totalRevenuePeriod -
                totalPaidExpensesPeriod -
                periodPurchaseSpend -
                periodSalaryPaymentsTotal
            ),
        },
      ],

      customerPayments:
        customerPaymentRows,

      expensePayments:
        expensePaymentRows,

      supplierPayments:
        supplierPaymentRows,

      totals: {
        customerPayments:
          totalRevenuePeriod,

        expensePayments:
          money(
            totalPaidExpensesPeriod
          ),

        supplierPayments:
          periodPurchaseSpend,

        // FIX: new
        salaryPayments:
          periodSalaryPaymentsTotal,

        net:
          money(
            totalRevenuePeriod -
              totalPaidExpensesPeriod -
              periodPurchaseSpend -
              periodSalaryPaymentsTotal
          ),
      },
    };

    const recentActivity = {
      payments:
        customerPaymentRows
          .slice(0, 8)
          .map((payment) => ({
            id: payment.id,

            date: payment.date,

            label:
              payment.customer,

            sub:
              payment.orderNumber ||
              payment.paymentNumber ||
              payment.paymentMode,

            amount:
              payment.amount,

            direction:
              'in',
          })),

      expenses:
        expensePaymentRows
          .slice(0, 8)
          .map((expense) => ({
            id: expense.id,

            date: expense.date,

            label:
              expense.payee,

            sub:
              expense.type,

            amount:
              expense.amount,

            direction:
              'out',
          })),

      supplierPayments:
        supplierPaymentRows
          .slice(0, 8)
          .map((payment) => ({
            id: payment.id,

            date: payment.date,

            label:
              payment.payee,

            sub:
              payment.purchaseNumber ||
              payment.invoiceNumber ||
              'Raw material',

            amount:
              payment.amount,

            direction:
              'out',
          })),
    };

    return res.status(200).json({
      success: true,

      meta: {
        asOf:
          asOf
            .toISOString()
            .slice(0, 10),

        fiscalYearStart:
          fyStart
            .toISOString()
            .slice(0, 10),

        note:
          'Derived from Payments, Expenses, Orders, and Raw Material Purchases. Cash & equity are approximate without opening balances.',
      },

      overview: {
        totalAssets,

        totalLiabilities,

        totalEquity,

        netRevenue: accrualRevenue,

        totalExpenses: totalAccrualExpenses,

        netProfit,

        totalPayables,

        totalPurchasePayables,

        totalExpensePayables,

        accountsReceivable,

        netCashPosition,

        cashInAllTime:
          totalRevenueAllTime,

        cashOutAllTime:
          cashOutAllTime,
      },

      profitLoss: {
        salesRevenue: accrualRevenue,
        otherRevenue: 0,
        totalRevenue: accrualRevenue,

        expensesByType: {
          'Factory Expense': factoryExpenseTotal,
          Miscellaneous: miscExpenseTotal,
          'Raw Material': accrualRawMaterial,
          Salaries: accrualSalaries,
        },

        employeeCosts: accrualSalaries,
        factoryWages: 0,
        factoryExpenses: factoryExpenseTotal,
        miscellaneous: miscExpenseTotal,
        rawMaterialPurchases: accrualRawMaterial,

        totalExpenses: totalAccrualExpenses,

        totalPaidExpenses: money(totalPaidExpensesPeriod),
        totalPendingExpenses: money(totalPendingExpensesPeriod),

        netProfit,

        monthlyData,
      },

      payables,

      accountGroups,

      balanceSheet,

      cashFlow,

      recentActivity,
    });
  } catch (error) {
    console.error(
      '\n========================================'
    );

    console.error(
      'ACCOUNTING DASHBOARD ERROR'
    );

    console.error(
      'Name:',
      error?.name
    );

    console.error(
      'Message:',
      error?.message
    );

    console.error(
      'Code:',
      error?.code
    );

    console.error(
      'Stack:',
      error?.stack
    );

    console.error(
      '========================================\n'
    );

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to load accounting dashboard',
    });
  }
};

module.exports = {
  getAccountingDashboard,
};