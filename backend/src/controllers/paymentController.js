'use strict';

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { getNextSequence } = require('../models/Counter');

const MAX_LIMIT = 200;
const MAX_AMOUNT = 10000000000;

const VALID_MODES = [
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Cash',
  'NEFT',
  'RTGS',
  'Other',
];
const VALID_STATUSES = ['Pending', 'Completed', 'Cancelled'];
const NEEDS_TXN_ID = ['UPI', 'NEFT', 'RTGS', 'Bank Transfer'];

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : '';
};

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const handleError = (res, error, fallbackMessage) => {
  console.error(`[${fallbackMessage}]`, error);

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join('; '),
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    const friendly =
      field === 'transactionId'
        ? 'Transaction ID already exists'
        : field === 'idempotencyKey'
        ? 'Duplicate idempotency key'
        : 'Duplicate payment number, please retry';
    return res.status(409).json({
      success: false,
      message: friendly,
      field,
    });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

const ORDER_SELECT =
  'orderNumber grandTotal amountPaid status paymentStatus customerName customerPhone';

const populatePayment = (query) =>
  query
    .populate({
      path: 'order',
      select: ORDER_SELECT,
      populate: {
        path: 'contact',
        select: 'name company phone email address gstin state stateCode',
      },
    })
    .populate('contact', 'name company phone email');

/* ------------------------------------------------------------------ */
/*  OVERDUE RECONCILIATION — lazily marks orders overdue on read      */
/* ------------------------------------------------------------------ */

const reconcileOverdueOrders = async () => {
  const now = new Date();
  try {
    await Order.updateMany(
      {
        isActive: true,
        paymentStatus: { $in: ['Pending', 'Partial'] },
        paymentDueDate: { $ne: null, $lt: now },
        $expr: { $lt: ['$amountPaid', '$grandTotal'] },
      },
      { $set: { paymentStatus: 'Overdue' } }
    );
  } catch (err) {
    // Non-fatal: log and continue. Read paths shouldn't hard-fail if this
    // background-ish update hits a transient error.
    console.error('[reconcileOverdueOrders]', err);
  }
};

/* ------------------------------------------------------------------ */
/*  APPLY TO ORDER — compare-and-swap guarded both directions         */
/* ------------------------------------------------------------------ */

const applyToOrder = async ({ orderId, amount, direction, session }) => {
  const delta = direction === 'apply' ? amount : -amount;

  const filter = {
    _id: orderId,
    isActive: true,
  };

  if (direction === 'apply') {
    // Resulting amountPaid must not exceed grandTotal.
    filter.$expr = {
      $lte: [
        { $add: [{ $ifNull: ['$amountPaid', 0] }, amount] },
        { $add: ['$grandTotal', 0.01] },
      ],
    };
  } else {
    // Reverse: amountPaid must be at least `amount` so the order never
    // goes negative. Guards against concurrent double-reversals.
    filter.$expr = {
      $gte: [
        { $ifNull: ['$amountPaid', 0] },
        { $subtract: [amount, 0.01] },
      ],
    };
  }

  const pipeline = [
    {
      $set: {
        amountPaid: {
          $max: [
            0,
            { $add: [{ $ifNull: ['$amountPaid', 0] }, delta] },
          ],
        },
      },
    },
    {
      $set: {
        paymentStatus: {
          $switch: {
            branches: [
              {
                case: { $gte: ['$amountPaid', '$grandTotal'] },
                then: 'Paid',
              },
              {
                case: { $gt: ['$amountPaid', 0] },
                then: 'Partial',
              },
            ],
            default: 'Pending',
          },
        },
      },
    },
  ];

  return Order.findOneAndUpdate(filter, pipeline, {
    new: true,
    session,
    updatePipeline: true,
  });
};

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

const generatePaymentNumber = async (session) => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`payment-${year}`, session);
  return `PAY-${year}-${String(seq).padStart(4, '0')}`;
};

