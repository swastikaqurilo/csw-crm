'use strict';

const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Order = require('../models/Order');

const FISCAL_YEAR_START_MONTH = 3; // April = index 3 (0-based)

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseAsOfDate(value) {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest('asOf must be YYYY-MM-DD');
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

function fiscalYearStart(asOf) {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();
  const startYear = m >= FISCAL_YEAR_START_MONTH ? y : y - 1;
  return new Date(Date.UTC(startYear, FISCAL_YEAR_START_MONTH, 1, 0, 0, 0, 0));
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function money(n) {
  return Number(Number(n || 0).toFixed(2));
}

const getAccountingDashboard = async (req, res) => {
  try {
    const asOf = parseAsOfDate(req.query.asOf);
    const fyStart = fiscalYearStart(asOf);

    const paymentMatchToDate = {
      isActive: true,
      status: 'Completed',
      paymentDate: { $lte: asOf },
    };

    const paymentMatchPeriod = {
      ...paymentMatchToDate,
      paymentDate: { $gte: fyStart, $lte: asOf },
    };

    const expenseMatchToDate = {
      date: { $lte: asOf },
    };

    const expenseMatchPeriod = {
      date: { $gte: fyStart, $lte: asOf },
    };

    const [
      revenueToDate,
      revenuePeriod,
      revenueByMonth,
      expensesPeriodAgg,
      expensesByMonth,
      unpaidExpenses,
      paidExpensesToDate,
      receivablesAgg,
      periodPayments,
      periodPaidExpenses,
      openOrders,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: paymentMatchToDate },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: paymentMatchPeriod },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: paymentMatchPeriod },
        {
          $group: {
            _id: { y: { $year: '$paymentDate' }, m: { $month: '$paymentDate' } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      Expense.aggregate([
        { $match: expenseMatchPeriod },
        {
          $group: {
            _id: { type: '$type', paymentStatus: '$paymentStatus' },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: expenseMatchPeriod },
        {
          $group: {
            _id: { y: { $year: '$date' }, m: { $month: '$date' } },
            total: { $sum: '$amount' },
            paid: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$amount', 0] },
            },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      Expense.find({ ...expenseMatchToDate, paymentStatus: 'Pending' })
        .populate('person', 'name type')
        .sort({ date: -1 })
        .limit(100)
        .lean(),
      Expense.aggregate([
        {
          $match: {
            paymentStatus: 'Paid',
            $or: [
              { paidAt: { $lte: asOf } },
              { paidAt: null, date: { $lte: asOf } },
            ],
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            isActive: true,
            status: { $ne: 'Cancelled' },
            orderDate: { $lte: asOf },
          },
        },
        {
          $project: {
            due: {
              $max: [
                0,
                { $subtract: [{ $ifNull: ['$grandTotal', 0] }, { $ifNull: ['$amountPaid', 0] }] },
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: '$due' }, count: { $sum: 1 } } },
      ]),
      Payment.find(paymentMatchPeriod)
        .populate('contact', 'name company phone email')
        .populate('order', 'orderNumber grandTotal')
        .sort({ paymentDate: -1 })
        .limit(500)
        .lean(),
      Expense.find({
        paymentStatus: 'Paid',
        $or: [
          { paidAt: { $gte: fyStart, $lte: asOf } },
          { paidAt: null, date: { $gte: fyStart, $lte: asOf } },
        ],
      })
        .populate('person', 'name type')
        .sort({ paidAt: -1, date: -1 })
        .limit(500)
        .lean(),
      Order.find({
        isActive: true,
        status: { $ne: 'Cancelled' },
        orderDate: { $lte: asOf },
      })
        .populate('contact', 'name company')
        .select('orderNumber orderDate grandTotal amountPaid paymentStatus contact status')
        .sort({ orderDate: -1 })
        .limit(300)
        .lean(),
    ]);

    const totalRevenueAllTime = money(revenueToDate[0]?.total);
    const totalRevenuePeriod = money(revenuePeriod[0]?.total);
    const paymentCountPeriod = revenuePeriod[0]?.count || 0;

    let expenseByType = {
      Employee: 0,
      'Factory People': 0,
      'Factory Expense': 0,
      Miscellaneous: 0,
    };
    let totalExpensesPeriod = 0;
    let totalPaidExpensesPeriod = 0;
    let totalPendingExpensesPeriod = 0;

    for (const row of expensesPeriodAgg) {
      const t = row._id.type;
      const status = row._id.paymentStatus;
      const amt = money(row.total);
      if (expenseByType[t] !== undefined) expenseByType[t] += amt;
      totalExpensesPeriod += amt;
      if (status === 'Paid') totalPaidExpensesPeriod += amt;
      else totalPendingExpensesPeriod += amt;
    }

    const cashOutAllTime = money(paidExpensesToDate[0]?.total);
    const accountsReceivable = money(receivablesAgg[0]?.total);
    const netCashPosition = money(totalRevenueAllTime - cashOutAllTime);

    const payables = unpaidExpenses.map((e) => {
      let supplier = '—';
      let invoice = e.invoiceNumber || e.expenseName || e.expenseType || e.type;
      if (e.type === 'Employee' || e.type === 'Factory People') {
        supplier = e.person?.name || e.type;
        invoice = e.description || e.type;
      } else if (e.type === 'Factory Expense') {
        supplier = e.vendor || 'Factory vendor';
        invoice = e.invoiceNumber || e.expenseType || 'Factory expense';
      } else {
        supplier = e.expenseName || e.expenseCategory || 'Miscellaneous';
        invoice = e.invoiceNumber || e.expenseCategory || 'Misc';
      }

      const dueDate = e.date;
      const selected = asOf;
      let status = 'Pending';
      if (dueDate < selected) status = 'Overdue';
      else {
        const days = (dueDate - selected) / (1000 * 60 * 60 * 24);
        if (days <= 7) status = 'Due';
        else status = 'Upcoming';
      }

      return {
        id: e._id,
        supplier,
        invoice,
        type: e.type,
        createdDate: e.date,
        dueDate: e.date,
        amount: money(e.amount),
        status,
        paymentStatus: e.paymentStatus,
        description: e.description || e.notes || '',
      };
    });

    const totalPayables = money(payables.reduce((s, p) => s + p.amount, 0));

    const monthMap = {};
    for (const row of revenueByMonth) {
      const key = `${row._id.y}-${String(row._id.m).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { month: monthLabel(key), revenue: 0, expenses: 0 };
      monthMap[key].revenue = money(row.total);
    }
    for (const row of expensesByMonth) {
      const key = `${row._id.y}-${String(row._id.m).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { month: monthLabel(key), revenue: 0, expenses: 0 };
      monthMap[key].expenses = money(row.total);
    }
    const monthlyData = Object.keys(monthMap)
      .sort()
      .map((k) => ({
        ...monthMap[k],
        netProfit: money(monthMap[k].revenue - monthMap[k].expenses),
      }));

    const netProfit = money(totalRevenuePeriod - totalExpensesPeriod);

    const accountGroups = [
      {
        name: 'Assets',
        code: '1000',
        accounts: [
          {
            name: 'Cash & Bank (derived)',
            code: '1001',
            balance: Math.max(0, netCashPosition),
            note: 'Completed payments − paid expenses (no opening balance)',
          },
          {
            name: 'Accounts Receivable',
            code: '1003',
            balance: accountsReceivable,
            note: 'Unpaid balance on active orders',
          },
        ],
      },
      {
        name: 'Liabilities',
        code: '2000',
        accounts: [
          {
            name: 'Accounts Payable',
            code: '2001',
            balance: totalPayables,
            note: 'Unpaid expenses',
          },
        ],
      },
      {
        name: 'Equity',
        code: '3000',
        accounts: [
          {
            name: 'Retained earnings (period)',
            code: '3001',
            balance: netProfit,
            note: 'Period revenue − period expenses',
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
            balance: totalRevenuePeriod,
            note: 'Completed customer payments in period',
          },
        ],
      },
      {
        name: 'Expenses',
        code: '5000',
        accounts: [
          { name: 'Employee costs', code: '5001', balance: money(expenseByType.Employee), note: 'Salaries' },
          { name: 'Factory wages', code: '5002', balance: money(expenseByType['Factory People']), note: 'Daily wages' },
          { name: 'Factory expenses', code: '5003', balance: money(expenseByType['Factory Expense']), note: 'Vendor / factory costs' },
          { name: 'Miscellaneous', code: '5004', balance: money(expenseByType.Miscellaneous), note: 'Other spend' },
        ],
      },
    ];

    const customerPaymentRows = periodPayments.map((p) => ({
      id: p._id,
      paymentNumber: p.paymentNumber || '',
      date: p.paymentDate,
      customer: p.contact?.company || p.contact?.name || 'Unknown customer',
      contactName: p.contact?.name || '',
      orderNumber: p.order?.orderNumber || '',
      amount: money(p.amount),
      currency: p.currency || 'INR',
      paymentMode: p.paymentMode || '',
      transactionId: p.transactionId || '',
      status: p.status || 'Completed',
      notes: p.notes || '',
    }));

    const expensePaymentRows = periodPaidExpenses.map((e) => ({
      id: e._id,
      date: e.paidAt || e.date,
      payee: e.person?.name || e.vendor || e.expenseName || e.expenseType || e.type,
      type: e.type,
      amount: money(e.amount),
      paymentMethod: e.paymentMethod || '',
      transactionId: e.transactionId || '',
      invoiceNumber: e.invoiceNumber || '',
      description: e.description || e.notes || '',
    }));

    const receivableRows = openOrders
      .map((o) => {
        const due = money(Math.max(0, Number(o.grandTotal || 0) - Number(o.amountPaid || 0)));
        return {
          id: o._id,
          orderNumber: o.orderNumber || '',
          date: o.orderDate,
          customer: o.contact?.company || o.contact?.name || 'Unknown',
          contactName: o.contact?.name || '',
          grandTotal: money(o.grandTotal),
          amountPaid: money(o.amountPaid),
          balanceDue: due,
          paymentStatus: o.paymentStatus || 'Pending',
          status: o.status || '',
        };
      })
      .filter((r) => r.balanceDue > 0.009);

    const cashBalance = money(Math.max(0, netCashPosition));
    const totalAssets = money(cashBalance + accountsReceivable);
    const totalLiabilities = totalPayables;
    const totalEquity = money(totalAssets - totalLiabilities);

    const balanceSheet = {
      assets: [
        {
          name: 'Cash & Bank (derived)',
          code: '1001',
          balance: cashBalance,
          note: 'All completed payments − all paid expenses (no opening balance)',
          breakdown: {
            totalCollections: totalRevenueAllTime,
            totalPaidExpenses: cashOutAllTime,
            net: cashBalance,
          },
        },
        {
          name: 'Accounts Receivable',
          code: '1003',
          balance: accountsReceivable,
          note: 'Outstanding on active orders (grand total − amount paid)',
        },
      ],
      liabilities: [
        {
          name: 'Accounts Payable',
          code: '2001',
          balance: totalPayables,
          note: 'Unpaid expenses (salaries, factory, misc)',
        },
      ],
      equity: [
        {
          name: 'Net position / retained',
          code: '3001',
          balance: totalEquity,
          note: 'Assets − liabilities (derived)',
        },
      ],
      totals: { assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity },
      cashMovements: {
        collections: customerPaymentRows,
        collectionsAllTime: totalRevenueAllTime,
        paidExpenses: expensePaymentRows,
        paidExpensesAllTime: cashOutAllTime,
        net: cashBalance,
      },
      receivables: receivableRows,
      payablesDetail: payables,
    };

    const cashFlow = {
      summary: [
        {
          category: 'Operating Activities',
          items: [
            { label: 'Customer payments', amount: totalRevenuePeriod, count: paymentCountPeriod },
            { label: 'Expense payments', amount: money(-totalPaidExpensesPeriod), count: expensePaymentRows.length },
          ],
          total: money(totalRevenuePeriod - totalPaidExpensesPeriod),
        },
      ],
      customerPayments: customerPaymentRows,
      expensePayments: expensePaymentRows,
      totals: {
        customerPayments: totalRevenuePeriod,
        expensePayments: money(totalPaidExpensesPeriod),
        net: money(totalRevenuePeriod - totalPaidExpensesPeriod),
      },
    };

    const recentActivity = {
      payments: customerPaymentRows.slice(0, 8).map((p) => ({
        id: p.id,
        date: p.date,
        label: p.customer,
        sub: p.orderNumber || p.paymentNumber || p.paymentMode,
        amount: p.amount,
        direction: 'in',
      })),
      expenses: expensePaymentRows.slice(0, 8).map((e) => ({
        id: e.id,
        date: e.date,
        label: e.payee,
        sub: e.type,
        amount: e.amount,
        direction: 'out',
      })),
    };

    res.status(200).json({
      success: true,
      meta: {
        asOf: asOf.toISOString().slice(0, 10),
        fiscalYearStart: fyStart.toISOString().slice(0, 10),
        note:
          'Derived from Payments, Expenses, and Orders. Cash & equity are approximate without opening balances or a full ledger.',
      },
      overview: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        netRevenue: totalRevenuePeriod,
        totalExpenses: money(totalExpensesPeriod),
        netProfit,
        totalPayables,
        accountsReceivable,
        netCashPosition,
        cashInAllTime: totalRevenueAllTime,
        cashOutAllTime,
      },
      profitLoss: {
        salesRevenue: totalRevenuePeriod,
        otherRevenue: 0,
        totalRevenue: totalRevenuePeriod,
        expensesByType: expenseByType,
        employeeCosts: money(expenseByType.Employee),
        factoryWages: money(expenseByType['Factory People']),
        factoryExpenses: money(expenseByType['Factory Expense']),
        miscellaneous: money(expenseByType.Miscellaneous),
        totalExpenses: money(totalExpensesPeriod),
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
    console.error('Accounting dashboard error:', error);
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to load accounting dashboard',
    });
  }
};

module.exports = {
  getAccountingDashboard,
};