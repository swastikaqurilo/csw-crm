const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      unique: true,
      required: [true, 'Payment number is required'],
      trim: true,
      maxlength: [50, 'Payment number too long'],
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },

    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: [true, 'Contact is required'],
    },

    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
      max: [10000000000, 'Amount too large'], // 1000 Cr cap
    },

    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
      maxlength: [3, 'Currency code must be 3 characters'],
      match: [/^[A-Z]{3}$|^$/, 'Currency must be a 3-letter ISO code'],
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    paymentMode: {
      type: String,
      enum: {
        values: ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'NEFT', 'RTGS', 'Other'],
        message: '{VALUE} is not a valid payment mode',
      },
      required: [true, 'Payment mode is required'],
    },

    paidFrom: {
      type: String,
      trim: true,
      maxlength: [150, 'paidFrom too long'],
    },

    transactionId: {
      type: String,
      trim: true,
      maxlength: [100, 'Transaction ID too long'],
    },

    chequeNumber: {
      type: String,
      trim: true,
      maxlength: [50, 'Cheque number too long'],
    },

    bankName: {
      type: String,
      trim: true,
      maxlength: [150, 'Bank name too long'],
    },

    status: {
      type: String,
      enum: {
        values: ['Pending', 'Completed', 'Cancelled'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Completed',
    },

    appliedToOrder: {
      type: Boolean,
      default: false,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes too long'],
    },

    attachmentUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'Attachment URL too long'],
      match: [/^https?:\/\/\S+$|^$/, 'Attachment URL must be a valid http(s) URL'],
    },

    isReconciled: {
      type: Boolean,
      default: false,
    },

    reconciledDate: {
      type: Date,
      default: null,
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

paymentSchema.pre('validate', function () {
  if (this.isReconciled && !this.reconciledDate) {
    this.reconciledDate = new Date();
  }

  if (!this.isReconciled) {
    this.reconciledDate = null;
  }
  if (this.paymentMode === 'Cheque') {
    if (!this.chequeNumber) {
      this.invalidate('chequeNumber', 'Cheque number is required for Cheque payments');
    }
    if (!this.bankName) {
      this.invalidate('bankName', 'Bank name is required for Cheque payments');
    }
  }

  const needsTransactionId = ['UPI', 'NEFT', 'RTGS', 'Bank Transfer'].includes(
    this.paymentMode
  );

  if (needsTransactionId && !this.transactionId) {
    this.invalidate(
      'transactionId',
      `Transaction ID is required for ${this.paymentMode}`
    );
  }
});

paymentSchema.index({ order: 1 });
paymentSchema.index({ contact: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMode: 1 });
paymentSchema.index(
  { transactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transactionId: { $type: "string", $gt: "" },
    },
  }
);
module.exports = mongoose.model('Payment', paymentSchema);