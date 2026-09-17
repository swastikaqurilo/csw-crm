'use strict';

const Payment = require('../models/Payment');

const UTC_OFFSET_MINUTES = Number(process.env.REVENUE_UTC_OFFSET_MINUTES ?? 330);
if (!Number.isInteger(UTC_OFFSET_MINUTES) || UTC_OFFSET_MINUTES < -720 || UTC_OFFSET_MINUTES > 840) {
  throw new Error('Invalid REVENUE_UTC_OFFSET_MINUTES');
}
const OFFSET_MS = UTC_OFFSET_MINUTES * 60_000;
const TIMEZONE = `${UTC_OFFSET_MINUTES < 0 ? '-' : '+'}${String(Math.floor(Math.abs(UTC_OFFSET_MINUTES) / 60)).padStart(2, '0')}:${String(Math.abs(UTC_OFFSET_MINUTES) % 60).padStart(2, '0')}`;
const RECENT_LIMIT = 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DECIMAL_AMOUNT = { $convert: { input: '$amount', to: 'decimal' } };

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function integerParam(value, fallback, min, max, name) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw badRequest(`Invalid ${name}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw badRequest(`${name} must be between ${min} and ${max}`);
  }
  return number;
}

function textParam(value, fallback, name) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw badRequest(`Invalid ${name}`);
  return value;
}

function localDate(year, monthIndex, day = 1) {
  return new Date(Date.UTC(year, monthIndex, day) - OFFSET_MS);
}

function localKey(date, daily = false) {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, daily ? 10 : 7);
}

function previousYear(date) {
  const local = new Date(date.getTime() + OFFSET_MS);
  const year = local.getUTCFullYear() - 1;
  const month = local.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  local.setUTCFullYear(year, month, Math.min(local.getUTCDate(), lastDay));
  return new Date(local.getTime() - OFFSET_MS);
}

function buildScope(query, now = new Date()) {
  const businessNow = new Date(now.getTime() + OFFSET_MS);
  const currentMonth = businessNow.getUTCMonth() + 1;
  const currentFiscalYear = businessNow.getUTCFullYear() - (currentMonth < 4 ? 1 : 0);
  const period = textParam(query.period, 'fy', 'period');
  if (!['fy', 'month', 'quarter'].includes(period)) throw badRequest('period must be fy, month, or quarter');
  const fiscalYear = integerParam(query.fiscalYear, currentFiscalYear, 2000, 9997, 'fiscalYear');
  const month = integerParam(query.month, currentMonth, 1, 12, 'month');
  const quarter = integerParam(query.quarter, Math.floor(((currentMonth + 8) % 12) / 3) + 1, 1, 4, 'quarter');
  const currency = textParam(query.currency, 'INR', 'currency').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw badRequest('currency must be a three-letter code');

  let start = localDate(fiscalYear, 3);
  let end = localDate(fiscalYear + 1, 3);
  let label = `FY ${fiscalYear}-${String(fiscalYear + 1).slice(-2)}`;
  if (period === 'month') {
    const year = fiscalYear + (month < 4 ? 1 : 0);
    start = localDate(year, month - 1);
    end = localDate(year, month);
    label = `${MONTHS[month - 1]} ${year}`;
  } else if (period === 'quarter') {
    start = localDate(fiscalYear, 3 + (quarter - 1) * 3);
    end = localDate(fiscalYear, 3 + quarter * 3);
    label = `Q${quarter} · ${label}`;
  }

  // Half-open intervals include the start, exclude the end and future payments.
  const started = now > start;
  const cutoff = new Date(Math.max(start.getTime(), Math.min(now.getTime(), end.getTime())));
  const priorStart = previousYear(start);
  const priorEnd = cutoff >= end ? previousYear(end) : previousYear(cutoff);
  const priorCutoff = new Date(Math.max(priorStart.getTime(), priorEnd.getTime()));
  const base = { isActive: true, currency };
  return {
    period, fiscalYear, month, quarter, currency, currentFiscalYear,
    start, end, cutoff, priorStart, priorCutoff, started, label, now,
    match: { ...base, paymentDate: { $gte: start, $lt: cutoff } },
    priorMatch: { ...base, status: 'Completed', paymentDate: { $gte: priorStart, $lt: priorCutoff } },
  };
}

function numberValue(value) {
  return value == null ? 0 : Number(value.toString());
}
function money(value) {
  return Number(numberValue(value).toFixed(2));
}
function percent(part, total) {
  return total > 0 ? Number((part / total * 100).toFixed(2)) : null;
}

function totalStages() {
  return [
    { $group: {
      _id: null,
      revenue: { $sum: DECIMAL_AMOUNT },
      paymentCount: { $sum: 1 },
      reconciledRevenue: { $sum: { $cond: [{ $eq: ['$isReconciled', true] }, DECIMAL_AMOUNT, 0] } },
      reconciledCount: { $sum: { $cond: [{ $eq: ['$isReconciled', true] }, 1, 0] } },
      unappliedCount: { $sum: { $cond: [{ $eq: ['$appliedToOrder', true] }, 0, 1] } },
    } },
  ];
}

function makeTrend(scope, rows) {
  const daily = scope.period === 'month';
  const byKey = new Map(rows.map((row) => [row._id, row]));
  const cursor = new Date(scope.start.getTime() + OFFSET_MS);
  const buckets = [];
  while (cursor.getTime() - OFFSET_MS < scope.end.getTime()) {
    const bucketStart = new Date(cursor.getTime() - OFFSET_MS);
    const key = localKey(bucketStart, daily);
    const row = byKey.get(key);
    buckets.push({
      key,
      label: daily ? String(cursor.getUTCDate()) : `${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
      revenue: money(row?.revenue),
      paymentCount: row?.paymentCount || 0,
      isFuture: bucketStart >= scope.cutoff,
    });
    if (daily) cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return buckets;
}

