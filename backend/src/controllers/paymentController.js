const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { getNextSequence } = require('../models/Counter');

const MAX_LIMIT = 200;
const MAX_AMOUNT = 10000000000; // 10,000,000,000

const VALID_MODES = [
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Cash',
  'NEFT',
  'RTGS',
  'Other',
];
const VALID_STATUSES = ['Pending', 'Completed', 'Failed', 'Bounced', 'Cancelled'];
const NEEDS_TXN_ID = ['UPI', 'NEFT', 'RTGS', 'Bank Transfer'];

/* ---------- helpers ---------- */
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
        : 'Duplicate payment number, please retry';
    return res.status(409).json({
      success: false,
      message: friendly,
      field,
    });
  }

  // Don't leak error.message to the client
  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

/*
|--------------------------------------------------------------------------
| applyToOrder  (unchanged — already atomic and safe)
|--------------------------------------------------------------------------
*/
const applyToOrder = async ({ orderId, amount, direction, session }) => {
  const delta = direction === 'apply' ? amount : -amount;

  const filter = {
    _id: orderId,
    isActive: true,
  };

  if (direction === 'apply') {
    filter.$expr = {
      $lte: [
        { $add: [{ $ifNull: ['$amountPaid', 0] }, amount] },
        { $add: ['$grandTotal', 0.01] },
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

/*
|--------------------------------------------------------------------------
| Payment number
|--------------------------------------------------------------------------
*/
const generatePaymentNumber = async (session) => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`payment-${year}`, session);
  return `PAY-${year}-${String(seq).padStart(4, '0')}`;
};

/*
|--------------------------------------------------------------------------
| GET ALL PAYMENTS
|--------------------------------------------------------------------------
*/
const getAllPayments = async (req, res) => {
  try {
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
        query.paymentDate.$lte = endOfDay(d); // 👈 end-of-day, not midnight
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const safe = escapeRegex(search.trim().slice(0, 100));
      query.$or = [
        { paymentNumber: { $regex: safe, $options: 'i' } },
        { transactionId: { $regex: safe, $options: 'i' } },
        { chequeNumber: { $regex: safe, $options: 'i' } },
        { paidFrom: { $regex: safe, $options: 'i' } },
        { notes: { $regex: safe, $options: 'i' } },
      ];
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
    const skip = (pageNumber - 1) * limitNumber;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate(
          'order',
          'orderNumber grandTotal amountPaid status paymentStatus'
        )
        .populate('contact', 'name company phone')
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

/*
|--------------------------------------------------------------------------
| GET PAYMENT BY ID
|--------------------------------------------------------------------------
*/
const getPaymentById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid payment ID' });
    }

    const payment = await Payment.findById(req.params.id)
      .populate('order', 'orderNumber grandTotal status paymentStatus amountPaid')
      .populate('contact', 'name company phone email');

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

/*
|--------------------------------------------------------------------------
| CREATE PAYMENT
|--------------------------------------------------------------------------
*/
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
    } = req.body;

    /* ---------- validation ---------- */
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
        message: `Amount must be a positive number up to ${MAX_AMOUNT.toLocaleString('en-IN')}`,
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

    // conditional fields (mirror the model, fail fast with clean messages)
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

    // 👈 The bug fix — explicit date parsing
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
    const finalCurrency = cleanCurrency
      ? cleanCurrency.toUpperCase()
      : 'INR';

    /* ---------- find order ---------- */
    const order = await Order.findById(orderId);
    if (!order || !order.isActive) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    if (!order.contact) {
      return res
        .status(400)
        .json({ success: false, message: 'Order has no linked contact' });
    }

    let createdPayment;

    await session.withTransaction(async () => {
      /* Only Completed payments affect the Order */
      if (status === 'Completed') {
        const updatedOrder = await applyToOrder({
          orderId,
          amount: numericAmount,
          direction: 'apply',
          session,
        });

        if (!updatedOrder) {
          const remaining =
            Number(order.grandTotal || 0) - Number(order.amountPaid || 0);
          const err = new Error(
            `Payment amount (${numericAmount}) exceeds remaining balance (${remaining.toFixed(2)})`
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
            order: orderId,
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
            createdBy: req.user?._id,
          },
        ],
        { session }
      );

      createdPayment = payment;
    });

    const populated = await Payment.findById(createdPayment._id)
      .populate('order', 'orderNumber grandTotal amountPaid paymentStatus')
      .populate('contact', 'name company');

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: populated,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    handleError(res, error, 'Server error while creating payment');
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE PAYMENT
|--------------------------------------------------------------------------
*/
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

    /* ---------- validate incoming fields ---------- */
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

    let cleanPaymentDate;
    if (paymentDate !== undefined) {
      if (paymentDate === null || paymentDate === '') {
        cleanPaymentDate = undefined; // keep existing
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

    let updatedPayment;

    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session);

      const wasApplied = payment.appliedToOrder;

      // Whitelisted updates with sanitization
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
      if (cleanPaymentDate !== undefined) payment.paymentDate = cleanPaymentDate;
      if (attachmentUrl !== undefined) {
        payment.attachmentUrl = safeString(attachmentUrl, 500) || undefined;
      }
      if (isReconciled !== undefined) {
        payment.isReconciled = Boolean(isReconciled);
        // Auto-fill reconciledDate when first reconciled
        if (isReconciled && !payment.reconciledDate && cleanReconciledDate === undefined) {
          payment.reconciledDate = new Date();
        }
      }
      if (cleanReconciledDate !== undefined) {
        payment.reconciledDate = cleanReconciledDate;
      }

      payment.updatedBy = req.user?._id;

      const isCompletedNow = payment.status === 'Completed';

      /* Only touch the order if the applied state changed */
      if (wasApplied !== isCompletedNow) {
        if (isCompletedNow) {
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
          await applyToOrder({
            orderId: payment.order,
            amount: payment.amount,
            direction: 'reverse',
            session,
          });
        }

        payment.appliedToOrder = isCompletedNow;
      }

      await payment.save({ session, validateModifiedOnly: true });
      updatedPayment = payment;
    });

    const populated = await Payment.findById(updatedPayment._id)
      .populate('order', 'orderNumber grandTotal amountPaid paymentStatus')
      .populate('contact', 'name company');

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: populated,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    handleError(res, error, 'Server error while updating payment');
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| DELETE PAYMENT  (soft)
|--------------------------------------------------------------------------
*/
const deletePayment = async (req, res) => {
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

    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session);

      if (payment.appliedToOrder) {
        await applyToOrder({
          orderId: payment.order,
          amount: payment.amount,
          direction: 'reverse',
          session,
        });
        payment.appliedToOrder = false;
      }

      payment.isActive = false;
      payment.updatedBy = req.user?._id;

      await payment.save({ session, validateModifiedOnly: true });
    });

    res.status(200).json({
      success: true,
      message: 'Payment deleted and order balance updated',
    });
  } catch (error) {
    handleError(res, error, 'Server error while deleting payment');
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL PAYMENTS FOR ONE ORDER
|--------------------------------------------------------------------------
*/
const getPaymentsByOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.orderId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid order ID' });
    }

    const [payments, order] = await Promise.all([
      Payment.find({ order: req.params.orderId, isActive: true })
        .populate('contact', 'name company phone email')
        .populate('order', 'orderNumber grandTotal amountPaid paymentStatus')
        .sort({ paymentDate: -1, createdAt: -1 }),

      Order.findById(req.params.orderId).select(
        'orderNumber grandTotal amountPaid paymentStatus contact'
      ),
    ]);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    const orderTotal = Number(order.grandTotal || 0);
    const amountPaid = Number(order.amountPaid || 0);
    const remainingAmount = Math.max(0, orderTotal - amountPaid);

    res.status(200).json({
      success: true,
      count: payments.length,
      order,
      summary: {
        orderTotal,
        totalPaid: amountPaid,
        remainingAmount,
        paymentStatus: order.paymentStatus,
      },
      data: payments,
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payments for order');
  }
};

/*
|--------------------------------------------------------------------------
| PAYMENT SUMMARY
|--------------------------------------------------------------------------
*/
const getPaymentSummary = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totals, todayTotals, byStatus] = await Promise.all([
      Payment.aggregate([
        { $match: { isActive: true, status: 'Completed' } },
        {
          $group: {
            _id: null,
            totalCollected: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: {
            isActive: true,
            status: 'Completed',
            paymentDate: { $gte: startOfToday },
          },
        },
        {
          $group: {
            _id: null,
            totalToday: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      Payment.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$status',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCollected: totals[0]?.totalCollected || 0,
        totalCollectedCount: totals[0]?.count || 0,
        totalToday: todayTotals[0]?.totalToday || 0,
        totalTodayCount: todayTotals[0]?.count || 0,
        byStatus,
      },
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payment summary');
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
};