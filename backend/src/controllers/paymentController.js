const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { getNextSequence } = require('../models/Counter');

const applyToOrder = async ({ orderId, amount, direction, session }) => {
  const delta = direction === 'apply' ? amount : -amount;

  const filter = { _id: orderId, isActive: true };
  if (direction === 'apply') {
    filter.$expr = {
      $lte: [{ $add: ['$amountPaid', amount] }, { $add: ['$grandTotal', 0.01] }],
    };
  }

  const pipeline = [
    {
      $set: {
        amountPaid: {
          $max: [0, { $add: [{ $ifNull: ['$amountPaid', 0] }, delta] }],
        },
      },
    },
    {
      $set: {
        paymentStatus: {
          $switch: {
            branches: [
              { case: { $gte: ['$amountPaid', '$grandTotal'] }, then: 'Paid' },
              { case: { $gt: ['$amountPaid', 0] }, then: 'Partial' },
            ],
            default: 'Pending',
          },
        },
      },
    },
  ];

  return Order.findOneAndUpdate(filter, pipeline, { new: true, session });
};

const generatePaymentNumber = async (session) => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`payment-${year}`, session);
  return `PAY-${year}-${String(seq).padStart(4, '0')}`;
};

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join('; '),
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate payment number, please retry',
    });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: error.message,
  });
};

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

    if (order) query.order = order;
    if (contact) query.contact = contact;
    if (status) query.status = status;
    if (paymentMode) query.paymentMode = paymentMode;

    if (fromDate || toDate) {
      query.paymentDate = {};
      if (fromDate) query.paymentDate.$gte = new Date(fromDate);
      if (toDate) query.paymentDate.$lte = new Date(toDate);
    }

    if (search) {
      query.$or = [
        { paymentNumber: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } },
        { chequeNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('order', 'orderNumber grandTotal status paymentStatus')
        .populate('contact', 'name company phone')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: payments,
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payments');
  }
};

const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('order', 'orderNumber grandTotal status paymentStatus amountPaid')
      .populate('contact', 'name company phone email');

    if (!payment || !payment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payment');
  }
};

const createPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      order: orderId,
      amount,
      currency,
      paymentDate,
      paymentMode,
      transactionId,
      chequeNumber,
      bankName,
      status = 'Completed',
      notes,
      attachmentUrl,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order is required' });
    }
    if (!(amount > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    const order = await Order.findById(orderId);
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let createdPayment;

    await session.withTransaction(async () => {
      // Only a Completed payment ever touches the order's balance.
      // Pending / Failed / Bounced / Cancelled payments are recorded
      // for audit purposes but must not affect amountPaid.
      if (status === 'Completed') {
        const updatedOrder = await applyToOrder({
          orderId,
          amount,
          direction: 'apply',
          session,
        });

        if (!updatedOrder) {
          const remaining = order.grandTotal - (order.amountPaid || 0);
          const err = new Error(
            `Payment amount (${amount}) exceeds remaining balance (${remaining.toFixed(2)})`
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
            amount,
            currency,
            paymentDate: paymentDate || Date.now(),
            paymentMode,
            transactionId,
            chequeNumber,
            bankName,
            status,
            notes,
            attachmentUrl,
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
      return res.status(400).json({ success: false, message: error.message });
    }
    handleError(res, error, 'Server error while creating payment');
  } finally {
    session.endSession();
  }
};

const updatePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const existing = await Payment.findById(req.params.id);
    if (!existing || !existing.isActive) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Amount, order, and contact are deliberately NOT editable here.
    // A payment correction should be a reversal (status -> Cancelled/Bounced)
    // plus a fresh payment, never a silent mutation of a settled amount.
    const allowed = [
      'paymentMode',
      'transactionId',
      'chequeNumber',
      'bankName',
      'notes',
      'status',
      'paymentDate',
      'attachmentUrl',
      'isReconciled',
      'reconciledDate',
    ];

    let updatedPayment;

    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session);

      const wasApplied = payment.appliedToOrder;

      allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
          payment[field] = req.body[field];
        }
      });
      payment.updatedBy = req.user?._id;

      const isCompletedNow = payment.status === 'Completed';

      // Only touch the order if the "applied" state is actually changing —
      // e.g. Completed -> Bounced (reverse), or Pending -> Completed (apply).
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
              'Marking this payment Completed would exceed the order\'s remaining balance'
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
      return res.status(400).json({ success: false, message: error.message });
    }
    handleError(res, error, 'Server error while updating payment');
  } finally {
    session.endSession();
  }
};

const deletePayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const existing = await Payment.findById(req.params.id);
    if (!existing || !existing.isActive) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session);

      // Only reverse the order balance if this payment had actually been
      // applied to it (status was Completed). Reversing a Pending/Failed
      // payment's amount would incorrectly credit the order.
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
    session.endSession();
  }
};

const getPaymentsByOrder = async (req, res) => {
  try {
    const [payments, order] = await Promise.all([
      Payment.find({ order: req.params.orderId, isActive: true })
        .populate('contact', 'name company')
        .sort({ paymentDate: -1 }),
      Order.findById(req.params.orderId).select('orderNumber grandTotal amountPaid paymentStatus'),
    ]);

    res.status(200).json({
      success: true,
      count: payments.length,
      order,
      data: payments,
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching payments for order');
  }
};

/**
 * Aggregate summary for dashboard cards: total collected, total pending,
 * today's collections, and a breakdown by mode/status. Avoids making the
 * frontend paginate through every payment just to show totals.
 */
const getPaymentSummary = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totals, todayTotals, byStatus] = await Promise.all([
      Payment.aggregate([
        { $match: { isActive: true, status: 'Completed' } },
        { $group: { _id: null, totalCollected: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            isActive: true,
            status: 'Completed',
            paymentDate: { $gte: startOfToday },
          },
        },
        { $group: { _id: null, totalToday: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
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