function metadata(scope) {
  return {
    basis: 'Active Completed payments, by paymentDate; gross cash collections, not accrual revenue or profit.',
    filters: { period: scope.period, fiscalYear: scope.fiscalYear, month: scope.month, quarter: scope.quarter, currency: scope.currency },
    currentFiscalYear: scope.currentFiscalYear,
    label: scope.label,
    timezone: `UTC${TIMEZONE}`,
    startDate: localKey(scope.start, true),
    endDateExclusive: localKey(scope.end, true),
    effectiveEndExclusive: scope.cutoff.toISOString(),
    asOf: scope.now.toISOString(),
    isPartialPeriod: scope.started && scope.cutoff < scope.end,
    isFuturePeriod: !scope.started,
    comparison: {
      start: scope.priorStart.toISOString(),
      endExclusive: scope.priorCutoff.toISOString(),
      label: 'Same period last fiscal year (same elapsed calendar period when in progress)',
    },
    recentLimit: RECENT_LIMIT,
  };
}

function handleError(res, error, message) {
  if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
  console.error(message, error);
  return res.status(500).json({ success: false, message });
}

const getRevenueDashboard = async (req, res) => {
  try {
    const scope = buildScope(req.query);
    const completed = { $match: { status: 'Completed' } };
    const [aggregate, previous, recent] = await Promise.all([
      Payment.aggregate([
        { $match: scope.match },
        { $facet: {
          totals: [completed, ...totalStages()],
          orders: [completed, { $match: { order: { $ne: null } } }, { $group: { _id: '$order' } }, { $count: 'count' }],
          trend: [completed,
            { $group: {
              _id: { $dateToString: { date: '$paymentDate', format: scope.period === 'month' ? '%Y-%m-%d' : '%Y-%m', timezone: TIMEZONE } },
              revenue: { $sum: DECIMAL_AMOUNT }, paymentCount: { $sum: 1 },
            } },
            { $sort: { _id: 1 } },
          ],
          byMode: [completed,
            { $group: { _id: '$paymentMode', revenue: { $sum: DECIMAL_AMOUNT }, paymentCount: { $sum: 1 } } },
            { $sort: { revenue: -1, _id: 1 } },
          ],
          byStatus: [
            { $group: { _id: '$status', amount: { $sum: DECIMAL_AMOUNT }, paymentCount: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        } },
      ]),
      Payment.aggregate([{ $match: scope.priorMatch }, ...totalStages()]),
      Payment.find({ ...scope.match, status: 'Completed' })
        .select('paymentNumber paymentDate contact order amount currency paymentMode status isReconciled appliedToOrder')
        .populate('contact', 'name company')
        .populate('order', 'orderNumber')
        .sort({ paymentDate: -1, _id: -1 })
        .limit(RECENT_LIMIT)
        .lean(),
    ]);
    const result = aggregate[0] || {};
    const total = result.totals?.[0] || {};
    const prior = previous[0] || {};
    const revenue = money(total.revenue);
    const priorRevenue = money(prior.revenue);
    const paymentCount = total.paymentCount || 0;
    const reconciledRevenue = money(total.reconciledRevenue);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      data: {
        meta: metadata(scope),
        summary: {
          revenue,
          paymentCount,
          ordersWithPayments: result.orders?.[0]?.count || 0,
          averagePayment: paymentCount ? money(numberValue(total.revenue) / paymentCount) : 0,
          previousRevenue: priorRevenue,
          growthPercent: scope.started && priorRevenue > 0 ? Number(((revenue - priorRevenue) / priorRevenue * 100).toFixed(2)) : null,
        },
        health: {
          reconciledRevenue,
          unreconciledRevenue: money(revenue - reconciledRevenue),
          reconciledCount: total.reconciledCount || 0,
          reconciliationPercent: percent(reconciledRevenue, revenue),
          completedNotAppliedCount: total.unappliedCount || 0,
        },
        trend: makeTrend(scope, result.trend || []),
        byMode: (result.byMode || []).map((row) => ({
          mode: row._id || 'Unspecified', revenue: money(row.revenue),
          paymentCount: row.paymentCount, sharePercent: percent(numberValue(row.revenue), numberValue(total.revenue)),
        })),
        byStatus: (result.byStatus || []).map((row) => ({
          status: row._id || 'Unspecified', amount: money(row.amount), paymentCount: row.paymentCount,
        })),
        recentPayments: recent.map((payment) => ({
          id: String(payment._id),
          paymentNumber: payment.paymentNumber,
          client: payment.contact?.company || payment.contact?.name || 'Unavailable contact',
          contactName: payment.contact?.name || '',
          orderNumber: payment.order?.orderNumber || 'Unavailable order',
          paymentDate: localKey(new Date(payment.paymentDate), true),
          amount: money(payment.amount), currency: payment.currency,
          paymentMode: payment.paymentMode, status: payment.status,
          isReconciled: payment.isReconciled === true,
          appliedToOrder: payment.appliedToOrder === true,
        })),
      },
    });
  } catch (error) {
    return handleError(res, error, 'Unable to load revenue dashboard');
  }
};

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function csvRow(values) {
  return `${values.map(csvCell).join(',')}\r\n`;
}
function waitForDrain(res) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', onDrain); res.off('close', onClose); res.off('error', onError);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('Download disconnected')); };
    const onError = (error) => { cleanup(); reject(error); };
    res.once('drain', onDrain); res.once('close', onClose); res.once('error', onError);
    if (res.destroyed) onClose();
  });
}

