const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      unique: true,
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMode: {
      type: String,
      enum: ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'NEFT', 'RTGS', 'Other'],
      required: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    chequeNumber: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Bounced', 'Cancelled'],
      default: 'Completed',
    },
    appliedToOrder: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
    },
    attachmentUrl: {
      type: String,
      trim: true,
    },
    isReconciled: {
      type: Boolean,
      default: false,
    },
    reconciledDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.pre('validate', function (next) {
  if (this.paymentMode === 'Cheque') {
    if (!this.chequeNumber) {
      this.invalidate('chequeNumber', 'Cheque number is required for Cheque payments');
    }
    if (!this.bankName) {
      this.invalidate('bankName', 'Bank name is required for Cheque payments');
    }
  }

  const needsTransactionId = ['UPI', 'NEFT', 'RTGS', 'Bank Transfer'].includes(this.paymentMode);
  if (needsTransactionId && !this.transactionId) {
    this.invalidate('transactionId', `Transaction ID is required for ${this.paymentMode} payments`);
  }

  next();
});

paymentSchema.index({ order: 1 });
paymentSchema.index({ contact: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);