const pendingTotalForOrder = async (orderId, session = null) => {
  const pipeline = [
    {
      $match: {
        order: new mongoose.Types.ObjectId(String(orderId)),
        isActive: true,
        status: 'Pending',
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ];

  const agg = Payment.aggregate(pipeline);
  if (session) agg.session(session);
  const result = await agg;
  return result[0]?.total || 0;
};

/* ------------------------------------------------------------------ */
/*  READ                                                               */
/* ------------------------------------------------------------------ */

const getAllPayments = async (req, res) => {
  try {
    // Lazy overdue reconciliation
    await reconcileOverdueOrders();

    const {
      page = 1,
      limit = 20,
      order,
      contact,
      status,
      paymentMode,
      fromDate,
      toDate,
      search,
    } = req.query;

    const query = { isActive: true };
    const andConditions = [];

    if (order) {
      if (!isValidId(order)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid order ID' });
      }
      query.order = order;
    }

    if (contact) {
      if (!isValidId(contact)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid contact ID' });
      }
      query.contact = contact;
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid status filter' });
      }
      query.status = status;
    }

    if (paymentMode) {
      if (!VALID_MODES.includes(paymentMode)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid paymentMode filter' });
      }
      query.paymentMode = paymentMode;
    }

    if (fromDate || toDate) {
      query.paymentDate = {};

      if (fromDate) {
        const d = parseDate(fromDate);
        if (!d) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid fromDate' });
        }
        query.paymentDate.$gte = d;
      }

      if (toDate) {
        const d = parseDate(toDate);
        if (!d) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid toDate' });
        }
        query.paymentDate.$lte = endOfDay(d);
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const safe = escapeRegex(search.trim().slice(0, 100));
      andConditions.push({
        $or: [
          { paymentNumber: { $regex: safe, $options: 'i' } },
          { transactionId: { $regex: safe, $options: 'i' } },
          { chequeNumber: { $regex: safe, $options: 'i' } },
          { paidFrom: { $regex: safe, $options: 'i' } },
          { notes: { $regex: safe, $options: 'i' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
    const skip = (pageNumber - 1) * limitNumber;

    const [payments, total] = await Promise.all([
      populatePayment(Payment.find(query))
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limitNumber),

      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      page: pageNumber,
      pages: Math.max(Math.ceil(total / limitNumber), 1),
      data: payments,
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payments');
  }
};

const getPaymentById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid payment ID' });
    }

    const payment = await populatePayment(Payment.findById(req.params.id));

    if (!payment || !payment.isActive) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payment');
  }
};

const getPaymentsByOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.orderId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid order ID' });
    }

    const [payments, order, pendingTotal] = await Promise.all([
      Payment.find({ order: req.params.orderId, isActive: true })
        .populate('contact', 'name company phone email')
        .populate({
          path: 'order',
          select: ORDER_SELECT,
          populate: {
            path: 'contact',
            select: 'name company phone email address gstin state stateCode',
          },
        })
        .sort({ paymentDate: -1, createdAt: -1 }),

      Order.findById(req.params.orderId)
        .select(
          'orderNumber grandTotal amountPaid paymentStatus customerName customerPhone contact paymentDueDate'
        )
        .populate(
          'contact',
          'name company phone email address gstin state stateCode'
        ),

      pendingTotalForOrder(req.params.orderId),
    ]);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    const orderTotal = Number(order.grandTotal || 0);
    const amountPaid = Number(order.amountPaid || 0);
    const availableForPayment = Math.max(
      0,
      orderTotal - amountPaid - pendingTotal
    );

    res.status(200).json({
      success: true,
      count: payments.length,
      order,
      summary: {
        orderTotal,
        totalPaid: amountPaid,
        pendingAmount: pendingTotal,
        remainingAmount: Math.max(0, orderTotal - amountPaid),
        availableForPayment,
        paymentStatus: order.paymentStatus,
      },
      data: payments,
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payments for order');
  }
};

/* ------------------------------------------------------------------ */
/*  SUMMARY — currency-aware                                           */
/* ------------------------------------------------------------------ */

const getPaymentSummary = async (req, res) => {
  try {
    // Lazy overdue reconciliation
    await reconcileOverdueOrders();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [overallByCurrency, todayByCurrency, byStatusByCurrency] =
      await Promise.all([
        Payment.aggregate([
          {
            $addFields: {
              currency: { $ifNull: ['$currency', 'INR'] },
            },
          },
          { $match: { isActive: true, status: 'Completed' } },
          {
            $group: {
              _id: '$currency',
              totalCollected: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]),

        Payment.aggregate([
          {
            $addFields: {
              currency: { $ifNull: ['$currency', 'INR'] },
            },
          },
          {
            $match: {
              isActive: true,
              status: 'Completed',
              paymentDate: { $gte: startOfToday },
            },
          },
          {
            $group: {
              _id: '$currency',
              totalToday: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]),

        Payment.aggregate([
          {
            $addFields: {
              currency: { $ifNull: ['$currency', 'INR'] },
            },
          },
          { $match: { isActive: true } },
          {
            $group: {
              _id: { currency: '$currency', status: '$status' },
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    // Build per-currency buckets
    const currencies = new Set();
    overallByCurrency.forEach((r) => currencies.add(r._id));
    todayByCurrency.forEach((r) => currencies.add(r._id));
    byStatusByCurrency.forEach((r) => currencies.add(r._id.currency));

    const perCurrency = {};

    for (const cur of currencies) {
      const overall = overallByCurrency.find((r) => r._id === cur) || {
        totalCollected: 0,
        count: 0,
      };
      const today = todayByCurrency.find((r) => r._id === cur) || {
        totalToday: 0,
        count: 0,
      };
      const statuses = byStatusByCurrency
        .filter((r) => r._id.currency === cur)
        .map((r) => ({
          status: r._id.status,
          total: r.total,
          count: r.count,
        }));

      perCurrency[cur] = {
        totalCollected: overall.totalCollected,
        totalCollectedCount: overall.count,
        totalToday: today.totalToday,
        totalTodayCount: today.count,
        byStatus: statuses,
      };
    }

    res.status(200).json({
      success: true,
      data: {
        // Legacy top-level fields (only meaningful when a single currency
        // dominates the dataset). New clients should use `currencies`.
        totalCollected:
          perCurrency.INR?.totalCollected ||
          Object.values(perCurrency)[0]?.totalCollected ||
          0,
        totalCollectedCount:
          perCurrency.INR?.totalCollectedCount ||
          Object.values(perCurrency)[0]?.totalCollectedCount ||
          0,
        totalToday:
          perCurrency.INR?.totalToday ||
          Object.values(perCurrency)[0]?.totalToday ||
          0,
        totalTodayCount:
          perCurrency.INR?.totalTodayCount ||
          Object.values(perCurrency)[0]?.totalTodayCount ||
          0,
        // New, currency-aware view
        currencies: perCurrency,
      },
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payment summary');
  }
};

/* ------------------------------------------------------------------ */
/*  CREATE                                                             */
/* ------------------------------------------------------------------ */

const createPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      order: orderId,
      amount,
      currency,
      paymentDate,
      paymentMode,
      paidFrom,
      transactionId,
      chequeNumber,
      bankName,
      status = 'Completed',
      notes,
      attachmentUrl,
      idempotencyKey,
    } = req.body;

    if (!orderId || !isValidId(orderId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Valid order ID is required' });
    }

    const numericAmount = Number(amount);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > MAX_AMOUNT
    ) {
      return res.status(400).json({
        success: false,
        message: `Amount must be a positive number up to ${MAX_AMOUNT.toLocaleString(
          'en-IN'
        )}`,
      });
    }

    if (!paymentMode || !VALID_MODES.includes(paymentMode)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid payment mode' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid status' });
    }

    if (paymentMode === 'Cheque') {
      if (!safeString(chequeNumber, 50)) {
        return res.status(400).json({
          success: false,
          message: 'Cheque number is required',
        });
      }
      if (!safeString(bankName, 150)) {
        return res.status(400).json({
          success: false,
          message: 'Bank name is required',
        });
      }
    }

    if (NEEDS_TXN_ID.includes(paymentMode) && !safeString(transactionId, 100)) {
      return res.status(400).json({
        success: false,
        message: `Transaction ID is required for ${paymentMode}`,
      });
    }

    let cleanPaymentDate = new Date();
    if (paymentDate !== undefined && paymentDate !== null && paymentDate !== '') {
      const parsed = parseDate(paymentDate);
      if (!parsed) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payment date' });
      }
      cleanPaymentDate = parsed;
    }

    const cleanCurrency = safeString(currency, 3);
    const finalCurrency = cleanCurrency ? cleanCurrency.toUpperCase() : 'INR';
    const cleanIdempotencyKey = safeString(idempotencyKey, 200);

    // Fast-path idempotent replay (outside transaction, cheap read)
    if (cleanIdempotencyKey) {
      const existing = await Payment.findOne({
        idempotencyKey: cleanIdempotencyKey,
      });
      if (existing) {
        const populated = await populatePayment(
          Payment.findById(existing._id)
        );
        return res.status(200).json({
          success: true,
          message: 'Payment already recorded (idempotent replay)',
          data: populated,
        });
      }
    }

    let createdPayment;
    let idempotentReplayId = null;

    await session.withTransaction(async () => {
      // In-transaction idempotency re-check to close the race
      if (cleanIdempotencyKey) {
        const existingInTx = await Payment.findOne({
          idempotencyKey: cleanIdempotencyKey,
        }).session(session);

        if (existingInTx) {
          idempotentReplayId = existingInTx._id;
          return;
        }
      }

      // Order read moves INSIDE the transaction
      const order = await Order.findOne({
        _id: orderId,
        isActive: true,
      }).session(session);

      if (!order) {
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
      }

      if (['Draft', 'Cancelled'].includes(order.status)) {
        const err = new Error(
          `Cannot record a payment for a ${order.status} order.`
        );
        err.status = 400;
        err.code = 'ORDER_NOT_PAYABLE';
        throw err;
      }

      if (!order.contact) {
        const err = new Error('Order has no linked contact');
        err.status = 400;
        throw err;
      }

      // Pending payments must fit within remaining balance too
      if (status === 'Pending') {
        const existingPending = await pendingTotalForOrder(order._id, session);
        const remaining =
          Number(order.grandTotal || 0) -
          Number(order.amountPaid || 0) -
          existingPending;

        if (numericAmount > remaining + 0.01) {
          const err = new Error(
            `Pending payments would exceed remaining balance of ₹${remaining.toFixed(
              2
            )}`
          );
          err.status = 400;
          err.code = 'PENDING_EXCEEDS_REMAINING';
          throw err;
        }
      }

      if (status === 'Completed') {
        const updatedOrder = await applyToOrder({
          orderId: order._id,
          amount: numericAmount,
          direction: 'apply',
          session,
        });

        if (!updatedOrder) {
          const remaining =
            Number(order.grandTotal || 0) - Number(order.amountPaid || 0);
          const err = new Error(
            `Payment amount (${numericAmount}) exceeds remaining balance (${remaining.toFixed(
              2
            )})`
          );
          err.status = 400;
          throw err;
        }
      }

      const paymentNumber = await generatePaymentNumber(session);

      const [payment] = await Payment.create(
        [
          {
            paymentNumber,
            order: order._id,
            contact: order.contact,
            amount: numericAmount,
            currency: finalCurrency,
            paymentDate: cleanPaymentDate,
            paymentMode,
            paidFrom: safeString(paidFrom, 150) || undefined,
            transactionId: safeString(transactionId, 100) || undefined,
            chequeNumber: safeString(chequeNumber, 50) || undefined,
            bankName: safeString(bankName, 150) || undefined,
            status,
            notes: safeString(notes, 2000) || undefined,
            attachmentUrl: safeString(attachmentUrl, 500) || undefined,
            appliedToOrder: status === 'Completed',
            idempotencyKey: cleanIdempotencyKey || undefined,
            createdBy: req.user?._id,
          },
        ],
        { session }
      );

      createdPayment = payment;
    });

    if (idempotentReplayId) {
      const populated = await populatePayment(
        Payment.findById(idempotentReplayId)
      );
      return res.status(200).json({
        success: true,
        message: 'Payment already recorded (idempotent replay)',
        data: populated,
      });
    }

    const populated = await populatePayment(
      Payment.findById(createdPayment._id)
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: populated,
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        success: false,
        ...(error.code ? { code: error.code } : {}),
        message: error.message,
      });
    }

    // Race on unique idempotencyKey: return the winner
    if (
      error.code === 11000 &&
      error.keyPattern &&
      error.keyPattern.idempotencyKey
    ) {
      const existing = await Payment.findOne({
        idempotencyKey: req.body.idempotencyKey,
      });
      if (existing) {
        const populated = await populatePayment(
          Payment.findById(existing._id)
        );
        return res.status(200).json({
          success: true,
          message: 'Payment already recorded (idempotent replay)',
          data: populated,
        });
      }
    }

    handleError(res, error, 'Server error while creating payment');
  } finally {
    await session.endSession();
  }
};

/* ------------------------------------------------------------------ */
/*  UPDATE                                                             */
/* ------------------------------------------------------------------ */

const updatePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid payment ID' });
    }

    const existing = await Payment.findById(req.params.id);
    if (!existing || !existing.isActive) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    const {
      paymentMode,
      paidFrom,
      transactionId,
      chequeNumber,
      bankName,
      notes,
      status,
      paymentDate,
      attachmentUrl,
      isReconciled,
      reconciledDate,
    } = req.body;

    if (paymentMode !== undefined && !VALID_MODES.includes(paymentMode)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid payment mode' });
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid status' });
    }

    const finalMode =
      paymentMode !== undefined ? paymentMode : existing.paymentMode;
    const finalTxnId =
      transactionId !== undefined
        ? safeString(transactionId, 100)
        : existing.transactionId;
    const finalCheque =
      chequeNumber !== undefined
        ? safeString(chequeNumber, 50)
        : existing.chequeNumber;
    const finalBank =
      bankName !== undefined
        ? safeString(bankName, 150)
        : existing.bankName;

    if (finalMode === 'Cheque') {
      if (!finalCheque) {
        return res.status(400).json({
          success: false,
          code: 'CHEQUE_DETAILS_REQUIRED',
          message: 'Cheque number is required for cheque payments.',
        });
      }
      if (!finalBank) {
        return res.status(400).json({
          success: false,
          code: 'CHEQUE_DETAILS_REQUIRED',
          message: 'Bank name is required for cheque payments.',
        });
      }
    }

    if (NEEDS_TXN_ID.includes(finalMode) && !finalTxnId) {
      return res.status(400).json({
        success: false,
        code: 'TRANSACTION_ID_REQUIRED',
        message: `Transaction ID is required for ${finalMode}.`,
      });
    }

    let cleanPaymentDate;
    if (paymentDate !== undefined) {
      if (paymentDate === null || paymentDate === '') {
        cleanPaymentDate = undefined;
      } else {
        const parsed = parseDate(paymentDate);
        if (!parsed) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid payment date' });
        }
        cleanPaymentDate = parsed;
      }
    }

    let cleanReconciledDate;
    if (reconciledDate !== undefined) {
      if (reconciledDate === null || reconciledDate === '') {
        cleanReconciledDate = null;
      } else {
        const parsed = parseDate(reconciledDate);
        if (!parsed) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid reconciled date' });
        }
        cleanReconciledDate = parsed;
      }
    }

    let cleanIsReconciled;
    if (isReconciled !== undefined) {
      if (typeof isReconciled === 'boolean') {
        cleanIsReconciled = isReconciled;
      } else if (isReconciled === 'true' || isReconciled === 'false') {
        cleanIsReconciled = isReconciled === 'true';
      } else {
        return res.status(400).json({
          success: false,
          code: 'INVALID_RECONCILIATION_STATUS',
          message: 'isReconciled must be a boolean.',
        });
      }
    }

    let updatedPayment;

    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session);
      if (!payment || !payment.isActive) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      const wasApplied = payment.appliedToOrder;

      if (paymentMode !== undefined) payment.paymentMode = paymentMode;
      if (paidFrom !== undefined) {
        payment.paidFrom = safeString(paidFrom, 150) || undefined;
      }
      if (transactionId !== undefined) {
        payment.transactionId = safeString(transactionId, 100) || undefined;
      }
      if (chequeNumber !== undefined) {
        payment.chequeNumber = safeString(chequeNumber, 50) || undefined;
      }
      if (bankName !== undefined) {
        payment.bankName = safeString(bankName, 150) || undefined;
      }
      if (notes !== undefined) {
        payment.notes = safeString(notes, 2000) || undefined;
      }
      if (status !== undefined) payment.status = status;
      if (cleanPaymentDate !== undefined)
        payment.paymentDate = cleanPaymentDate;
      if (attachmentUrl !== undefined) {
        payment.attachmentUrl = safeString(attachmentUrl, 500) || undefined;
      }

      if (cleanIsReconciled !== undefined) {
        payment.isReconciled = cleanIsReconciled;
        if (
          cleanIsReconciled &&
          !payment.reconciledDate &&
          cleanReconciledDate === undefined
        ) {
          payment.reconciledDate = new Date();
        }
        if (!cleanIsReconciled) {
          payment.reconciledDate = null;
        }
      }
      if (cleanReconciledDate !== undefined) {
        payment.reconciledDate = cleanReconciledDate;
      }

      payment.updatedBy = req.user?._id;

      const isCompletedNow = payment.status === 'Completed';

      if (wasApplied !== isCompletedNow) {
        if (isCompletedNow) {
          // Pending → Completed: verify order still accepts the amount
          const order = await Order.findById(payment.order).session(session);

          if (!order || !order.isActive) {
            const err = new Error('Order not found or inactive');
            err.status = 400;
            throw err;
          }

          if (['Draft', 'Cancelled'].includes(order.status)) {
            const err = new Error(
              `Cannot complete a payment for a ${order.status} order.`
            );
            err.status = 400;
            throw err;
          }

          const updatedOrder = await applyToOrder({
            orderId: payment.order,
            amount: payment.amount,
            direction: 'apply',
            session,
          });

          if (!updatedOrder) {
            const err = new Error(
              "Marking this payment Completed would exceed the order's remaining balance"
            );
            err.status = 400;
            throw err;
          }
        } else {
          // Completed → not Completed: reverse (now guarded against negative)
          const reversed = await applyToOrder({
            orderId: payment.order,
            amount: payment.amount,
            direction: 'reverse',
            session,
          });

          if (!reversed) {
            const err = new Error(
              "Cannot reverse: order's amountPaid would drop below the payment amount"
            );
            err.status = 409;
            err.code = 'REVERSAL_WOULD_GO_NEGATIVE';
            throw err;
          }
        }

        payment.appliedToOrder = isCompletedNow;
      }

      // Pending → Pending amount changed? Not currently supported (amount is
      // immutable on update). If you later allow amount edits, add a guard
      // here against the sum of other pending payments exceeding remaining.

      await payment.save({ session, validateModifiedOnly: true });
      updatedPayment = payment;
    });

    const populated = await populatePayment(
      Payment.findById(updatedPayment._id)
    );

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: populated,
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404 || error.status === 409) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        ...(error.code && { code: error.code }),
      });
    }
    handleError(res, error, 'Server error while updating payment');
  } finally {
    await session.endSession();
  }
};