const exportRevenueLedger = async (req, res) => {
  let cursor;
  const onClose = () => { if (cursor) void cursor.close().catch(() => {}); };
  try {
    const scope = buildScope(req.query);
    cursor = Payment.find({ ...scope.match, status: 'Completed' })
      .select('paymentNumber paymentDate contact order amount currency paymentMode transactionId isReconciled appliedToOrder')
      .populate('contact', 'name company')
      .populate('order', 'orderNumber')
      .sort({ paymentDate: -1, _id: -1 })
      .lean()
      .cursor({ batchSize: 200 });
    res.once('close', onClose);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-${scope.period}-${scope.fiscalYear}-${scope.currency}-${localKey(scope.start, true)}.csv"`);
    res.write('\uFEFF' + csvRow([
      'Payment number', `Payment date (UTC${TIMEZONE})`, 'Client', 'Contact', 'Order number',
      'Amount', 'Currency', 'Payment mode', 'Transaction ID', 'Reconciled', 'Applied to order',
    ]));
    for await (const payment of cursor) {
      if (res.destroyed) break;
      const row = csvRow([
        payment.paymentNumber, localKey(new Date(payment.paymentDate), true),
        payment.contact?.company || payment.contact?.name || 'Unavailable contact',
        payment.contact?.name || '', payment.order?.orderNumber || 'Unavailable order',
        money(payment.amount), payment.currency, payment.paymentMode, payment.transactionId || '',
        payment.isReconciled ? 'Yes' : 'No', payment.appliedToOrder ? 'Yes' : 'No',
      ]);
      if (!res.write(row)) await waitForDrain(res);
    }
    if (!res.destroyed) res.end();
  } catch (error) {
    if (res.destroyed) return;
    if (!res.headersSent) {
      res.removeHeader('Content-Disposition');
      return handleError(res, error, 'Unable to export revenue ledger');
    }
    console.error('Revenue export interrupted', error);
    res.destroy(error);
  } finally {
    res.off('close', onClose);
    if (cursor) await cursor.close().catch(() => {});
  }
};

module.exports = { getRevenueDashboard, exportRevenueLedger };