/* ------------------------------------------------------------------ */
/*  DELETE                                                             */
/* ------------------------------------------------------------------ */

const deletePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    if (!isValidId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid payment ID' });
    }

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        _id: req.params.id,
        isActive: true,
      }).session(session);

      if (!payment) {
        const err = new Error('Payment not found');
        err.status = 404;
        throw err;
      }

      const wasApplied = payment.appliedToOrder;

      // Compare-and-swap: only transition if state hasn't changed since read
      const cas = await Payment.updateOne(
        {
          _id: payment._id,
          isActive: true,
          appliedToOrder: wasApplied,
        },
        {
          $set: {
            isActive: false,
            status: 'Cancelled',
            appliedToOrder: false,
            updatedBy: req.user?._id,
          },
        },
        { session }
      );

      if (cas.modifiedCount !== 1) {
        const err = new Error('Payment state changed; please retry');
        err.status = 409;
        err.code = 'PAYMENT_CHANGED';
        throw err;
      }

      // Reverse from the order if it had been applied
      if (wasApplied) {
        const reversed = await applyToOrder({
          orderId: payment.order,
          amount: payment.amount,
          direction: 'reverse',
          session,
        });

        if (!reversed) {
          const err = new Error(
            "Cannot delete: order's amountPaid would drop below the payment amount"
          );
          err.status = 409;
          err.code = 'REVERSAL_WOULD_GO_NEGATIVE';
          throw err;
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment cancelled and order balance updated',
    });
  } catch (error) {
    if (error.status === 404 || error.status === 409) {
      return res.status(error.status).json({
        success: false,
        ...(error.code ? { code: error.code } : {}),
        message: error.message,
      });
    }
    handleError(res, error, 'Server error while deleting payment');
  } finally {
    await session.endSession();
  }
};

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsByOrder,
  getPaymentSummary,
  reconcileOverdueOrders,
};